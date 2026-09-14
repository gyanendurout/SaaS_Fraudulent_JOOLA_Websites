# Takedown 01 — Cloudflare consolidated abuse report

**Target:** Cloudflare, Inc. — Trust & Safety
**Submit at:** https://abuse.cloudflare.com/ → category **"Trademark Infringement"**, and separately **"Phishing"**
**Prepared:** 2026-09-14
**Evidence file:** `evidence/recon-2026-09-14.json`
**Status:** 🔸 **ON HOLD — NOT TO BE FILED.** Deprioritised 2026-09-14 by request.
Retained as a prepared draft only. Nothing here has been submitted to Cloudflare
or to any registrar, CERT or other party. Current action is internal reporting
only — see `EMAIL-2026-09-14-fraudulent-domains-report.md`.
Requires sign-off from JOOLA legal / brand owner before it is ever submitted.

---

## Why Cloudflare first

All 11 domains in this cluster use Cloudflare nameservers. Cloudflare is the single
control point that covers the entire campaign in one report, versus four separate
complaints to Chinese and Hong Kong registrars. Cloudflare also holds the origin
host identity, which is otherwise concealed — their response typically either
forwards to the origin host or discloses it, which unlocks the next takedown stage.

Submit the registrar complaints in parallel (see `TAKEDOWN-02-registrars.md`);
do not wait for Cloudflare to respond first.

---

## Before you send — three checks

1. **Trademark registration numbers.** Cloudflare's trademark form requires the
   registration number and jurisdiction. Fill in the table below — I do not have
   JOOLA's TM registry data. Registrations covering **MY, ID, SG, TH, VN, PH, IN,
   NZ, FR, UK** are the relevant ones; if a market has no registration, rely on
   the phishing/fraud category for that domain instead.
2. **Authority to act.** The form asks whether you are the rights holder or an
   authorised agent. Confirm who signs — likely Simon Nadler or JOOLA legal.
3. **Scope claim discipline.** Only `joola-singapore.com` has a completed test
   purchase proving non-delivery. For the other ten, claim **trademark
   infringement and coordinated impersonation** (fully evidenced below), not
   "confirmed payment fraud". Overclaiming is the fastest way to get a report
   dismissed.

---

## Affected domains

| # | Domain | Registered | Registrar | Market | Status |
|---|---|---|---|---|---|
| 1 | joolauk.com | 2026-07-20 | Hongkong Kouming International Ltd | UK | Live |
| 2 | joola-malaysia.com | 2026-07-21 | Guizhou Zhongyu Zhike Network Tech | MY | Live |
| 3 | joola-philippines.com | 2026-07-22 | Hongkong Kouming International Ltd | PH | Live |
| 4 | joola-india.com | 2026-07-22 | Hongkong Kouming International Ltd | IN | Live |
| 5 | joolanz.com | 2026-07-22 | CNOBIN Information Technology Ltd | NZ | Live |
| 6 | joola-singapore.com | 2026-07-22 | Hongkong Kouming International Ltd | SG | **Down** — confirmed fraud |
| 7 | joolaindonesia.com | 2026-07-23 | Vantage of Convergence (Chengdu) | ID | Live |
| 8 | joola-vietnam.com | 2026-07-23 | Vantage of Convergence (Chengdu) | VN | Live |
| 9 | joola-thailand.com | 2026-07-23 | Vantage of Convergence (Chengdu) | TH | Live |
| 10 | joolafrance.com | 2026-07-23 | Guizhou Zhongyu Zhike Network Tech | FR | Live |
| 11 | **joolasg.com** | **2026-08-27** | Guizhou Zhongyu Zhike Network Tech | SG | Live — **re-registration** |

JOOLA's legitimate estate, for contrast — **do not include these**:
`joola.com`, `joolausa.com`, `joola.de` (all Shopify-hosted).

---

## Evidence of coordination

Four independent signals establish that these are one operator, not eleven
unrelated sites:

1. **Identical software build.** Every live domain serves WordPress + WooCommerce
   with **Elementor version 3.35.6** — the same point release on all ten. Page
   weights fall within a 15% band (275 KB–323 KB), consistent with one template
   deployed repeatedly rather than independently built sites.

2. **A single source price list, FX-converted.** The discount ladder is identical
   across markets, with prices converted from one USD base:

   | Item | joola-vietnam (USD) | joolasg (SGD) | joola-thailand (THB) | Discount |
   |---|---|---|---|---|
   | 1 | 299.95 → 128.00 | 382.19 → 163.09 | 9,755.54 → 4,163.06 | **−57%** |
   | 2 | 229.95 → 114.97 | 293.00 → 146.49 | 7,478.87 → 3,739.27 | **−50%** |
   | 3 | 99.95 → 69.97 | 127.35 → 89.15 | 3,250.76 → 2,275.70 | **−30%** |

   299.95 USD × 1.274 = 382.19 SGD; × 32.52 = 9,755.54 THB. Consistent FX
   application across all three confirms a shared catalogue backend.

3. **Coordinated registration burst.** Ten of the eleven domains were registered
   in a four-day window, 20–23 July 2026, deliberately distributed across four
   different registrars — a standard resilience tactic to survive single-registrar
   suspension.

4. **Uniform DNS infrastructure.** All eleven use Cloudflare nameservers with the
   origin concealed behind Cloudflare's proxy.

### Demonstrated evasion after takedown

`joola-singapore.com` was suspended in late August 2026 following an earlier
JOOLA report. **On 27 August 2026 the operator registered `joolasg.com`** through
the same registrar family, deployed the identical Elementor 3.35.6 build, and
resumed trading to the Singapore market in SGD.

This matters for the remedy requested: per-domain suspension has already been
shown insufficient. We are asking Cloudflare to treat this as a coordinated
campaign and to apply account-level action.

### Consumer harm, evidenced

A JOOLA authorised distributor in Singapore conducted a test purchase on
`joola-singapore.com`. **Payment was successfully captured; no goods were ever
delivered.** That domain is a member of this cluster on every fingerprint above.

Each live site makes approximately **1,850 uses of the JOOLA word mark** per
homepage and reproduces JOOLA product photography and product naming.

### Impersonation stated in the page titles

Every live site declares itself as JOOLA's national presence in its HTML `<title>`:

| Domain | Page title as served |
|---|---|
| joolauk.com | JOOLA UK \| JOOLA Pickleball Paddle Sale & JOOLA Table Tennis |
| joola-malaysia.com | JOOLA Malaysia \| JOOLA Pickleball Paddle Sale & JOOLA Perseus |
| joola-india.com | JOOLA India \| JOOLA Pickle Ball Paddle Sale & JOOLA Racket |
| joola-philippines.com | JOOLA Philippines \| JOOLA Pickleball Paddle & Table Tennis |
| joolanz.com | JOOLA NZ \| JOOLA Pickleball Paddle & Table Tennis Table |
| joola-thailand.com | JOOLA Thailand \| JOOLA Pickleball Paddle Thailand & Perseus |
| joolafrance.com | JOOLA France \| JOOLA Tennis De Table & Raquette De Pickleball |
| joolaindonesia.com | JOOLA Indonesia \| JOOLA Pickleball Sale |
| joolasg.com | JOOLA Singapore \| JOOLA Essentials Pickleball Paddle Price |

This is not incidental reference to a brand — each site holds itself out as the
official JOOLA operation for a national market.

### Evidence preserved

Full-page screenshots, served HTML, response headers and SHA-256 hashes for all
ten live domains were captured on 2026-09-14 and are stored under
`evidence/capture-2026-09-14T07-41-54/`, with `manifest.json` recording UTC
capture timestamps and per-file hashes. Captures were taken **before** any
report was filed, so the evidence survives suspension of the domains.

---

## Requested action

1. Terminate Cloudflare services for all eleven domains listed.
2. Treat them as a single coordinated campaign under one abuse case reference.
3. Disclose the origin hosting provider(s) so infringement notices can be served
   at the hosting layer.
4. Apply account-level enforcement against the registering account(s), given the
   demonstrated re-registration pattern.
5. Flag the cluster fingerprint so future domains matching it are caught at onboarding.

---

## Draft submission text

> **Subject:** Coordinated trademark infringement and consumer fraud — 11-domain JOOLA impersonation cluster
>
> I am submitting this on behalf of JOOLA, a table tennis and pickleball equipment
> manufacturer. We have identified eleven domains using Cloudflare nameservers
> that impersonate JOOLA's official retail presence across eleven national markets.
>
> These are not independent sites. All live domains serve an identical WordPress/
> WooCommerce build running Elementor 3.35.6, present the same discount ladder
> (−57%/−50%/−30%) converted from a single USD price list into local currencies,
> and were registered in a coordinated four-day burst between 20 and 23 July 2026
> across four different registrars.
>
> Consumer harm is established. An authorised JOOLA distributor conducted a test
> purchase on joola-singapore.com, a member of this cluster: payment was captured
> and no goods were delivered.
>
> These sites reproduce the JOOLA registered word mark approximately 1,850 times
> per homepage together with our product photography, and offer purported JOOLA
> products at 50–57% below authorised retail pricing. None is an authorised JOOLA
> distributor.
>
> We note that joola-singapore.com was suspended in late August 2026 following an
> earlier report, and that the operator registered joolasg.com on 27 August 2026
> with the identical build, resuming trade in the same market. Per-domain
> suspension has proven insufficient; we request account-level action.
>
> Affected domains: joolauk.com, joola-malaysia.com, joola-philippines.com,
> joola-india.com, joolanz.com, joola-singapore.com, joolaindonesia.com,
> joola-vietnam.com, joola-thailand.com, joolafrance.com, joolasg.com
>
> JOOLA's legitimate domains, for your exclusion: joola.com, joolausa.com, joola.de
>
> Trademark registrations: [COMPLETE BEFORE SENDING]
>
> We request termination of services, disclosure of the origin hosting provider,
> and account-level enforcement.

---

## Trademark registrations — complete before sending

| Jurisdiction | Mark | Registration no. | Class | Status |
|---|---|---|---|---|
| EU (EUIPO) | JOOLA | | 28 | |
| UK | JOOLA | | 28 | |
| Singapore | JOOLA | | 28 | |
| Malaysia | JOOLA | | 28 | |
| Indonesia | JOOLA | | 28 | |
| Thailand | JOOLA | | 28 | |
| Vietnam | JOOLA | | 28 | |
| Philippines | JOOLA | | 28 | |
| India | JOOLA | | 28 | |
| New Zealand | JOOLA | | 28 | |
| France | JOOLA | | 28 | |

*Class 28 = sporting goods. Confirm actual classes with JOOLA legal.*

---

## Parallel actions — do not serialise these

| # | Channel | Recipient | Covers |
|---|---|---|---|
| 02 | Registrar abuse | abuse@kouming.com | joolauk, joola-philippines, joola-india, joola-singapore |
| 02 | Registrar abuse | abuse3814@brandfocus.cn | joola-malaysia, joolafrance, joolasg |
| 02 | Registrar abuse | abuse@kh86.cn | joolaindonesia, joola-vietnam, joola-thailand |
| 02 | Registrar abuse | abuse@ordertld.com | joolanz |
| 03 | Google Safe Browsing | safebrowsing.google.com/safebrowsing/report_phish/ | all live — fastest consumer protection |
| 04 | MyCERT | cyber999@cybersecurity.my | joola-malaysia |
| 04 | BSSN / ID-CERT | — | joolaindonesia |
| 04 | SingCERT | — | joolasg |
| 04 | ThaiCERT / VNCERT / CERT-In / NCSC UK / CERT-FR | — | respective markets |
| 05 | Meta / TikTok ad libraries | — | check for paid promotion of these domains |

**Google Safe Browsing is the highest-leverage immediate action** — it puts a full-page
red interstitial in front of Chrome, Safari and Firefox users within hours, protecting
customers long before any registrar responds.

---

## Open items

- [ ] **Trademark registration numbers** (JOOLA legal) — blocks the Cloudflare trademark form
- [ ] **Confirm signatory authority** — who files as rights holder or authorised agent
- [ ] Test purchase on one live cluster member to convert "impersonation" to "confirmed fraud" — repeat the Singapore distributor method, ideally in MY or ID
- [x] ~~Capture screenshots + HTML of all 10 live sites before submission~~ — done 2026-09-14, `evidence/capture-2026-09-14T07-41-54/`
- [ ] Check whether these domains are running paid social ads (Meta Ad Library, TikTok Creative Center)
- [ ] Notify Simon Nadler — this extends beyond APAC into UK and France
