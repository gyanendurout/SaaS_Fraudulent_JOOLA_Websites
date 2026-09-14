# Domain profile — 19 reported domains

**Compiled:** 2026-09-14 · **Source data:** `evidence/profile-2026-09-14.json`
**Method:** public registry (RDAP), public DNS, and the sites' own publicly served pages.

---

## Summary

The 19 domains are **not one group**. They split cleanly into two, and the split
matters because it changes who you report to and how confident the claim is.

| | Group A — July 2026 cluster | Group B — unrelated / mixed |
|---|---|---|
| Count | 11 | 8 |
| Registered | 20 Jul – 27 Aug **2026** | Sep 2024 – Aug 2026 |
| Registrars | Chinese / Hong Kong | GoDaddy, Namecheap, Dynadot, Hostinger, Name.com |
| Platform | WooCommerce, **Elementor 3.35.6** on all | Mixed Shopify / WooCommerce, no shared build |
| Discounts | Identical **57 / 50 / 30%** ladder | None detected |
| DNS | Cloudflare (11/11) | Mixed |
| Assessment | **One operator, coordinated** — high confidence | **Not one operator.** Individually unverified |

---

## Group A — the coordinated campaign (11 domains)

One operator running a cloned kit. Every live member serves WordPress +
WooCommerce with **Elementor 3.35.6** — the same point release — and the same
57/50/30% discount ladder converted from a single USD price list. Ten were
registered in a four-day burst, deliberately split across four registrars. All
use Cloudflare to conceal the origin host. Each declares itself as JOOLA's
national operation in its page title.

| Domain | Registered | Abuse contact | Status | Page title |
|---|---|---|---|---|
| joolauk.com | 2026-07-20 | abuse@kouming.com | Live | JOOLA UK \| JOOLA Pickleball Paddle Sale |
| joola-malaysia.com | 2026-07-21 | abuse3814@brandfocus.cn | Live | JOOLA Malaysia \| JOOLA Pickleball Paddle Sale |
| joola-philippines.com | 2026-07-22 | abuse@kouming.com | Live | JOOLA Philippines \| JOOLA Pickleball Paddle |
| joola-india.com | 2026-07-22 | abuse@kouming.com | Live | JOOLA India \| JOOLA Pickle Ball Paddle Sale |
| joolanz.com | 2026-07-22 | abuse@ordertld.com | Live | JOOLA NZ \| JOOLA Pickleball Paddle |
| joola-singapore.com | 2026-07-22 | abuse@kouming.com | **Dead** | — (suspended late Aug) |
| joolaindonesia.com | 2026-07-23 | abuse@kh86.cn | Live | JOOLA Indonesia \| JOOLA Pickleball Sale |
| joola-vietnam.com | 2026-07-23 | abuse@kh86.cn | Live | Joola Vietnam \| Vợt Pickleball |
| joola-thailand.com | 2026-07-23 | abuse@kh86.cn | Live | JOOLA Thailand \| JOOLA Pickleball Paddle |
| joolafrance.com | 2026-07-23 | abuse3814@brandfocus.cn | Live | JOOLA France \| JOOLA Tennis De Table |
| **joolasg.com** | **2026-08-27** | abuse3814@brandfocus.cn | Live | JOOLA Singapore \| JOOLA Essentials Paddle |

`joolasg.com` was registered the same week `joola-singapore.com` was suspended,
with the identical build — the operator replacing a removed domain.

`joolafrance.com` shows a different discount ladder (17/22/17%) but the same
Elementor build and registrar, so it remains in the cluster.

---

## Group B — everything else (8 domains)

These do **not** share the Group A fingerprint. Different registrars, different
platforms, different registration dates spanning two years, no common build, no
shared discount pattern. They are not the same operation, and they are probably
not one operation among themselves either.

| Domain | Registered | Registrar | Platform | Page title | Note |
|---|---|---|---|---|---|
| joolaphilippines.com | 2024-09-10 | GoDaddy | Shopify | PickleballPH \| Free Shipping Nationwide \| Official… | ⚠️ Presents as a PH retailer, not as JOOLA |
| joolaph.com | 2024-09-10 | GoDaddy | Shopify | PickleballPH \| Free Shipping Nationwide \| Official… | ⚠️ Same operator as above |
| joolaindia.com | 2025-07-03 | Hostinger | Shopify | Pickleball Paddle – **Sports Next Door** | ⚠️ Presents as a retailer, not as JOOLA |
| joolaau.com | 2025-10-09 | Name.com | Shopify | **Store Test VN** | Appears to be an unfinished test store |
| joolashop.shop | 2026-04-17 | Dynadot | WooCommerce | JOOLA – Erstklassiges Tischtennis-Equipment | German-language |
| joolaonline.shop | 2026-05-20 | Dynadot | WooCommerce | Erstklassiges Tischtennis-Equipment für Profis | German-language |
| joolasport.store | 2026-06-08 | Namecheap | Shopify | 404 Not Found – Joola-Sport | Not serving content |
| joola-pickleball.com | 2026-08-15 | Namecheap | Shopify | Joola Sport | — |

### Why this group needs checking before it is reported

Three of these present themselves as **named regional retailers**, not as JOOLA:

- **joolaphilippines.com / joolaph.com** — trade as "PickleballPH", registered
  September 2024 through GoDaddy, hosted on Shopify. That is a two-year-old
  business on mainstream infrastructure, describing itself as "Official".
- **joolaindia.com** — trades as "Sports Next Door", registered July 2025.

A genuine authorised distributor selling JOOLA products under its own shop name
would look exactly like this. So would an unauthorised reseller. The registry and
hosting data cannot tell those apart — **only JOOLA's distributor records can.**

Two more use German-language JOOLA branding (`joolashop.shop`,
`joolaonline.shop`), which for a German brand could be a reseller, a regional
partner, or a copycat.

**Recommendation:** check Group B against the authorised distributor list before
any of them is reported. Reporting an authorised or contracted partner as
fraudulent risks the commercial relationship and creates legal exposure for
JOOLA. Group A carries no such ambiguity.

---

## Rollup — abuse contacts

Where to send a complaint, and how many domains each covers.

| Count | Abuse contact | Registrar | Domains |
|---|---|---|---|
| 4 | abuse@kouming.com | Hongkong Kouming International Ltd | joolauk, joola-philippines, joola-india, joola-singapore |
| 3 | abuse3814@brandfocus.cn | Guizhou Zhongyu Zhike Network Tech | joola-malaysia, joolafrance, joolasg |
| 3 | abuse@kh86.cn | Vantage of Convergence (Chengdu) | joolaindonesia, joola-vietnam, joola-thailand |
| 2 | abuse@godaddy.com | GoDaddy.com, LLC | joolaphilippines, joolaph |
| 2 | abuse@namecheap.com | NameCheap, Inc. | joolasport.store, joola-pickleball |
| 2 | abuse@dynadot.com | Dynadot Inc. | joolaonline.shop, joolashop.shop |
| 1 | abuse@ordertld.com | CNOBIN Information Technology Ltd | joolanz |
| 1 | abuse-tracker@hostinger.com | HOSTINGER operations, UAB | joolaindia |
| 1 | abuse@name.com | Name.com, Inc. | joolaau |

**9 distinct abuse contacts.** Group A concentrates into **4** (10 of 11 domains).

---

## Rollup — platform and hosting

| Count | Platform | Domains |
|---|---|---|
| 12 | **WooCommerce** (self-hosted WordPress) | 10 Group A + joolaonline.shop, joolashop.shop |
| 6 | **Shopify** (hosted SaaS) | joolaindia, joolaphilippines, joolaph, joolasport.store, joolaau, joola-pickleball |
| 1 | Not responding | joola-singapore |

| Count | DNS / front | Domains |
|---|---|---|
| 13 | **Cloudflare** (origin concealed) | all 11 Group A + joolaonline.shop, joolashop.shop |
| 2 | GoDaddy (domaincontrol) | joolaphilippines, joolaph |
| 4 | Other / registrar-default | joolaindia, joolaau, joolasport.store, joola-pickleball |

| Count | Page builder | Domains |
|---|---|---|
| 11 | **Elementor 3.35.6** — identical release | all Group A |
| 8 | none detected | all Group B |

### What the platform split means for takedown

- **The 6 Shopify domains are the easiest to remove.** Shopify hosts them, so a
  single report to Shopify's brand-protection team covers the store directly —
  no registrar, no Cloudflare, no concealed origin. Shopify acts on verified
  trademark complaints. *(Subject to the Group B caveat above — confirm they are
  not authorised first.)*
- **The 12 WooCommerce domains are self-hosted behind Cloudflare**, so the origin
  host is hidden. These need the registrar route, or Cloudflare to disclose the
  origin.
- **Elementor 3.35.6 appearing on exactly the 11 Group A domains and nowhere else**
  is the single strongest piece of correlation evidence available.

---

## Counts at a glance

| Metric | Value |
|---|---|
| Domains reviewed | 19 |
| Live and serving | 17 |
| Not responding | 2 (joola-singapore, joolasport.store) |
| Confirmed coordinated campaign | 11 |
| Require distributor-list check | 8 |
| Distinct abuse contacts | 9 |
| Distinct registrars | 9 |
| On Cloudflare | 13 |
| On Shopify (easiest removal) | 6 |
