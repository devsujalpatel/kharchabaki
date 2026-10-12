import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KharchaBaki",
    short_name: "KharchaBaki",
    description: "Track your income, expenses and loans",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090b09",
    theme_color: "#090b09",
    orientation: "portrait",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
