import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Limit ESLint to only the web code
  eslint: {
    dirs: ['src']
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
