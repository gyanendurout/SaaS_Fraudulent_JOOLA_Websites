import type { TechStack, PricePair, FraudSignal, Verdict } from './fingerprint';
import type { MatchKind } from './domain-match';

export type Classification =
  | 'legitimate'
  | 'suspect'
  | 'confirmed_fraud'
  | 'dismissed'
  | 'unreachable';

export type DiscoverySource =
  | 'certstream'
  | 'crt_sh'
  | 'dns_permutation'
  | 'web_search'
  | 'manual'
  | 'partner_report';

export interface Infrastructure {
  registrarName: string | null;
  registrarIanaId: number | null;
  registrarAbuseEmail: string | null;
  registrarAbusePhone: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  domainStatus: string[];
  nameservers: string[];
  dnsProvider: string | null;
  resolvedIps: string[];
  isProxied: boolean;
}

export interface Snapshot {
  capturedAt: string;
  httpStatus: number | null;
  finalUrl: string | null;
  responseHeaders: Record<string, string>;
  htmlSha256: string | null;
  htmlBytes: number | null;
  techStack: TechStack;
  currency: string | null;
  priceLadder: PricePair[];
  brandMentions: number;
}

export interface DomainRecord {
  domain: string;
  matchKind: MatchKind | null;
  matchedIn: 'registrable' | 'subdomain' | null;
  classification: Classification;
  discoverySource: DiscoverySource;
  isLive: boolean;
  firstSeenAt: string;
  lastCheckedAt: string | null;
  takenDownAt: string | null;
  notes: string | null;
  infrastructure: Infrastructure | null;
  snapshot: Snapshot | null;
  /** Computed */
  signals: FraudSignal[];
  riskScore: number;
  verdict: Verdict;
  clusterSlug: string | null;
  priority: number;
}

export interface Cluster {
  slug: string;
  label: string;
  firstSeenAt: string;
  status: 'active' | 'partially_mitigated' | 'mitigated' | 'dormant';
  fingerprint: Record<string, unknown>;
  notes: string;
  memberDomains: string[];
}

export interface DiscoveryRun {
  runType: string;
  status: string;
  candidatesTested: number;
  candidatesResolved: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface Dataset {
  generatedAt: string;
  source: 'fixture' | 'supabase';
  domains: DomainRecord[];
  clusters: Cluster[];
  runs: DiscoveryRun[];
}
