/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@dp/ui", "recharts"],
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  turbopack: {
    // Empty config - webpack fallbacks are handled automatically by Turbopack
  },
};

module.exports = nextConfig;

