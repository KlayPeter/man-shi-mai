'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import SvgIcon from '@/components/SvgIcon'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import Image from 'next/image'

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userStore = useUserStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const handleLogout = () => {
    userStore.logout()
    setShowLogoutModal(false)
    router.push('/')
  }

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')
  const loginHref = `/login${pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''}`

  return (
    <>
      <header
        className={`w-full sticky top-0 z-50 border-b border-gray-200 bg-white/70 backdrop-blur supports-backdrop-filter:bg-white/50 ${
          scrolled ? 'shadow-sm bg-white/80 backdrop-blur' : ''
        }`}
      >
        <div className="container px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="面试麦"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <Link href="/" className="text-xl font-semibold text-neutral-900">
              面试麦
            </Link>
            <span className="hidden sm:inline-block text-xs text-neutral-500 translate-y-px">
              押题·模拟·行测 三位一体
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-600">
            <Link
              href="/interview/start"
              className={`transition-colors ${
                isActive('/interview/start')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              开启 AI 服务
            </Link>
            <Link
              href="/resume"
              className={`transition-colors ${
                isActive('/resume')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              简历中心
            </Link>
            <Link
              href="/history"
              className={`transition-colors ${
                isActive('/history')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              服务记录
            </Link>
            <Link
              href="/profile?tab=redeem"
              className={`transition-colors ${
                isActive('/profile')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              兑换服务
            </Link>
            <Link
              href="/faq"
              className={`transition-colors ${
                isActive('/faq')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              常见问题
            </Link>
            <Link
              href="/contact"
              className={`transition-colors ${
                isActive('/contact')
                  ? 'text-neutral-900 font-bold'
                  : 'hover:text-neutral-900'
              }`}
            >
              关于我
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {!userStore.isLogin ? (
              <Link
                href={loginHref}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                登录
              </Link>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {userStore.userInfo.avatar ? (
                    <Image
                      src={userStore.userInfo.avatar}
                      alt={userStore.userInfo.username || '用户头像'}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <Icon
                        name="i-heroicons-user"
                        className="w-5 h-5 text-primary-600"
                      />
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {userStore.userInfo.username || '未命名用户'}
                  </span>
                  <Icon name="i-heroicons-chevron-down" className="w-4 h-4" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    <Link
                      href="/resume"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Icon
                        name="i-heroicons-document-text"
                        className="w-4 h-4 inline mr-2"
                      />
                      简历中心
                    </Link>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Icon
                        name="i-heroicons-user"
                        className="w-4 h-4 inline mr-2"
                      />
                      个人中心
                    </Link>
                    <Link
                      href="/history"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Icon
                        name="i-heroicons-chart-bar"
                        className="w-4 h-4 inline mr-2"
                      />
                      服务记录
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        setShowLogoutModal(true)
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Icon
                        name="i-heroicons-arrow-left-on-rectangle"
                        className="w-4 h-4 inline mr-2"
                      />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              是否确定退出当前账号？
            </h3>
            <p className="text-gray-600 mb-6">未保存的面试进度可能不会保留。</p>
            <div className="flex gap-2 justify-end">
              <Button
                color="gray"
                variant="ghost"
                onClick={() => setShowLogoutModal(false)}
              >
                取消
              </Button>
              <Button color="primary" onClick={handleLogout}>
                确定退出
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
