-- 20260914000001_brandprotect_schema.sql
-- Brand-protection / fraudulent-site investigation schema.
--
-- Namespaced `bp_*` inside `public` so it sits alongside the existing JOOLA Pulse
-- product-intel tables (brands, products, variants, sites, crawl_runs...) without
-- colliding, and stays reachable through PostgREST with no dashboard config change.
--
-- Conventions follow the existing schema: uuid PKs, timestamptz, snake_case,
-- crawl_runs-style run tracking.

begin;

-- ---------------------------------------------------------------------------
-- Enumerated domains of discourse (text + check, matching existing style)
-- ---------------------------------------------------------------------------

-- bp_domains: one row per registrable domain ever observed.
-- `domain` is the eTLD+1 (registrable domain), lowercased. The "joola appears in
-- the main domain, not a URL parameter" rule is enforced upstream by matching
-- only against domain labels, never path or query.
create table if not exists public.bp_domains (
  id                  uuid primary key default gen_random_uuid(),
  domain              text not null unique,
  hostname            text,
  match_kind          text check (match_kind in ('exact_label','prefix','suffix','embedded','manual')),
  classification      text not null default 'suspect'
                        check (classification in ('legitimate','suspect','confirmed_fraud','dismissed','unreachable')),
  discovery_source    text check (discovery_source in ('certstream','crt_sh','dns_permutation','web_search','manual','partner_report')),
  is_live             boolean,
  http_status         integer,
  first_seen_at       timestamptz not null default now(),
  last_checked_at     timestamptz,
  taken_down_at       timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table  public.bp_domains is 'Every joola-matching registrable domain observed, legitimate or otherwise.';
comment on column public.bp_domains.match_kind is 'Where in the domain labels "joola" appeared: exact_label=joola.com, prefix=joola-vietnam, suffix=shopjoola, embedded=other.';

create index if not exists bp_domains_classification_idx on public.bp_domains (classification);
create index if not exists bp_domains_first_seen_idx     on public.bp_domains (first_seen_at desc);
create index if not exists bp_domains_live_idx           on public.bp_domains (is_live) where is_live;


-- bp_domain_infrastructure: registrar / DNS / hosting facts. Append-only per
-- observation so infrastructure changes (a registrar transfer, a move off
-- Cloudflare) are visible as history rather than overwritten.
create table if not exists public.bp_domain_infrastructure (
  id                     uuid primary key default gen_random_uuid(),
  domain_id              uuid not null references public.bp_domains(id) on delete cascade,
  registrar_name         text,
  registrar_iana_id      integer,
  registrar_abuse_email  text,
  registrar_abuse_phone  text,
  registered_at          date,
  expires_at             date,
  domain_status          text[],
  nameservers            text[],
  dns_provider           text,
  resolved_ips           text[],
  asn                    integer,
  asn_org                text,
  hosting_country        text,
  is_proxied             boolean,
  raw_rdap               jsonb,
  observed_at            timestamptz not null default now()
);

create index if not exists bp_infra_domain_idx     on public.bp_domain_infrastructure (domain_id, observed_at desc);
create index if not exists bp_infra_registrar_idx  on public.bp_domain_infrastructure (registrar_abuse_email);
create index if not exists bp_infra_registered_idx on public.bp_domain_infrastructure (registered_at);


-- bp_snapshots: immutable evidence capture. This is the legal record — never
-- update a row, always insert a new one. Sites mutate to evade takedown.
create table if not exists public.bp_snapshots (
  id                uuid primary key default gen_random_uuid(),
  domain_id         uuid not null references public.bp_domains(id) on delete cascade,
  captured_at       timestamptz not null default now(),
  http_status       integer,
  final_url         text,
  response_headers  jsonb,
  html_sha256       text,
  html_bytes        integer,
  screenshot_path   text,
  tech_stack        jsonb,
  signals           jsonb,
  ai_analysis       jsonb,
  risk_score        integer check (risk_score between 0 and 100),
  verdict           text check (verdict in ('legitimate','low_risk','suspicious','high_risk','confirmed_fraud','unreachable'))
);

comment on table  public.bp_snapshots is 'Immutable, timestamped evidence. Append-only: never UPDATE.';
comment on column public.bp_snapshots.tech_stack is 'e.g. {"cms":"wordpress","ecommerce":"woocommerce","page_builder":"elementor","page_builder_version":"3.35.6"}';

create index if not exists bp_snapshots_domain_idx on public.bp_snapshots (domain_id, captured_at desc);
create index if not exists bp_snapshots_stack_idx  on public.bp_snapshots using gin (tech_stack);


-- bp_observed_products: price evidence. Proves counterfeit pricing and, when the
-- same ladder repeats FX-converted across domains, proves a shared source catalogue.
create table if not exists public.bp_observed_products (
  id             uuid primary key default gen_random_uuid(),
  snapshot_id    uuid references public.bp_snapshots(id) on delete cascade,
  domain_id      uuid not null references public.bp_domains(id) on delete cascade,
  name           text,
  url            text,
  currency       text,
  regular_price  numeric(12,2),
  sale_price     numeric(12,2),
  discount_pct   numeric(5,2),
  image_url      text,
  captured_at    timestamptz not null default now()
);

create index if not exists bp_products_domain_idx on public.bp_observed_products (domain_id, captured_at desc);


-- bp_clusters: a coordinated campaign. The whole point of the tool — individual
-- domains are cheap to register, but the operator behind a cluster is one target.
create table if not exists public.bp_clusters (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  label          text not null,
  fingerprint    jsonb,
  first_seen_at  date,
  status         text not null default 'active' check (status in ('active','partially_mitigated','mitigated','dormant')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.bp_clusters.fingerprint is 'What ties members together, e.g. {"page_builder_version":"3.35.6","discount_ladder":[57,50,30],"dns_provider":"cloudflare"}';

create table if not exists public.bp_cluster_members (
  cluster_id  uuid not null references public.bp_clusters(id) on delete cascade,
  domain_id   uuid not null references public.bp_domains(id) on delete cascade,
  confidence  text not null default 'medium' check (confidence in ('high','medium','low')),
  rationale   text,
  added_at    timestamptz not null default now(),
  primary key (cluster_id, domain_id)
);


-- bp_discovery_runs: mirrors the existing crawl_runs shape so the two crawl
-- subsystems read the same way.
create table if not exists public.bp_discovery_runs (
  id                   uuid primary key default gen_random_uuid(),
  run_type             text not null check (run_type in ('certstream','crt_sh','dns_permutation','web_search','manual')),
  status               text not null default 'running' check (status in ('running','done','partial','failed')),
  candidates_tested    integer default 0,
  candidates_resolved  integer default 0,
  domains_new          integer default 0,
  stats                jsonb,
  error_message        text,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz
);

create index if not exists bp_runs_started_idx on public.bp_discovery_runs (started_at desc);


-- bp_takedown_actions: what was sent, to whom, and what happened. NOT publicly
-- readable — it reveals response strategy and timing to anyone watching.
create table if not exists public.bp_takedown_actions (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid references public.bp_domains(id) on delete cascade,
  cluster_id    uuid references public.bp_clusters(id) on delete set null,
  channel       text not null check (channel in ('registrar','dns_provider','hosting','cert_authority','national_cert','safe_browsing','payment_processor','marketplace','ad_platform','legal')),
  recipient     text,
  reference     text,
  subject       text,
  body          text,
  status        text not null default 'draft' check (status in ('draft','sent','acknowledged','actioned','rejected','no_response')),
  submitted_at  timestamptz,
  resolved_at   timestamptz,
  outcome       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists bp_takedown_domain_idx on public.bp_takedown_actions (domain_id, created_at desc);


-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.bp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bp_domains_touch  on public.bp_domains;
create trigger bp_domains_touch  before update on public.bp_domains
  for each row execute function public.bp_touch_updated_at();

drop trigger if exists bp_clusters_touch on public.bp_clusters;
create trigger bp_clusters_touch before update on public.bp_clusters
  for each row execute function public.bp_touch_updated_at();

drop trigger if exists bp_takedown_touch on public.bp_takedown_actions;
create trigger bp_takedown_touch before update on public.bp_takedown_actions
  for each row execute function public.bp_touch_updated_at();


-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- "What is live and hostile right now"
create or replace view public.bp_v_active_threats as
select
  d.id, d.domain, d.classification, d.first_seen_at, d.last_checked_at,
  i.registered_at, i.registrar_name, i.registrar_abuse_email, i.dns_provider,
  s.tech_stack, s.risk_score, s.verdict, s.captured_at as last_snapshot_at,
  c.slug as cluster_slug, c.label as cluster_label
from public.bp_domains d
left join lateral (
  select * from public.bp_domain_infrastructure x
  where x.domain_id = d.id order by x.observed_at desc limit 1
) i on true
left join lateral (
  select * from public.bp_snapshots x
  where x.domain_id = d.id order by x.captured_at desc limit 1
) s on true
left join public.bp_cluster_members cm on cm.domain_id = d.id
left join public.bp_clusters c on c.id = cm.cluster_id
where d.classification in ('suspect','confirmed_fraud')
  and coalesce(d.is_live, false)
order by i.registered_at desc nulls last;

-- "What came newly into the market" — the landing feed.
create or replace view public.bp_v_new_domains as
select
  d.domain, d.classification, d.discovery_source, d.is_live,
  d.first_seen_at, i.registered_at, i.registrar_name, i.registrar_abuse_email,
  c.label as cluster_label,
  (i.registered_at > (current_date - interval '60 days')) as recently_registered
from public.bp_domains d
left join lateral (
  select * from public.bp_domain_infrastructure x
  where x.domain_id = d.id order by x.observed_at desc limit 1
) i on true
left join public.bp_cluster_members cm on cm.domain_id = d.id
left join public.bp_clusters c on c.id = cm.cluster_id
where d.classification <> 'legitimate'
order by d.first_seen_at desc, i.registered_at desc nulls last;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app is deployed public with no login, so the publishable key is world-
-- readable. Grant anon SELECT on investigation data only; every write path goes
-- through server-side route handlers using the secret key (which bypasses RLS).
-- bp_takedown_actions gets NO anon policy: response strategy stays private.
-- ---------------------------------------------------------------------------
alter table public.bp_domains               enable row level security;
alter table public.bp_domain_infrastructure enable row level security;
alter table public.bp_snapshots             enable row level security;
alter table public.bp_observed_products     enable row level security;
alter table public.bp_clusters              enable row level security;
alter table public.bp_cluster_members       enable row level security;
alter table public.bp_discovery_runs        enable row level security;
alter table public.bp_takedown_actions      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'bp_domains','bp_domain_infrastructure','bp_snapshots',
    'bp_observed_products','bp_clusters','bp_cluster_members','bp_discovery_runs'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_anon_read', t);
  end loop;
end $$;

-- Deliberately no policy on bp_takedown_actions -> anon reads return zero rows.

commit;
