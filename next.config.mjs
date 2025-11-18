/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 完全禁用Analytics调试信息
  experimental: {
    analytics: false,
  },
}

export default nextConfig
