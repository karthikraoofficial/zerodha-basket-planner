import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // data/*.json is read at request time with fs; ship it with every server function.
  outputFileTracingIncludes: { "/**": ["./data/**"] },
};

export default nextConfig;
