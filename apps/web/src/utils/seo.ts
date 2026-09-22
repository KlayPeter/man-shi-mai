import { Metadata } from 'next'
import { SEO, PAGE_SEO_CONFIG, generateTitle, truncateDescription, absoluteUrl } from '@/constants/seo'

export function generatePageMetadata(pathname: string, customOptions?: {
  title?: string
  description?: string
  keywords?: string
  image?: string
  noIndex?: boolean
}): Metadata {
  const pageConfig: { title?: string; description?: string; keywords?: string } = PAGE_SEO_CONFIG[pathname] || {}
  const title = customOptions?.title || pageConfig.title || SEO.defaultTitle
  const description = customOptions?.description || pageConfig.description || SEO.defaultDescription
  const keywords = customOptions?.keywords || pageConfig.keywords || SEO.defaultKeywords
  const image = customOptions?.image || absoluteUrl(SEO.ogImage)
  const noIndex = customOptions?.noIndex || false

  return {
    title: generateTitle(title, false),
    description: truncateDescription(description),
    keywords,
    openGraph: {
      title,
      description: truncateDescription(description),
      url: absoluteUrl(pathname),
      images: [{ url: image, width: SEO.ogImageWidth, height: SEO.ogImageHeight }],
      siteName: SEO.siteName,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: truncateDescription(description),
      images: [image]
    },
    robots: noIndex ? 'noindex,nofollow' : 'index,follow'
  }
}
