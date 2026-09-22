export const SEO = {
  siteUrl: 'https://mianshiwangoffer.com',
  siteName: '面试麦',
  siteNameEn: 'MianShiWang',
  defaultTitle: '面试麦 - AI智能面试平台 | 押题 · 模拟 · 行测 三大服务全覆盖',
  defaultDescription:
    '面试麦是专业的AI智能面试平台，提供程序员、产品经理、设计师、律师、医生等各职业的智能面试训练、模拟面试、面试题库和面试技巧。助力求职者提升面试能力，快速拿到心仪offer。',
  defaultKeywords:
    'AI面试,智能面试,面试训练,模拟面试,面试题库,程序员面试,产品经理面试,设计师面试,律师面试,医生面试,面试技巧,在线面试,面试准备,求职面试,面试麦',
  author: '面试麦团队',
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterSite: '@mianshiwang',
  contactEmail: 'contact@mianshiwangoffer.com',
  icp: '鲁 ICP 备 2025206060 号-1',
  companyName: '济南于思信息技术有限公司',
  companyAddress: '山东省济南市',
  locale: 'zh_CN',
  alternateLocales: ['zh_CN', 'en_US'],
  baiduSiteId: '',
  baiduVerification: 'codeva-6o8U6rhDTH',
  googleVerification: 'AGuYDOPXYXlsuFtFtW-AoibR4JrW8AnoRGmvoD2Gb_w',
  bingVerification: 'B30BA2B4BE274FC862D5D489A48B7EC0',
  so360Verification: '8d732d5c4e2d72ea393735ddbc0286ed',
}

export const absoluteUrl = (path: string, base = SEO.siteUrl) => {
  if (!path) return base
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const cleanBase = base.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}

export const generateTitle = (pageTitle?: string, withSuffix = true) => {
  if (!pageTitle) return SEO.defaultTitle
  return withSuffix ? `${pageTitle} - ${SEO.siteName}` : pageTitle
}

export const truncateDescription = (description: string, maxLength = 160) => {
  if (!description) return SEO.defaultDescription
  if (description.length <= maxLength) return description
  return description.substring(0, maxLength - 3) + '...'
}

export const PAGE_SEO_CONFIG: Record<
  string,
  { title: string; description: string; keywords: string }
> = {
  '/': {
    title: '面试麦 - AI智能面试平台 | 在线面试训练与题库',
    description:
      '面试麦是专业的AI智能面试平台，提供程序员、产品经理、设计师等各职业的智能面试训练、模拟面试和面试题库。助力求职者提升面试能力，快速拿到心仪offer。',
    keywords: 'AI面试,智能面试,面试训练,模拟面试,面试题库,在线面试,面试麦',
  },
  '/interview': {
    title: '开始面试',
    description:
      '选择您的职业和岗位，开始AI智能面试训练，提升面试技巧，获得专业的面试反馈和建议。',
    keywords: 'AI面试,智能面试,模拟面试,面试训练,面试准备',
  },
  '/history': {
    title: '面试历史',
    description: '查看您的历史面试记录，分析面试表现，持续提升面试能力。',
    keywords: '面试记录,面试历史,面试分析',
  },
  '/profile': {
    title: '个人中心',
    description: '管理您的个人信息、简历和会员服务。',
    keywords: '个人中心,用户中心,简历管理',
  },
  '/faq': {
    title: '常见问题',
    description: '面试麦平台常见问题解答，帮助您更好地使用AI面试训练服务。',
    keywords: '常见问题,帮助中心,使用指南',
  },
  '/contact': {
    title: '联系我',
    description: '联系我。',
    keywords: '联系我,让我和你合作加入你们',
  },
}

export const jsonLdWebsite = (seo = SEO) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: seo.siteName,
  alternateName: seo.siteNameEn,
  url: seo.siteUrl,
  description: seo.defaultDescription,
  inLanguage: 'zh-CN',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${seo.siteUrl}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
})

export const jsonLdOrganization = (seo = SEO) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: seo.companyName || seo.siteName,
  alternateName: seo.siteNameEn,
  url: seo.siteUrl,
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl(seo.ogImage),
    width: seo.ogImageWidth,
    height: seo.ogImageHeight,
  },
  description: seo.defaultDescription,
  email: seo.contactEmail,
  address: seo.companyAddress
    ? {
        '@type': 'PostalAddress',
        addressCountry: 'CN',
        addressLocality: seo.companyAddress,
      }
    : undefined,
  sameAs: [].filter(Boolean),
})

export const generateMetaTags = (
  options: {
    title?: string
    description?: string
    keywords?: string
    image?: string
    url?: string
    type?: string
    author?: string
    publishTime?: string
    modifiedTime?: string
    noIndex?: boolean
  } = {},
) => {
  const {
    title = SEO.defaultTitle,
    description = SEO.defaultDescription,
    keywords = SEO.defaultKeywords,
    image = absoluteUrl(SEO.ogImage),
    url = SEO.siteUrl,
    type = 'website',
    author = SEO.author,
    publishTime,
    modifiedTime,
    noIndex = false,
  } = options

  const metaTags = [
    { charset: 'utf-8' },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, maximum-scale=5',
    },
    { name: 'description', content: truncateDescription(description) },
    { name: 'keywords', content: keywords },
    { name: 'author', content: author },
    {
      name: 'robots',
      content: noIndex
        ? 'noindex,nofollow'
        : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
    },
    {
      name: 'googlebot',
      content: noIndex ? 'noindex,nofollow' : 'index,follow',
    },
    { name: 'bingbot', content: noIndex ? 'noindex,nofollow' : 'index,follow' },
    {
      name: 'baiduspider',
      content: noIndex ? 'noindex,nofollow' : 'index,follow',
    },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: SEO.siteName },
    { property: 'og:title', content: title },
    { property: 'og:description', content: truncateDescription(description) },
    { property: 'og:url', content: absoluteUrl(url) },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(SEO.ogImageWidth) },
    { property: 'og:image:height', content: String(SEO.ogImageHeight) },
    { property: 'og:locale', content: SEO.locale },
    { name: 'twitter:card', content: SEO.twitterCard },
    { name: 'twitter:site', content: SEO.twitterSite },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: truncateDescription(description) },
    { name: 'twitter:image', content: image },
    { name: 'format-detection', content: 'telephone=no' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: SEO.siteName },
    { name: 'application-name', content: SEO.siteName },
    { name: 'baidu-site-verification', content: SEO.baiduVerification || '' },
    { name: 'mobile-agent', content: 'format=html5;url=' + absoluteUrl(url) },
    { name: 'google-site-verification', content: SEO.googleVerification || '' },
    { name: 'msvalidate.01', content: SEO.bingVerification || '' },
    { name: '360-site-verification', content: SEO.so360Verification || '' },
    { 'http-equiv': 'Cache-Control', content: 'no-transform' },
    { 'http-equiv': 'Cache-Control', content: 'no-siteapp' },
    {
      name: 'copyright',
      content: `Copyright © ${new Date().getFullYear()} ${SEO.siteName}`,
    },
  ]

  if (publishTime) {
    metaTags.push({ property: 'article:published_time', content: publishTime })
  }
  if (modifiedTime) {
    metaTags.push({ property: 'article:modified_time', content: modifiedTime })
    metaTags.push({ property: 'og:updated_time', content: modifiedTime })
  }

  return metaTags
}
