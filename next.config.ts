import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/theater_companion" : "",
  eslint: {
    dirs: ["src"],
  },
  webpack: (config) => {
    // kokoro-js / transformers.js uses onnxruntime-web in the browser;
    // exclude the Node.js variant so webpack doesn't try to bundle it.
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
