import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Bangla used to live under /bn before it became the default site. Keep the
    // old addresses working so nothing already shared or indexed 404s.
    return [
      { source: "/bn", destination: "/", permanent: true },
      { source: "/bn/article/:slug", destination: "/article/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
