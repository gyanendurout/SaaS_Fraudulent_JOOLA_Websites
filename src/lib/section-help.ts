/**
 * Plain-English explanations behind each section's info button.
 *
 * Written for someone who has never seen this tool: what the section is, why
 * it matters, and what the important columns mean. Kept in one file so the
 * wording can be reviewed in one place.
 */

export interface SectionHelp {
  /** What this section shows, in one or two short sentences. */
  summary: string;
  /** Important columns or values, and what they mean. */
  columns?: Array<{ name: string; meaning: string }>;
  /** A caution about how to read it, when there is one worth giving. */
  note?: string;
}

const COMMON = {
  domain: { name: 'Domain', meaning: 'The website address. Click it for the full evidence page.' },
  website: { name: 'Website', meaning: 'Opens the real site in a new tab so you can see it yourself.' },
  added: {
    name: 'Added to DB',
    meaning: 'The day our scan first found this domain. This is our date, not the owner’s.',
  },
  registered: {
    name: 'Registered',
    meaning: 'The day someone bought this domain name, from the public registry.',
  },
  platform: {
    name: 'Platform',
    meaning: 'The shop software the site runs on, e.g. WooCommerce or Shopify.',
  },
  builder: {
    name: 'Builder',
    meaning:
      'The page-builder version found on the site. 3.35.6 (in red) is the exact version every site in the known fake-shop campaign uses.',
  },
  abuse: {
    name: 'Abuse contact',
    meaning: 'The email the domain seller publishes for complaints about domains they sold.',
  },
  registrar: { name: 'Registrar', meaning: 'The company that sold the domain name.' },
  status: { name: 'Status', meaning: 'Our current assessment, e.g. High risk, Offline, Legitimate.' },
  risk: {
    name: 'Risk',
    meaning:
      'A 0–100 score from automatic checks (age, pricing, build, hosting). Higher means more warning signs, not proof.',
  },
} as const;

export const SECTION_HELP = {
  newest: {
    summary:
      'The most recently bought domain names containing “joola”. Brand-new domains are a common sign of a fake shop being set up.',
    columns: [
      { name: 'Registered / “d old”', meaning: 'When the domain was bought, and how many days ago.' },
      COMMON.risk,
    ],
  },
  triage: {
    summary:
      'Live websites using “joola” in their name that are not part of the known fake-shop campaign. Someone needs to look at each one and decide what it is.',
    columns: [COMMON.domain, COMMON.registered, COMMON.platform, COMMON.registrar, COMMON.risk],
    note: 'Some of these may be genuine resellers or distributors. Check before treating any as fraud.',
  },
  gone: {
    summary:
      'Websites we had seen working that have now stopped. This is where sites that have been taken down show up.',
    columns: [
      COMMON.domain,
      COMMON.added,
      COMMON.registered,
      {
        name: 'Detected offline',
        meaning:
          'The first scan that found it down. It may have gone down earlier, any time after the scan before.',
      },
      { name: 'Days since', meaning: 'Days since we first saw it offline.' },
      COMMON.registrar,
    ],
    note: 'Offline does not say who took it down: a takedown, an expired domain and a paused site all look the same.',
  },
  estate: {
    summary:
      'JOOLA’s own official websites, confirmed by JOOLA. They are never scored or reported, and are listed so you can tell real from fake at a glance.',
  },
  campaign: {
    summary:
      'Sites that belong to the coordinated fake-shop campaign: same shop software, same exact page-builder version, same discount pattern. Strong sign of one operator behind them all.',
    columns: [
      COMMON.domain,
      COMMON.website,
      COMMON.added,
      COMMON.registered,
      COMMON.builder,
      COMMON.abuse,
      COMMON.status,
      COMMON.risk,
    ],
  },
  domainsTriage: {
    summary:
      'Live websites with “joola” in the name that are not part of the known campaign, waiting for someone to check them.',
    columns: [COMMON.domain, COMMON.website, COMMON.platform, COMMON.abuse, COMMON.status, COMMON.risk],
    note: 'Some may be genuine resellers or distributors. Check before treating any as fraud.',
  },
  domainsGone: {
    summary: 'Websites outside the campaign that we saw working before and that are now offline.',
    columns: [COMMON.domain, COMMON.website, COMMON.added, COMMON.status],
    note: 'Offline does not say who took it down.',
  },
  domainsNever: {
    summary:
      'Domain names with “joola” in them that exist but have never shown a working website to our scan. Often bought and parked, or not built yet.',
    columns: [COMMON.domain, COMMON.added, COMMON.registered, COMMON.registrar],
    note: 'Worth watching: a parked name can be turned into a shop at any time.',
  },
  domainsEstate: {
    summary: 'JOOLA’s own official websites. Never scored or reported.',
  },
  timeline: {
    summary:
      'Every campaign domain in the order it was bought. Bursts of purchases, and new domains bought soon after one was taken down, are what show it is one coordinated operator.',
  },
  registrars: {
    summary:
      'The campaign’s domains grouped by the company that sold them. Complaints go to each seller’s abuse email, so this is how a complaint would be split up.',
  },
  fingerprint: {
    summary:
      'The technical details every campaign site shares. Matching all of these together is very unlikely by chance, which is what links the sites to one operator.',
  },
  registry: {
    summary:
      'Public records about the domain: who sold it, when it was bought, when it expires, and where it is hosted.',
  },
  platform: {
    summary:
      'What the website is built with, read from the page itself. A match with the campaign’s exact build is a strong link to it.',
  },
  pricing: {
    summary:
      'Prices seen on the site. Fake shops typically show huge, round discounts on every product to rush buyers.',
    columns: [
      { name: 'Listed price', meaning: 'The “original” price shown crossed out.' },
      { name: 'Sale price', meaning: 'The price actually being asked.' },
      { name: 'Discount', meaning: 'How much cheaper the sale price is, as a percentage.' },
    ],
  },
  signals: {
    summary:
      'The automatic checks behind the risk score. Each one that is triggered adds to the score.',
  },
  siblings: {
    summary: 'Other domains in the same campaign as this one.',
  },
  takedown: {
    summary:
      'Draft complaint texts for the people who can remove the site. These are drafts only: nothing is sent from this page.',
    note: 'Verify the evidence and get approval before sending anything.',
  },
} satisfies Record<string, SectionHelp>;
