'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Quote } from 'lucide-react'
import Brand from '@/components/Brand'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'

function LoginEmailPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userStore = useUserStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agree, setAgree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setEmail('')
    setPassword('')
    setUsername('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agree) {
      toast({ title: '请先同意服务协议和隐私政策', color: 'yellow' })
      return
    }
    if (isRegister && username.length < 3) {
      toast({ title: '用户名至少需要3个字符', color: 'yellow' })
      return
    }
    setLoading(true)
    setError('')
    try {
      const endpoint = isRegister ? '/user/register' : '/user/login'
      const body = isRegister
        ? { email, password, username }
        : { email, password }
      const res = await fetch(`/dev-api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await res.json()

      const isSuccess = raw.code === 200 || (res.ok && !('code' in raw))

      if (isSuccess) {
        if (isRegister) {
          // 注册成功：只需要成功响应，不需要 token
          toast({ title: '注册成功', description: '请使用邮箱和密码登录', color: 'green' })
          // 切换到登录模式
          setIsRegister(false)
          setPassword('')
          setUsername('')
        } else {
          // 登录成功：需要 token 和用户信息
          const payload =
            (raw.data?.user && raw.data?.token) ? raw.data :
            (raw.user && raw.token) ? raw :
            null

          if (payload) {
            userStore.setIsLogin(true)
            userStore.updateUserInfo(payload.user)
            userStore.setToken(payload.token)
            toast({ title: '登录成功', color: 'green' })
            const redirectRaw = searchParams.get('redirect')
            const redirectTo = redirectRaw && redirectRaw.startsWith('/') && !redirectRaw.startsWith('//') ? redirectRaw : '/'
            setTimeout(() => router.replace(redirectTo), 500)
          } else {
            const msg = '登录响应格式错误'
            setError(msg)
            toast({ title: '登录失败', description: msg, color: 'red' })
          }
        }
      } else {
        const msg = raw.message || raw.error || (isRegister ? '注册失败，请重试' : '邮箱或密码错误')
        setError(msg)
        toast({ title: isRegister ? '注册失败' : '登录失败', description: msg, color: 'red' })
      }
    } catch (err: any) {
      const msg = err.message || '网络异常，请稍后重试'
      setError(msg)
      toast({ title: '请求失败', description: msg, color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">{isRegister ? '注册账号' : '邮箱登录'}</h2>
          <p className="mt-3 text-sm text-muted">{isRegister ? '创建账号，开始你的第一场面试练习。' : '继续准备，离心仪的机会更近一步。'}</p>
        </div>
      </div>

      <div className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          {isRegister && (
            <div>
              <label htmlFor="username" className="field-label">用户名</label>
              <input
                id="username"
                autoComplete="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名（至少3个字符）"
                className="field-input"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="field-label">邮箱地址</label>
            <input
              id="email"
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">密码</label>
            <input
              id="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="field-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="button-primary mt-6 w-full disabled:opacity-60"
          >
            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button type="button" disabled={loading} onClick={toggleMode} className="min-h-11 text-sm font-medium text-primary-600 hover:underline disabled:opacity-60">
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 text-xs text-muted">
        <input
          type="checkbox"
          id="agree"
          checked={agree}
          onChange={e => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="agree" className="leading-[20px] cursor-pointer">
          继续即表示你已阅读并同意{' '}
          <Link href="/agreement" target="_blank" className="text-primary-600 hover:underline">《服务协议》</Link>
          {' '}和{' '}
          <Link href="/policy" target="_blank" className="text-primary-600 hover:underline">《隐私政策》</Link>
        </label>
      </div>
    </div>
  )
}

export default function LoginPageContent() {
  return (
    <main className="login-shell">
      <section className="login-story">
        <Link href="/" className="relative z-10 w-fit" aria-label="面试麦首页"><Brand /></Link>
        <div className="relative z-10 my-auto py-12 md:py-20">
          <p className="eyebrow">为下一次机会，做好准备</p>
          <h1 className="text-4xl font-bold leading-snug tracking-tight text-ink lg:text-5xl">面试前的底气，<br />来自每一次练习。</h1>
          <p className="mt-6 max-w-sm text-base leading-8 text-muted">这里是你可以试着回答、慢慢思考、<br className="hidden lg:block" />再来一次的地方。</p>
          <div className="mt-10 hidden max-w-sm rounded-2xl border border-primary-200 bg-white/65 p-6 md:block">
            <Quote size={24} className="mb-4 text-primary-500" aria-hidden="true" />
            <p className="text-lg font-medium leading-8 text-ink">不必等到完美才开口。<br />先把你的故事，讲给麦麦听。</p>
            <div className="mt-6 space-y-3 text-sm text-muted">{['围绕目标岗位，找到准备方向', '多轮模拟问答，练习真实表达', '保留练习记录，复盘每次进步'].map(text => <p key={text} className="flex items-center gap-2"><Check size={16} className="text-primary-600" aria-hidden="true" />{text}</p>)}</div>
          </div>
        </div>
        <p className="relative z-10 hidden text-xs text-muted md:block">面试麦 · 你的 AI 面试练习伙伴</p>
      </section>
      <section className="flex flex-col px-6 py-6 sm:px-12 md:px-10 lg:px-20">
        <Link href="/" className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />返回首页</Link>
        <div className="flex flex-1 items-center justify-center py-5 md:pb-20"><LoginEmailPanel /></div>
        <p className="mt-10 text-center text-xs text-muted">你的练习与简历，将保存在你的账号中。</p>
      </section>
    </main>
  )
}
