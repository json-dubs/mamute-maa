import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "react-native",
    "react-native-web",
    "@mamute/ui",
    "@mamute/utils",
    "@mamute/types",
    "@mamute/config",
    "@mamute/api"
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web"
    };
    config.resolve.extensions = [
      ".web.ts",
      ".web.tsx",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json"
    ];
    return config;
  }
};

export default nextConfig;
