import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
