import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "https://kharchabaki.onrender.com/api/auth/:path*"
      }
    ]
  }
};

export default nextConfig;
