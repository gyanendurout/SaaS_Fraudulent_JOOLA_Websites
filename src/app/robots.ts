import type { MetadataRoute } from 'next';

/**
 * Internal brand-protection tooling. Even where the deployment is publicly
 * reachable, it must not be indexed: the pages name domains under active
 * investigation, and a search-indexed copy would both tip off the operators and
 * make our assessments discoverable out of context.
 *
 * This complements the `robots: { index: false }` metadata in layout.tsx —
 * that covers crawlers that read the meta tag, this covers those that read
 * robots.txt first.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
