/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mianshiwangoffer.com',
      },
      {
        protocol: 'https',
        hostname: 'lgdsunday.club',
      },
      {
        protocol: 'https',
        hostname: '*.aliyuncs.com',
      },
      {
        protocol: 'http',
        hostname: '*.aliyuncs.com',
      },
      {
        protocol: 'https',
        hostname: 'asset-mai.oss-cn-beijing.aliyuncs.com',
      },
    ],
    unoptimized: false,
  },
  async rewrites() {
    return [
      {
        source: '/dev-api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3000'}/:path*`,
      },
    ]
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })
    return config
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/dev-api',
    NEXT_PUBLIC_RESUME_PREVIEW_URL: process.env.NEXT_PUBLIC_RESUME_PREVIEW_URL || 'https://lgdsunday.club/',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
}

module.exports = nextConfig
