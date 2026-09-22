import React from 'react'
import { Metadata } from 'next'
import { generatePageMetadata } from '@/utils/seo'

export const metadata: Metadata = generatePageMetadata('/policy', {
  title: '隐私政策',
  description: '面试麦平台隐私政策全文'
})

export default function PolicyPage() {
  const lastUpdated = '2025 年 11 月 18 日'

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">隐私政策</h1>
        <p className="mt-3 text-sm text-neutral-500">
          最后更新：{lastUpdated}
        </p>
      </div>

      <div className="prose prose-neutral prose-sm max-w-none">
        <h2>一、信息收集</h2>
        <p>
          我们可能收集您在使用服务过程中主动提供的个人信息，以及在使用过程中的日志数据、设备信息等，用于保障服务稳定与优化体验。
        </p>

        <h2>二、信息使用</h2>
        <p>
          我们使用收集的信息用于身份验证、功能提供、服务优化与安全防护，不会在未获授权的情况下对外提供可识别个人的信息。
        </p>

        <h2>三、信息共享与披露</h2>
        <p>
          除法律法规、监管要求或履行必要的服务支持外，我们不会将您的个人信息出售或共享给无关第三方。
        </p>

        <h2>四、数据安全</h2>
        <p>
          我们采用合理的安全措施保护数据安全，包括访问控制、加密传输与安全审计，但仍建议您妥善保管账户与凭证。
        </p>

        <h2>五、您的权利</h2>
        <p>
          您有权访问、更正或删除自己的个人信息，并可通过站点提供的联系方式与我们取得联系处理相关请求。
        </p>

        <h2>六、政策更新</h2>
        <p>
          我们可能不时更新本政策，重大变更将通过站点公告或邮件提示。继续使用服务即视为您接受更新后的政策。
        </p>

        <h2>七、联系与投诉</h2>
        <p>
          如需咨询或投诉，请通过站点页面的联系方式与我们取得联系：
          <a className="text-primary-600 hover:underline ml-1" href="mailto:kt_mmxyy2377@qq.com">
            kt_mmxyy2377@qq.com
          </a>
        </p>
      </div>
    </section>
  )
}
