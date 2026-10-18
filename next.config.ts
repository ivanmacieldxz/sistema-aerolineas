import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'https://bd6vj4dr-3000.brs.devtunnels.ms/',           // Your production domain
        'localhost:3000'            // Local development if proxying
      ],
    },
  },
};

export default nextConfig;
