import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Tillåter att testerna (Playwright) når dev-servern via 127.0.0.1,
  // annars blockerar Next.js dev-resurser som HMR för den adressen.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
