/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Tenant resolution reads the Host header, so pages that depend on it are
  // rendered dynamically. Kept explicit so the trade-off is visible.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
