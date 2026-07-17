import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Ancienne URL française de la page tarifs
      { source: "/tarifs", destination: "/pricing", permanent: true },
    ];
  },
};

export default nextConfig;
