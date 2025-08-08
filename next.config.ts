import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    appIsrStatus: false, // disables ISR indicator
    buildActivity: false, // disables top-right build bar
  },
};

export default nextConfig;
