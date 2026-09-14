# JOOLA Brand Protection

Discovery, investigation and takedown-evidence tooling for domains impersonating JOOLA.

Paste a URL → full dossier (registrar, abuse contacts, hosting, DNS, e-commerce
platform, price evidence) plus a ready-to-send takedown pack. Results persist in
Supabase, so repeat lookups are instant and the evidence trail is permanent.

Separately, it **discovers** new impersonation domains before anyone reports them.

---

## Quick start

```bash
cp .env.local.example .env.local   # fill in; never commit .env.local
npm install
node scripts/migrate.mjs           # apply schema (idempotent)
node scripts/verify-db.mjs         # health + RLS check
npm run dev                        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Next.js 16 app |
| `npm test` / `npm run test:coverage` | Vitest unit tests (64) |
| `npm run test:e2e` | Playwright, desktop + mobile (112) |
| `node scripts/recon.mjs` | One discovery sweep → `evidence/recon-<date>.json` |
| `node scripts/discover.mjs [--dry-run]` | Sweep + **diff vs database** + persist what's new → `docs/scans/SCAN-<date>.md` |
| `node scripts/seed-supabase.mjs` | Load an evidence file into `bp_*` |
| `node scripts/capture-evidence.mjs` | Screenshot + HTML + SHA-256 of live sites |
| `node scripts/migrate.mjs [--status]` | Apply / inspect migrations |
| `node scripts/verify-db.mjs` | Row counts, views, RLS assertions |
| `node scripts/screenshot.mjs` | UI screenshots for review |

---

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Schema, env, migrations | ✅ applied to Supabase |
| 1 | Discovery + passive enrichment | ✅ 50 domains tracked, 11-domain campaign found |
| 1b | Supabase persistence | ✅ seeded, RLS verified |
| 1c | Weekly scheduled scan (Mon 08:00 IST) | ✅ GitHub Actions, change report per run |
| 2 | Evidence capture (Playwright) | ✅ 10/10 live sites captured with hashes |
| 3 | Next.js 16 UI | ✅ built, 30 E2E tests passing |
| 4 | Claude risk scoring | ⏸️ deterministic scoring live; LLM layer behind `ANTHROPIC_API_KEY` |
| 5 | Takedown pack generator | ✅ per-domain, routed from collected data |
| 6 | Real-time CT monitoring | ⚠️ **blocked upstream** — see below |

---

## What the first sweep found

A **coordinated 11-domain campaign**, of which only 3 were known internally.

| Registered | Domain | Registrar abuse | Market |
|---|---|---|---|
| 2026-07-20 | joolauk.com | abuse@kouming.com | UK |
| 2026-07-21 | joola-malaysia.com | abuse3814@brandfocus.cn | MY |
| 2026-07-22 | joola-india.com | abuse@kouming.com | IN |
| 2026-07-22 | joola-philippines.com | abuse@kouming.com | PH |
| 2026-07-22 | joolanz.com | abuse@ordertld.com | NZ |
| 2026-07-22 | joola-singapore.com | abuse@kouming.com | SG — **down** |
| 2026-07-23 | joola-vietnam.com | abuse@kh86.cn | VN |
| 2026-07-23 | joola-thailand.com | abuse@kh86.cn | TH |
| 2026-07-23 | joolafrance.com | abuse3814@brandfocus.cn | FR |
| 2026-07-23 | joolaindonesia.com | abuse@kh86.cn | ID |
| **2026-08-27** | **joolasg.com** | abuse3814@brandfocus.cn | SG — **replacement** |

Four independent proofs of coordination:

1. **Identical build** — every live site runs WordPress + WooCommerce + **Elementor 3.35.6**, the same point release, page weights within 15%.
2. **One price list, FX-converted** — discount ladder identical across markets: 299.95 USD × 1.274 = 382.19 SGD; × 32.52 = 9,755.54 THB.
3. **Coordinated burst** — ten registered in four days, deliberately split across four registrars.
4. **Uniform DNS** — all eleven on Cloudflare with the origin concealed.

**`joola-singapore.com` was suspended in late August; `joolasg.com` was registered
27 August with the identical build.** Per-domain takedown has already been shown
insufficient — which is why the tool models *campaigns*, not just domains.

Scope is not APAC-only: `joolauk.com` (the earliest) and `joolafrance.com` put the
UK and France in scope.

Evidence: `evidence/recon-2026-09-14.json`, `evidence/capture-*/`.
Takedown: `docs/TAKEDOWN-01-cloudflare-cluster.md`.

---

## Architecture decisions, and the evidence behind them

Every claim below was measured, not assumed.

### Discovery: DNS permutation is primary; CT firehose is blocked upstream

| Channel | Latency | Status |
|---|---|---|
| **DNS permutation sweep** | scheduled | ✅ **Primary.** Found all 11 campaign domains, including 8 nobody had reported. |
| crt.sh | on demand | ⚠️ **Verification only** — cannot do substring discovery. |
| CertStream public feed | — | ❌ **Dead.** Connects, then delivers nothing. |
| Direct CT log tailing | minutes | ⚠️ Feasible but real infrastructure work. |
| Web search | days–weeks | Supplementary only; indexing lag makes it useless for new domains. |

**crt.sh cannot discover** (measured 2026-09-14): `NAME_VALUE ILIKE '%joola%'`
times out at 110s+ across 15 retries — a full scan of billions of rows.
`plainto_tsquery('certwatch','joola')` returns in 11s but yields **0 rows**,
because the index tokenises whole domain labels: `joola.com` matches (1,442
hostnames), `joolaindonesia.com` matches (2), bare `joolaindonesia` matches
nothing. It answers "what certs exist for *this* domain", never "which domains
contain this string".

**CertStream's public feed is dead.** `wss://certstream.calidog.io/` and
`/domains-only` both accept the connection and then send zero messages.
Building on it would have produced the worst failure mode available: a
monitoring system that looks healthy and never fires.

**Direct CT log tailing is viable but not free.** The Google log list at
`gstatic.com/ct/log_list/v3/log_list.json` lists 21 usable logs; `get-sth`
responds (argon2026h2 `tree_size` 3,068,087,614). Tailing means paging
`get-entries` from a stored checkpoint across every log — real throughput work,
which is exactly why CertStream existed. Deferred deliberately rather than
half-shipped; a self-hosted `certstream-server-go` is the intended route.

Until then `scripts/discover.mjs` provides the same *outcome* on a schedule:
sweep, diff against the database, report new domains, domains that came back
online, and domains that stopped resolving.

### The weekly scan

`.github/workflows/weekly-scan.yml` runs the sweep **every Monday at 08:00 IST**
(`30 2 * * 1` UTC — IST observes no DST, so the local time does not drift), and
on demand via *Actions → Weekly discovery scan → Run workflow*.

Each run writes `docs/scans/SCAN-<date>.md`: what is new, what went offline, what
came back, each with **the date we added it** alongside the date it was
registered. Those are different facts and the report keeps them apart —
`first_seen_at` is our detection date and belongs to us, `registered_at` comes
from the registry and belongs in a complaint.

Two things the schedule requires, and one it deliberately does not do:

- Repository secrets `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` must
  be set (*Settings → Secrets and variables → Actions*), or the run fails at the
  first database read.
- GitHub disables scheduled workflows after **60 days with no repository
  activity**, and emails the owner. A quiet quarter silently stops the scanning.
- The report is uploaded as a build artefact (90-day retention), **not committed
  back to the repository**, because the repo is public and a committed report
  would publish our detection cadence and coverage to the operators being
  tracked. Once the repo is private, committing it is the better option.

`taken_down_at` is stamped only on the live → dead transition, so it records when
a domain *first* went down rather than the most recent sweep that saw it down.
Coming back online clears it, because a takedown that did not hold is not a
takedown.

### Matching: domain labels only, never path or query

`matchBrandDomain()` parses to the registrable domain and inspects only labels.
`joola-vietnam.com` matches; `example.com/?ref=joola` cannot match **by
construction** — `parseHost()` discards everything from the first `/`, `?` or `#`
before matching runs. Match shape is graded (`exact_label` > `prefix` > `suffix`
> `embedded`, subdomain hits halved) so triage is ranked, not a flat keyword dump.

> Public-suffix handling covers the TLDs in scope. Swap for the full Public
> Suffix List before wider production use.

### Schema namespaced `bp_*` inside `public`

The Supabase project is **not** empty — it hosts the JOOLA Pulse product-intel
schema (`brands`, `products`, `variants`, `sites`, `crawl_runs`). New tables are
prefixed `bp_` rather than given a separate Postgres schema, because a separate
schema needs a dashboard change to be reachable through PostgREST. Conventions
follow what is already there: uuid PKs, timestamptz, `schema_migrations`
versioning, `crawl_runs`-shaped run tracking.

`joola.com` already exists in `sites` with `platform=shopify` — the legitimate-estate
allowlist is already maintained there.

### Evidence tables are append-only

`bp_snapshots` and `bp_domain_infrastructure` are never updated, only inserted.
Impersonation sites mutate to evade takedown; the dated record of what a site
looked like when reported is the thing with legal value.

### RLS for a public, no-login deployment

The publishable key is world-readable, so every `bp_*` table grants anon `SELECT`
only, and all writes go through server-side code using the secret key.
**`bp_takedown_actions` deliberately has no anon policy** — response strategy and
timing must not be visible to the people being reported. `scripts/verify-db.mjs`
asserts this and fails if it regresses.

### Claim discipline is enforced in code, not left to the writer

`generateTakedownPack()` only uses confirmed-fraud language where transactional
evidence exists (currently only `joola-singapore.com`, via the distributor's test
purchase). Everything else is reported as trademark infringement and coordinated
impersonation. Overclaiming is the most common reason abuse reports get
dismissed, so it is unit-tested.

### Bugs caught during the build — all three would have reached a complaint

1. **Substring content matching.** A detector using `html.includes('cod')` flagged
   payment methods by matching the word "code"; `'vat'` matched inside "private".
   Results were discarded, and word-boundary matching is now a tested requirement.
2. **Timezone date shift.** node-postgres parses `DATE` into local midnight,
   turning `2026-07-20` into `2026-07-19T18:30Z` in IST. Registration dates go
   into legal complaints; a one-day error is not acceptable. Fixed with an
   explicit oid-1082 parser.
3. **Duplicate price rows.** Storefronts repeat products across carousels, so the
   ladder listed the same product up to three times — overstating the catalogue.
   Now deduplicated, which also surfaced two products previously crowded out.

Found later by the exploratory audit suite (`e2e/audit.spec.ts`):

4. **`mailto:` links opened in a new tab.** Registrar abuse links carried
   `target="_blank"`, which strands an empty tab once the mail client takes over.
   New-tab behaviour is now applied only to `http(s)` submissions.
5. **No favicon, no robots.txt.** `/favicon.ico` 404'd, which Chromium requests
   opportunistically — the source of an intermittent test failure. Added
   `app/icon.svg`, and `app/robots.ts` disallowing all crawlers, because pages
   naming domains under active investigation must never be search-indexed.

Found while building the weekly scan — both would have made the schedule report
confidently wrong:

6. **`firstSeenAt` was never read from the database.** The loader did not select
   `first_seen_at` and filled the field with the snapshot capture time, so every
   domain claimed to have been discovered *today*, on every page load. "What is
   new since last week" is the entire point of a weekly scan, and that made it
   unanswerable. Now selected, plumbed through, and shown as its own column.
7. **The E2E suite graded whatever server happened to be on :3000.**
   `reuseExistingServer: true` let a stale `next start` from an earlier build
   answer the tests: one run reported 31 failures against code that no longer
   existed. A suite that tests the wrong build is worse than no suite, because it
   is believed. Reuse is off; a busy port now fails loudly.

## Test suites

| Suite | Count | Purpose |
|---|---|---|
| `src/lib/*.test.ts` (Vitest) | 64 | Matching rules, fingerprinting, pricing, claim discipline |
| `e2e/investigation.spec.ts` | 30 | Intended behaviour: scan, dossier, campaign, takedown |
| `e2e/audit.spec.ts` | 82 | Adversarial: console errors, failed requests, link integrity, duplicate DOM ids, dangling ARIA refs, unnamed controls, partial-data domains, malformed params, overflow at 6 widths, tap-target sizes, date-shift and price-duplication regressions |

E2E runs against the production build (`npm run start`), not the dev server — dev
compiles routes on first request, which produced misleading timeouts.

---

## Security

- `.env.local` is gitignored; the real secret exists nowhere else in the repo.
- `SUPABASE_SECRET_KEY` bypasses RLS — server-side only, never `NEXT_PUBLIC_`.
- **Rotate the secret key** (Supabase → Settings → API); it was transmitted over chat.
- `SUPABASE_DB_URL` is used only by `scripts/migrate.mjs`, never by the app runtime.

### Before the public deployment goes live

- [ ] SSRF guard — reject private/loopback/link-local IPs **after** resolution
- [ ] Cloudflare Turnstile on the scan form (new scans only; cached reads stay free)
- [ ] Per-IP rate limiting on new scans
- [ ] Confirm public wording stays as evidenced risk indicators, not accusations
