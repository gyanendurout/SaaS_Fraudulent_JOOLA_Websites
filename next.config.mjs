/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evidence fetching happens server-side only; no remote images are rendered.
  images: { remotePatterns: [] },
};

export default nextConfig;
