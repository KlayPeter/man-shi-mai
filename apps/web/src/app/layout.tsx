import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SEO, jsonLdWebsite, jsonLdOrganization, absoluteUrl } from '@/constants/seo'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: SEO.defaultTitle,
    template: '%s'
  },
  description: SEO.defaultDescription,
  keywords: SEO.defaultKeywords,
  authors: [{ name: SEO.author }],
  icons: {
    icon: '/logo.png',
    apple: '/apple-touch-icon.png'
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: SEO.siteName,
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    url: SEO.siteUrl,
    images: [
      {
        url: absoluteUrl(SEO.ogImage),
        width: SEO.ogImageWidth,
        height: SEO.ogImageHeight,
        alt: SEO.siteName
      }
    ],
    locale: SEO.locale
  },
  twitter: {
    card: 'summary_large_image',
    site: SEO.twitterSite,
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    images: [absoluteUrl(SEO.ogImage)]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  verification: {
    google: SEO.googleVerification,
    other: {
      'baidu-site-verification': SEO.baiduVerification,
      'msvalidate.01': SEO.bingVerification,
      '360-site-verification': SEO.so360Verification
    }
  },
  other: {
    'mobile-agent': `format=html5;url=${SEO.siteUrl}`
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" prefix="og: http://ogp.me/ns#">
      <head>
        <link rel="canonical" href={SEO.siteUrl} />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://hm.baidu.com" />
        <link rel="preconnect" href={SEO.siteUrl} />
        <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SEO.siteName} />
        <meta name="application-name" content={SEO.siteName} />
        <meta httpEquiv="Cache-Control" content="no-transform" />
        <meta httpEquiv="Cache-Control" content="no-siteapp" />
        <meta name="copyright" content={`Copyright © ${new Date().getFullYear()} ${SEO.siteName}`} />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdWebsite(SEO))
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdOrganization(SEO))
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
