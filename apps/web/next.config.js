/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
