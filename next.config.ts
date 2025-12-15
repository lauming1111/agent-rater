import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "media-exp1.licdn.com" },
      { protocol: "https", hostname: "media-exp2.licdn.com" },
      { protocol: "https", hostname: "static.licdn.com" },
    ],
  },
};

export default nextConfig;
