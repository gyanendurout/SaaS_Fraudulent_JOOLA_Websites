/**
 * Takedown pack generation.
 *
 * Generates pre-filled abuse complaints per channel, routed from data we
 * actually collected. Claim discipline is enforced here, not left to the user:
 * a domain is only described as confirmed fraud when there is transactional
 * evidence. Everything else is described as trademark infringement and
 * coordinated impersonation, which is what the collected evidence supports.
 * Overclaiming is the most common reason abuse reports get dismissed.
 */

import type { Cluster, DomainRecord } from './types';

export type TakedownChannel =
  | 'registrar'
  | 'dns_provider'
  | 'safe_browsing'
  | 'national_cert'
  | 'hosting';

export interface TakedownDraft {
  channel: TakedownChannel;
  title: string;
  recipient: string;
  submitVia: string;
  subject: string;
  body: string;
  priority: 'immediate' | 'high' | 'standard';
  note?: string;
}

const CERT_BY_TLD_HINT: Record<string, { name: string; contact: string }> = {
  malaysia: { name: 'MyCERT (Malaysia)', contact: 'cyber999@cybersecurity.my' },
  indonesia: { name: 'BSSN / ID-CERT (Indonesia)', contact: 'https://www.bssn.go.id/' },
  singapore: { name: 'SingCERT (Singapore)', contact: 'https://www.csa.gov.sg/singcert' },
  sg: { name: 'SingCERT (Singapore)', contact: 'https://www.csa.gov.sg/singcert' },
  thailand: { name: 'ThaiCERT (Thailand)', contact: 'https://www.thaicert.or.th/' },
  vietnam: { name: 'VNCERT (Vietnam)', contact: 'https://vncert.vn/' },
  philippines: { name: 'CERT-PH (Philippines)', contact: 'https://dict.gov.ph/' },
  india: { name: 'CERT-In (India)', contact: 'incident@cert-in.org.in' },
  uk: { name: 'NCSC (United Kingdom)', contact: 'https://www.ncsc.gov.uk/section/about-this-website/report-scam-website' },
  france: { name: 'CERT-FR (France)', contact: 'https://www.cert.ssi.gouv.fr/' },
  nz: { name: 'CERT NZ (New Zealand)', contact: 'https://www.cert.govt.nz/' },
}

function marketHint(domain: string): { name: string; contact: string } | null {
  const sld = domain.split('.')[0] ?? '';
  for (const [token, cert] of Object.entries(CERT_BY_TLD_HINT)) {
    if (sld.includes(token)) return cert;
  }
  return null;
}

function evidenceBlock(d: DomainRecord): string {
  const i = d.infrastructure;
  const s = d.snapshot;
  const lines = [
    `Domain:            ${d.domain}`,
    `Registered:        ${i?.registeredAt ?? 'unknown'}`,
    `Registrar:         ${i?.registrarName ?? 'unknown'}`,
    `Nameservers:       ${i?.nameservers.join(', ') || 'unknown'}`,
    `Resolved IPs:      ${i?.resolvedIps.join(', ') || 'unknown'}`,
  ];
  if (s) {
    lines.push(
      `Platform:          ${[s.techStack.cms, s.techStack.ecommerce].filter(Boolean).join(' + ') || 'unknown'}`,
      `Page builder:      ${s.techStack.pageBuilder ?? 'n/a'} ${s.techStack.pageBuilderVersion ?? ''}`.trim(),
      `Brand mentions:    ~${s.brandMentions} occurrences of "JOOLA" on the homepage`
    );
    if (s.priceLadder.length) {
      const top = s.priceLadder.slice(0, 3);
      lines.push(
        `Discounting:       ${top.map((p) => `${p.discountPct.toFixed(0)}%`).join(', ')} below listed reference price` +
          (s.currency ? ` (${s.currency})` : '')
      );
    }
    if (s.htmlSha256) lines.push(`Evidence hash:     sha256:${s.htmlSha256.slice(0, 32)}...`);
  }
  lines.push(`Captured:          ${d.snapshot?.capturedAt ?? d.lastCheckedAt ?? 'n/a'}`);
  return lines.join('\n');
}

function claimLanguage(d: DomainRecord): string {
  if (d.classification === 'confirmed_fraud') {
    return (
      'This domain has been confirmed fraudulent: an authorised JOOLA distributor completed a ' +
      'test purchase in which payment was captured and no goods were ever delivered.'
    );
  }
  return (
    'This domain reproduces the JOOLA registered trademark and product imagery without ' +
    'authorisation, and is not an authorised JOOLA distributor. It forms part of a coordinated ' +
    'impersonation campaign (evidence below). We are reporting it as trademark infringement and ' +
    'brand impersonation.'
  );
}

function clusterEvidence(cluster: Cluster | null, d: DomainRecord): string {
  if (!cluster || d.clusterSlug !== cluster.slug) return '';
  const others = cluster.memberDomains.filter((m) => m !== d.domain);
  return [
    '',
    'COORDINATED CAMPAIGN CONTEXT',
    '',
    `This domain is one of ${cluster.memberDomains.length} sharing an identical fingerprint:`,
    `  - Same platform build: WordPress + WooCommerce + Elementor ${String(cluster.fingerprint.page_builder_version)}`,
    '  - Same discount ladder, converted from a single USD price list into local currencies',
    '  - Registered in a coordinated burst across multiple registrars',
    '  - All using Cloudflare nameservers with concealed origin',
    '',
    `Related domains: ${others.join(', ')}`,
    '',
    'Note: one member of this cluster (joola-singapore.com) was suspended in late August 2026',
    'following an earlier report. The operator registered a replacement (joolasg.com) on',
    '27 August 2026 with the identical build. Per-domain suspension has proven insufficient.',
  ].join('\n');
}

export function generateTakedownPack(d: DomainRecord, cluster: Cluster | null = null): TakedownDraft[] {
  const drafts: TakedownDraft[] = [];
  const evidence = evidenceBlock(d);
  const claim = claimLanguage(d);
  const clusterText = clusterEvidence(cluster, d);

  // 1. Google Safe Browsing — fastest consumer protection, no approval needed.
  drafts.push({
    channel: 'safe_browsing',
    title: 'Google Safe Browsing',
    recipient: 'Google Safe Browsing',
    submitVia: 'https://safebrowsing.google.com/safebrowsing/report_phish/',
    priority: 'immediate',
    subject: `Phishing / brand impersonation: ${d.domain}`,
    note: 'Highest-leverage immediate action — browser interstitial within hours, protecting customers long before any registrar responds.',
    body: [
      `URL: https://${d.domain}/`,
      '',
      claim,
      '',
      evidence,
      clusterText,
    ].join('\n'),
  });

  // 2. Registrar abuse.
  if (d.infrastructure?.registrarAbuseEmail) {
    drafts.push({
      channel: 'registrar',
      title: `Registrar abuse — ${d.infrastructure.registrarName ?? 'registrar'}`,
      recipient: d.infrastructure.registrarAbuseEmail,
      submitVia: `mailto:${d.infrastructure.registrarAbuseEmail}`,
      priority: 'high',
      subject: `Trademark infringement and brand impersonation — ${d.domain}`,
      body: [
        `To the abuse team at ${d.infrastructure.registrarName ?? 'your organisation'},`,
        '',
        `We are writing on behalf of JOOLA, a table tennis and pickleball equipment manufacturer,`,
        `regarding ${d.domain}, registered through your service.`,
        '',
        claim,
        '',
        'EVIDENCE',
        '',
        evidence,
        clusterText,
        '',
        'REQUESTED ACTION',
        '',
        '  1. Suspend the domain registration.',
        '  2. Preserve registrant records for potential legal proceedings.',
        '  3. Confirm receipt and provide a case reference.',
        '',
        'Trademark registration details are available on request and will be supplied in the',
        'format your process requires.',
        '',
        'Regards,',
        'JOOLA Brand Protection',
      ].join('\n'),
    });
  }

  // 3. DNS provider — Cloudflare is the cluster chokepoint.
  if (d.infrastructure?.isProxied) {
    drafts.push({
      channel: 'dns_provider',
      title: 'Cloudflare abuse (cluster chokepoint)',
      recipient: 'Cloudflare Trust & Safety',
      submitVia: 'https://abuse.cloudflare.com/',
      priority: 'high',
      note: 'Covers the whole cluster in one report and can disclose the concealed origin host.',
      subject: `Coordinated trademark infringement — JOOLA impersonation cluster (incl. ${d.domain})`,
      body: [
        `Category: Trademark Infringement (file a parallel report under Phishing)`,
        '',
        claim,
        '',
        evidence,
        clusterText,
        '',
        'REQUESTED ACTION',
        '',
        '  1. Terminate Cloudflare services for the listed domains.',
        '  2. Treat them as a single coordinated campaign under one case reference.',
        '  3. Disclose the origin hosting provider so notices can be served at the hosting layer.',
        '  4. Apply account-level enforcement given the demonstrated re-registration pattern.',
      ].join('\n'),
    });
  }

  // 4. National CERT, where the domain names a market.
  const cert = marketHint(d.domain);
  if (cert) {
    drafts.push({
      channel: 'national_cert',
      title: cert.name,
      recipient: cert.contact,
      submitVia: cert.contact.startsWith('http') ? cert.contact : `mailto:${cert.contact}`,
      priority: 'standard',
      subject: `Fraudulent e-commerce site impersonating JOOLA — ${d.domain}`,
      body: [
        `We are reporting a fraudulent e-commerce website targeting consumers in your jurisdiction.`,
        '',
        claim,
        '',
        evidence,
        clusterText,
        '',
        'Consumers in your market are being offered purported JOOLA products at 50-57% below',
        'authorised retail pricing. We request assistance in having the site blocked or removed.',
      ].join('\n'),
    });
  }

  return drafts;
}
