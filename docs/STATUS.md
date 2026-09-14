# Project status and handoff

**Last updated:** 2026-09-14 · **Owner:** Gyanendu Rout (grout@joola.com)

Read this first in a new session. The code explains *how* the system works; this
file records *where things stand*, what is blocked, and the standing decisions
that are not visible from the code.

---

## Standing instructions — read before acting

These are live constraints from the project owner, not historical notes.

1. **Nothing is sent to anyone.** No abuse reports, no registrar complaints, no
   emails, no Safe Browsing submissions. Everything produced so far is a
   **draft for internal review only**. Do not send, file, or submit anything
   without an explicit new instruction.
2. **`docs/EMAIL-...md` is a draft.** Status line says `DRAFT. NOT SENT.` Keep
   it that way.
3. **`docs/TAKEDOWN-01-cloudflare-cluster.md` is ON HOLD — NOT TO BE FILED.**
   The Cloudflare route was explicitly deprioritised: "just report it".
4. **Do not report Group B domains as fraudulent** until they are checked
   against JOOLA's authorised distributor list. See the caveat below — this is a
   commercial and legal risk, not a technical one.

---

## Where everything lives

| Thing | Location |
|---|---|
| App (production) | https://saas-fraudulent-joola-websites.vercel.app |
| Repository | https://github.com/gyanendurout/SaaS_Fraudulent_JOOLA_Websites — **public** |
| Vercel project | `gyan-joola/saas-fraudulent-joola-websites` (git-connected, auto-deploys from `main`) |
| Database | Supabase project `vbyaqzkagzhatdqitfko`, tables prefixed `bp_*` in `public` |
| Local secrets | `.env.local` — gitignored, exists nowhere else in the repo. Never commit it. |
| Weekly scan | `.github/workflows/weekly-scan.yml` — Mondays 08:00 IST |
| Scan reports | `docs/scans/SCAN-<date>.md` — **gitignored**; CI keeps 90-day artefacts |
| Durable scan history | `bp_discovery_runs` in Supabase (run id, counts, per-run stats) |

The Supabase project is shared with the JOOLA Pulse product-intel schema
(`brands`, `products`, `sites`, `crawl_runs`). Do not assume it is empty; the
`bp_` prefix exists to avoid collisions.

---

## Open items

### Blocked on the owner — cannot be done from a session

| # | Item | Why it is blocked |
|---|---|---|
| 1 | **Add repo secrets** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Settings → Secrets and variables → Actions) | PAT returns `HTTP 403` on the secrets API. **Until done, the Monday scan fires and fails at the first database read.** |
| 2 | **Rotate `SUPABASE_SECRET_KEY`** | It was transmitted over chat. **Rotate before item 1**, then set the new value — rotating afterwards breaks the scheduled run. |
| 3 | **Make the repository private** | PAT lacks `Administration: write`. Repo Settings → Danger Zone. The app is also publicly reachable with no auth. |
| 4 | **Verify Group B against the authorised distributor list** | Only JOOLA's distributor records can settle it; registry and hosting data cannot. |
| 5 | **Trademark registration numbers + who signs** | Needed before any complaint could be filed. JOOLA legal. |

### Not started, deliberately

- **Crawl4AI Python service** — never begun.
- **Claude LLM risk-scoring layer** — code path exists behind `ANTHROPIC_API_KEY`
  but is **untested**. Deterministic scoring is what actually runs.
- **Direct CT log tailing** — viable but real infrastructure work; see README.
- **Public-deployment hardening** — SSRF guard (reject private/loopback IPs
  *after* resolution), Turnstile on the scan form, per-IP rate limiting. These
  matter more now that the deployment is public and unauthenticated.

---

## What the investigation found

An **11-domain coordinated campaign**, of which only 3 were known internally.
Every live member runs WordPress + WooCommerce + **Elementor 3.35.6** — the same
point release — with a 57/50/30% discount ladder FX-converted from one USD price
list. Ten registered in a four-day burst (20–23 Jul 2026) across four CN/HK
registrars, all behind Cloudflare.

`joola-singapore.com` was suspended in late Aug; **`joolasg.com` was registered
27 Aug with the identical build** — per-domain takedown has already been shown
insufficient, which is why the tool models campaigns rather than domains.

Scope is not APAC-only: `joolauk.com` (earliest) and `joolafrance.com`.

### The Group A / Group B split — important

Of 19 domains reported as "100% fraudulent", only **11 match the campaign
fingerprint**. The other 8 do not: different registrars, platforms, and
registration dates spanning two years, with no shared build.

Three present as **named regional retailers, not as JOOLA**:

- `joolaphilippines.com` / `joolaph.com` — trade as "PickleballPH", GoDaddy,
  Shopify, registered Sep 2024.
- `joolaindia.com` — trades as "Sports Next Door", Hostinger, Jul 2025.

An authorised distributor and an unauthorised reseller look identical from
registry data. Reporting a contracted partner as fraudulent risks the commercial
relationship and creates legal exposure. **This caveat was raised and is
unresolved.** Full detail: `docs/DOMAIN-PROFILE-2026-09-14.md`.

---

## Things already proven dead — do not rebuild

Each was measured, not assumed. Re-attempting them wastes a session.

- **crt.sh cannot do substring discovery.** `ILIKE '%joola%'` times out at 110s+;
  FTS returns **0 rows** for bare labels because the index tokenises whole domain
  labels. Useful only to verify a domain you already know.
- **CertStream's public feed is dead.** Connects, then delivers zero messages.
  Building on it yields the worst failure mode available: monitoring that looks
  healthy and never fires.
- **Web search is useless for new domains** — indexing lag is days to weeks.

DNS permutation sweeping is the primary channel and found all 11.

---

## Bug classes this codebase has already been bitten by

Guard against regressions in these specific ways:

1. **Timezone date shift** — `DATE` parsed into local midnight turned
   `2026-07-20` into `2026-07-19` in IST. Dates go into legal complaints. Use
   `isoDay()` (`src/lib/dates.ts`); never round-trip an evidence date through
   `Date`. Scripts set `pg.types.setTypeParser(1082, v => v)`.
2. **Substring matching** — `html.includes('cod')` matched "code"; `'vat'`
   matched inside "private". Word-boundary matching is a tested requirement.
3. **Fabricated dates** — `first_seen_at` was not selected from the database and
   was filled with the snapshot time, so every domain claimed to be found today.
4. **Stale test server** — Playwright reused whatever sat on `:3000` and graded
   the wrong build, reporting 31 failures against code that no longer existed.
   `reuseExistingServer` is off; keep it off.
5. **Overclaiming** — `generateTakedownPack()` only uses confirmed-fraud language
   where transactional evidence exists. It is unit-tested. Do not loosen it.

---

## Verification commands

```bash
node scripts/verify-db.mjs              # row counts, views, RLS assertions
node scripts/discover.mjs --dry-run     # full sweep + report, writes no DB rows
npm test                                # 64 unit tests
npm run build && npx playwright test    # 112 E2E, desktop + mobile
```

`bp_takedown_actions` must have **zero** anon policies — response strategy must
not be readable by the people being reported. `verify-db.mjs` asserts this and
fails if it regresses.
