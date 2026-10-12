import type { NextConfig } from "next";

import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/auth/:path*`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  reloadOnOnline: false,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  workboxOptions: {
    runtimeCaching: [
      { urlPattern: /\/api\//, handler: "NetworkOnly" },
      {
        urlPattern: ({ request, sameOrigin, url }) =>
          sameOrigin &&
          !url.pathname.startsWith("/api/") &&
          request.headers.get("RSC") === "1",
        handler: "NetworkFirst",
        options: {
          cacheName: "app-route-data-v2",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 60 },
        },
      },
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "app-pages-v2",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 30 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: /\.(?:js|css|woff2?|png|svg|ico)(?:\?.*)?$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "app-assets-v2",
          expiration: { maxEntries: 150 },
        },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
