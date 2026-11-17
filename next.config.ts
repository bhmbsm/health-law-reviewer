import type { NextConfig } from "next";

// Fonts and art are fetched on every first paint. Let browsers keep them for a week
// instead of revalidating each visit; rename the file when its contents change.
const weekCache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/fonts/:file*", headers: weekCache },
      { source: "/art/:file*", headers: weekCache },
    ];
  },
};

export default nextConfig;
