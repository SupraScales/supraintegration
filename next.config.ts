import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Quote documents (drawings/specs) upload through a server action; the
      // app enforces its own 25 MB per-file limit with a readable message.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
