import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    dirs: ["src"],
  },
  // pdf-parse uses a hybrid CJS/ESM package that webpack cannot bundle correctly.
  // Marking it as external tells Next.js to let Node.js require() it at runtime
  // instead of bundling it, which prevents the HTML 500 / JSON parse error.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
