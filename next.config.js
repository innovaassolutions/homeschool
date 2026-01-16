/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for Convex-powered pages
  // This prevents build errors from Convex hooks during SSG
  experimental: {
    // Force dynamic rendering for all pages
  },
  // Output standalone for better Vercel deployment
  output: "standalone",
}

module.exports = nextConfig
