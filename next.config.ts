import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Tailscale Funnel host to hit dev assets and post Server Actions.
  allowedDevOrigins: ["my-pc-windows.tail56f1b2.ts.net"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "my-pc-windows.tail56f1b2.ts.net",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
