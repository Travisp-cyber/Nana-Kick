import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Limit ESLint to only the web code
  eslint: {
    dirs: ['src']
  },
  async redirects() {
    return [
      // Always send / to /discover at the edge (stronger than any old client code)
      { source: '/', destination: '/discover', permanent: false },
    ]
  },
  // CORS is handled dynamically in middleware to support Whop iframe origins
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
