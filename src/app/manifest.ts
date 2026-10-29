import type { MetadataRoute } from "next";

/** Lets the site be installed and gives phones the right icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emulix",
    short_name: "Emulix",
    description: "Test and optimize your site on real devices.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f2e",
    theme_color: "#0d0f2e",
    icons: [
      { src: "/brand/emulix-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/emulix-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/emulix-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
