'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, ChevronDown, Menu, X, UserRound, LogOut } from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import Brand from '@/components/Brand'
import Button from '@/components/ui/Button'

const navigation = [
  { href: '/', label: '首页' },
  { href: '/interview/start', label: '面试练习' },
  { href: '/resume', label: '我的简历' },
  { href: '/history', label: '练习记录' },
]

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = useUserStore(s => s.isLogin)
  const userInfo = useUserStore(s => s.userInfo)
  const logout = useUserStore(s => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const userMenu = useRef<HTMLDetailsElement>(null)
  const mobileTrigger = useRef<HTMLButtonElement>(null)
  const loginHref = `/login${pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''}`

  useEffect(() => {
    setMenuOpen(false)
    if (userMenu.current) userMenu.current.open = false
  }, [pathname])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (menuOpen) { setMenuOpen(false); mobileTrigger.current?.focus() }
        if (userMenu.current?.open) { userMenu.current.open = false; userMenu.current.querySelector('summary')?.focus() }
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [menuOpen])

  useEffect(() => {
    if (confirmLogout) dialog.current?.showModal()
    else dialog.current?.close()
  }, [confirmLogout])

  return (
    <>
      <header className="site-header">
        <div className="page-container flex h-[76px] items-center justify-between gap-4">
          <Link href="/" aria-label="面试麦首页"><Brand /></Link>
          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
            {navigation.map(item => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}
                className={`nav-link ${pathname === item.href ? 'nav-link-active' : ''}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            {isLogin ? (
              <details ref={userMenu} className="relative hidden sm:block">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-800">{userInfo.username?.slice(0, 1) || <UserRound size={17} />}</span>
                  <span className="hidden max-w-24 truncate lg:inline">{userInfo.username || '我的账户'}</span><ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-line bg-white p-2 shadow-panel">
                  <Link className="menu-item" href="/profile">个人中心</Link>
                  <Link className="menu-item" href="/profile?tab=redeem">账户与权益</Link>
                  <button className="menu-item w-full gap-2 text-left" onClick={() => { if (userMenu.current) userMenu.current.open = false; setConfirmLogout(true) }}><LogOut size={16} />退出登录</button>
                </div>
              </details>
            ) : <Link href={loginHref} className="hidden min-h-11 items-center text-sm font-medium text-ink sm:flex">登录</Link>}
            <Link href="/interview/start" className="button-primary shrink-0 whitespace-nowrap !min-h-11 !px-3 !text-sm sm:!px-4">开始练习<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button ref={mobileTrigger} className="icon-button md:hidden" aria-label={menuOpen ? '收起导航' : '打开导航'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" aria-label="移动端导航" className="page-container grid gap-1 border-t border-line pb-4 pt-3 md:hidden">
          {navigation.map(item => <Link onClick={() => setMenuOpen(false)} className="menu-item" key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}
          <Link className="menu-item" href={isLogin ? '/profile' : loginHref} onClick={() => setMenuOpen(false)}>{isLogin ? '个人中心' : '登录 / 注册'}</Link>
          {isLogin && <button className="menu-item w-full text-left" onClick={() => { setMenuOpen(false); setConfirmLogout(true) }}>退出登录</button>}
        </nav>}
      </header>
      <dialog ref={dialog} onCancel={() => setConfirmLogout(false)} onClose={() => setConfirmLogout(false)} className="w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-line p-7 shadow-panel backdrop:bg-ink/40" aria-labelledby="logout-title">
        <h2 id="logout-title" className="text-xl font-bold">退出当前账号？</h2>
        <p className="mb-6 mt-3 text-sm text-muted">请先确认你的练习和简历修改已保存。</p>
        <div className="flex justify-end gap-3"><Button color="gray" variant="ghost" onClick={() => setConfirmLogout(false)}>取消</Button><Button onClick={() => { logout(); setConfirmLogout(false); router.push('/') }}>确定退出</Button></div>
      </dialog>
    </>
  )
}
