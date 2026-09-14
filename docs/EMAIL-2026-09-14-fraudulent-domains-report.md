# DRAFT EMAIL — internal report

> **STATUS: DRAFT. NOT SENT.**
> Nothing has been sent to anyone, internally or externally. No abuse report,
> registrar complaint or takedown request has been filed. This file is a draft
> for review and release by the owner of the issue.
>
> Prepared 2026-09-14 · Evidence: `evidence/recon-2026-09-14.json`, `evidence/capture-2026-09-14T07-41-54/`

---

**To:** Aaron Kim; Tom Nguyen; Olivia Wang
**Cc:** Simon Nadler; Hui Li Ng; Sabrina Huang
**Subject:** Re: Alert: Fraudulent JOOLA Websites in Southeast Asia — it is 11 domains, not 3, and Singapore is back

---

Aaron, Tom, Olivia,

Following up on Aaron's alert. We ran a full sweep against the domain registry,
DNS and the sites themselves. The situation is materially larger than the three
sites in the original thread.

**Three findings that change the picture:**

1. **There are 11 impersonation domains, not 3.** Ten are live and taking orders
   right now. Eight of them had not been reported by anyone.

2. **The Singapore site is back.** `joola-singapore.com` was taken down in late
   August. On **27 August the same operator registered `joolasg.com`** and put up
   an identical site serving the Singapore market in SGD. It is live today. The
   takedown worked; it just did not stop them.

3. **This is not only Southeast Asia.** The earliest domain in the campaign is
   `joolauk.com` (20 July), and `joolafrance.com` covers France. Simon — flagging
   directly, as this sits outside APAC's remit.

All ten live sites are the same operation, not coincidence. They run an identical
website build, show the same discount ladder converted from a single price list
into each local currency, and were registered in a coordinated four-day burst
across four different registrars. Evidence is in the appendix.

## The domains

| Registered | Domain | Market | Status |
|---|---|---|---|
| 2026-07-20 | joolauk.com | United Kingdom | **Live** |
| 2026-07-21 | joola-malaysia.com | Malaysia | **Live** *(known)* |
| 2026-07-22 | joola-india.com | India | **Live** |
| 2026-07-22 | joola-philippines.com | Philippines | **Live** |
| 2026-07-22 | joolanz.com | New Zealand | **Live** |
| 2026-07-22 | joola-singapore.com | Singapore | Down *(known)* |
| 2026-07-23 | joolaindonesia.com | Indonesia | **Live** *(known)* |
| 2026-07-23 | joola-vietnam.com | Vietnam | **Live** |
| 2026-07-23 | joola-thailand.com | Thailand | **Live** |
| 2026-07-23 | joolafrance.com | France | **Live** |
| **2026-08-27** | **joolasg.com** | Singapore | **Live — replacement** |

Our own domains — joola.com, joolausa.com, joola.de — are unaffected and were
confirmed separately so they are never caught up in any action we take.

## What is proven, and what is not

Being precise here, because it determines what we can assert.

- **Proven fraudulent: `joola-singapore.com` only.** Our Singapore distributor's
  test purchase went through, payment was captured, nothing was delivered.
- **Proven for the other ten: coordinated impersonation and unauthorised
  trademark use.** They copy our brand, our product photography and our product
  names, and none is an authorised distributor. We have not test-purchased from
  them, so we should not describe them as confirmed payment fraud.

That distinction matters. Overstating the claim is the most common reason abuse
reports get rejected, and the impersonation case on its own is strong.

## Evidence is secured

We captured full screenshots, the served page code, and cryptographic hashes of
all ten live sites on 14 September, with timestamps. This was done **before any
report is filed**, so the evidence survives even after the sites are removed.

One detail worth seeing: each site declares itself in its page title as
*"JOOLA UK"*, *"JOOLA Malaysia"*, *"JOOLA Singapore"* and so on. These are not
retailers referencing our brand — each one presents itself as JOOLA's official
operation for that country.

## What we need to decide

Nothing has been filed yet. Two things are needed before anything can be:

1. **Trademark registration numbers** for the affected markets — UK, FR, SG, MY,
   ID, TH, VN, PH, IN, NZ. Every abuse process asks for these first. Who owns
   this on the legal side?
2. **Who signs.** Reports must come from the rights holder or an authorised
   agent. Simon, is this you or external counsel?

## Suggested immediate step, pending the above

**Report the ten live domains to Google Safe Browsing.** It is free, needs no
trademark documentation, and typically puts a full-page warning in front of
Chrome, Safari and Firefox users within hours. It protects customers straight
away while the formal route is being decided, and it is reversible if we ever
needed it to be.

One planning point from the joolasg.com episode: taking domains down one at a
time has already been shown not to work. Whatever route we choose should treat
these as a single campaign rather than eleven separate complaints.

Happy to walk anyone through the detail.

Gyanendu

---

## Appendix — evidence of coordination

**1. Identical website build.** All ten live sites run WordPress + WooCommerce
with Elementor **version 3.35.6** — the same specific release on every site, with
page sizes within 15% of each other. Independently built sites do not match to
the point release.

**2. One price list, converted per market.** The same discount pattern appears on
every site, converted from a single US dollar price list:

| Item | Vietnam (USD) | Singapore (SGD) | Thailand (THB) | Discount |
|---|---|---|---|---|
| 1 | 299.95 → 128.00 | 382.19 → 163.09 | 9,755.54 → 4,163.06 | −57% |
| 2 | 229.95 → 114.97 | 293.00 → 146.49 | 7,478.87 → 3,739.27 | −50% |
| 3 | 99.95 → 69.97 | 127.35 → 89.15 | 3,250.76 → 2,275.70 | −30% |

299.95 USD × 1.274 = 382.19 SGD, and × 32.52 = 9,755.54 THB — consistent exchange
rates applied across all three, confirming one shared product catalogue.

**3. Coordinated registration.** Ten of the eleven domains were registered
between 20 and 23 July 2026, deliberately spread across four separate registrars
— a standard tactic so that suspension at one registrar does not remove the
whole operation.

| Registrar | Abuse contact | Domains |
|---|---|---|
| Hongkong Kouming International Ltd | abuse@kouming.com | joolauk, joola-india, joola-philippines, joola-singapore |
| Guizhou Zhongyu Zhike Network Tech | abuse3814@brandfocus.cn | joola-malaysia, joolafrance, joolasg |
| Vantage of Convergence (Chengdu) | abuse@kh86.cn | joolaindonesia, joola-vietnam, joola-thailand |
| CNOBIN Information Technology Ltd | abuse@ordertld.com | joolanz |

**4. Shared infrastructure.** All eleven use Cloudflare nameservers, which
conceals where the sites are actually hosted.

**5. Trademark use.** Approximately 1,850 uses of the JOOLA name per homepage on
each site, alongside our product photography and product names.

### Evidence files

| Item | Location |
|---|---|
| Registry, DNS and platform data | `evidence/recon-2026-09-14.json` |
| Screenshots, page code, hashes | `evidence/capture-2026-09-14T07-41-54/` |
| Capture manifest (UTC timestamps) | `evidence/capture-2026-09-14T07-41-54/manifest.json` |

### Note on method

Findings come from public registry records (RDAP), public DNS, public
certificate records, and the sites' own publicly served pages. No access was
attempted beyond what any visitor's browser receives, and no purchase was made.
