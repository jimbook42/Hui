import type { MetadataRoute } from "next";

import { getHuiWebManifest } from "@/lib/pwa/manifest";

export default function manifest(): MetadataRoute.Manifest {
  return getHuiWebManifest();
}
