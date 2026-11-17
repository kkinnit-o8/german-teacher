import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "German Teacher",
    short_name: "German",
    description: "Learn German every day with your own AI teacher.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#6d28d9",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
