import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "aiAUDIT by aiNOW",
    short_name: "aiAUDIT",
    description:
      "Evidence-bound AI-fit diagnostics for real business workflows. A pilot, measurement step or not_now conclusion.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfc",
    theme_color: "#18181b",
    icons: [
      { src: "/icon.svg?v=17-20260811", type: "image/svg+xml", sizes: "any" },
    ],
  };
}
