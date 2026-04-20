import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/theater_companion" : "",
  eslint: {
    dirs: ["src"],
  },
};

export default nextConfig;
