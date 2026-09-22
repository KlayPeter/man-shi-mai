import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import Brand from '@/components/Brand'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="page-container flex flex-col justify-between gap-8 py-12 sm:flex-row">
        <div><Link href="/" aria-label="面试麦首页"><Brand /></Link><p className="mt-4 text-sm text-muted">把每一次练习，变成下一次面试的底气。</p></div>
        <div className="flex gap-12 text-sm sm:gap-16">
          <div className="grid gap-1"><p className="mb-2 font-semibold text-ink">开始准备</p><Link className="footer-link" href="/interview/start">面试练习</Link><Link className="footer-link" href="/resume">我的简历</Link><Link className="footer-link" href="/history">练习记录</Link></div>
          <div className="grid gap-1"><p className="mb-2 font-semibold text-ink">了解更多</p><Link className="footer-link" href="/faq">常见问题</Link><Link className="footer-link" href="/contact">联系与反馈<ArrowUpRight size={14} aria-hidden="true" /></Link><Link className="footer-link" href="/profile?tab=redeem">账户与权益</Link></div>
        </div>
      </div>
      <div className="page-container flex flex-col justify-between gap-3 border-t border-line py-5 text-xs text-muted sm:flex-row"><p>© {new Date().getFullYear()} 面试麦 · 为更从容的下一次面试</p><div className="flex gap-6"><Link href="/agreement">服务协议</Link><Link href="/policy">隐私政策</Link></div></div>
    </footer>
  )
}
