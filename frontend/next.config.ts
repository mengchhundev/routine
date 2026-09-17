import type { NextConfig } from "next";

// The browser never talks to Spring Boot directly: every call goes through a
// Next route handler, so tokens can live in httpOnly cookies instead of JS.
const config: NextConfig = {
  reactStrictMode: true,
  // Required by the production Docker stage, which runs .next/standalone.
  output: "standalone",
  poweredByHeader: false,
};

export default config;
