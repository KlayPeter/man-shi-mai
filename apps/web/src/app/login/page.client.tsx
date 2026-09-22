'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/stores/userStore'
import Icon from '@/components/ui/Icon'
import { toast } from '@/stores/toastStore'

function LoginPitch() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-white text-3xl md:text-4xl font-semibold">
          欢迎回来！<br />
          继续你的全链路 AI 面试训练
        </h1>
        <p className="text-sm md:text-base text-white/80 max-w-xl">
          面试麦提供<span className="font-semibold">面试押题</span>、
          <span className="font-semibold">专项面试模拟</span>、
          <span className="font-semibold">行测+HR面试</span>
          三大核心服务。登录后同步历史记录，获取针对性题库与实战训练，全方位提升面试竞争力。
        </p>
      </div>
    </div>
  )
}

const steps = [
  {
    title: '选择岗位与目标',
    description: '设置目标岗位/公司，并导入简历，系统自动生成专属题集。',
    icon: 'i-heroicons-briefcase',
  },
  {
    title: '开启多轮模拟面试',
    description: 'AI 面试官进行追问与反问，贴近真实场景，可选语音或文本作答。',
    icon: 'i-heroicons-chat-bubble-left-right',
  },
  {
    title: '获取结构化反馈',
    description: '生成能力雷达、风险点与改进建议，支持导出练习计划。',
    icon: 'i-heroicons-presentation-chart-bar',
  },
]

function LoginFlowCard() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/80 shadow-[0px_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-400 shadow-inner shadow-primary-500/20">
            <Icon name="i-heroicons-map" className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">极简流程</p>
            <h2 className="text-lg font-semibold text-white">3 步完成你的 AI 面试训练</h2>
          </div>
        </div>
        <p className="text-sm text-white/70 md:max-w-xs lg:max-w-sm">
          一次扫码即可同步历史数据，无需繁琐配置。极简三步，即刻进入真实面试场景。
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-white/80 transition hover:border-primary-400/40 hover:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
                <Icon name={step.icon} className="h-5 w-5" />
              </div>
              <span className="text-xs text-white/60">Step {index + 1}</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/70">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

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
    <div className="card relative overflow-hidden border border-gray-200 bg-white p-8 shadow-lg rounded-2xl">
      <div className="absolute -top-24 right-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{isRegister ? '注册账号' : '邮箱登录'}</h2>
          <p className="text-sm text-neutral-500">{isRegister ? '创建你的面试麦账号' : '使用邮箱密码登录面试麦'}</p>
        </div>
      </div>

      <div className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">用户名</label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名（至少3个字符）"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium rounded-lg transition"
          >
            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button type="button" onClick={toggleMode} className="text-sm text-primary-600 hover:underline">
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </div>

      <div className="mt-8 flex items-start gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          id="agree"
          checked={agree}
          onChange={e => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
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
    <>
      <style>{`
        @keyframes orbPulse {
          0% { transform: scale(0.92) translate3d(0,0,0); opacity: 0.65; }
          50% { transform: scale(1.05) translate3d(2%,-2%,0); opacity: 0.9; }
          100% { transform: scale(0.96) translate3d(-2%,2%,0); opacity: 0.7; }
        }
        @keyframes beamSweep {
          0%,100% { transform: rotate(8deg) translate3d(-6%,-4%,0); opacity: 0.35; }
          50% { transform: rotate(-6deg) translate3d(6%,4%,0); opacity: 0.55; }
        }
        @keyframes bubbleFloat {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(0,-18px,0) scale(1.02); }
        }
        @keyframes bubbleDrift {
          0% { transform: rotate(0deg) translateX(0); opacity: 0.65; }
          50% { transform: rotate(1deg) translateX(12px); opacity: 0.85; }
          100% { transform: rotate(0deg) translateX(0); opacity: 0.65; }
        }
        .orb { position:absolute; border-radius:9999px; filter:blur(40px); mix-blend-mode:screen; animation: orbPulse 12s ease-in-out infinite alternate; }
        .orb-1 { width:44rem; height:44rem; top:-12rem; right:-10rem; background:radial-gradient(circle at 30% 30%,rgba(136,108,255,0.5),rgba(15,23,42,0)); animation-delay:-3s; }
        .orb-2 { width:32rem; height:32rem; bottom:-14rem; left:-10rem; background:radial-gradient(circle at 40% 40%,rgba(78,225,255,0.45),rgba(15,23,42,0)); animation-delay:-6s; }
        .orb-3 { width:28rem; height:28rem; top:30%; left:30%; background:radial-gradient(circle at 70% 70%,rgba(244,114,182,0.3),rgba(15,23,42,0)); animation-delay:-1s; }
        .beam { position:absolute; inset:-20%; background:radial-gradient(circle at center,rgba(125,211,252,0.08),rgba(15,23,42,0)); filter:blur(60px); mix-blend-mode:screen; animation: beamSweep 18s ease-in-out infinite; }
        .beam-1 { transform:rotate(12deg); animation-delay:-4s; }
        .beam-2 { transform:rotate(-18deg); animation-delay:-10s; }
        .bubble { position:absolute; border-radius:9999px; border:1px solid rgba(148,163,184,0.18); background:linear-gradient(120deg,rgba(226,232,240,0.08),rgba(148,163,184,0.02),rgba(248,250,252,0.08)),radial-gradient(circle at top left,rgba(148,163,184,0.2),rgba(15,23,42,0.02)); box-shadow:0 0 35px rgba(56,189,248,0.12),inset 0 0 25px rgba(59,130,246,0.06); backdrop-filter:blur(10px); animation: bubbleFloat 16s ease-in-out infinite, bubbleDrift 22s linear infinite; }
        .bubble-1 { width:12rem; height:12rem; top:12%; left:12%; animation-delay:-12s; }
        .bubble-2 { width:9rem; height:9rem; top:42%; right:10%; animation-delay:-6s; }
        .bubble-3 { width:7rem; height:7rem; bottom:18%; left:20%; animation-delay:-18s; }
        .bubble-4 { width:6rem; height:6rem; bottom:15%; right:28%; animation-delay:-9s; }
      `}</style>

      <section className="h-screen relative overflow-hidden py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
          <span className="beam beam-1" />
          <span className="beam beam-2" />
          <span className="bubble bubble-1" />
          <span className="bubble bubble-2" />
          <span className="bubble bubble-3" />
          <span className="bubble bubble-4" />
        </div>

        <div className="absolute inset-x-0 top-24 flex justify-center blur-3xl pointer-events-none">
          <div className="h-64 w-[480px] rounded-full bg-primary-500/20" />
        </div>

        <div className="relative">
          <div className="container px-4">
            <div className="mb-12 flex items-center justify-between text-white/80">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
              >
                <Icon name="i-heroicons-arrow-left" className="w-4 h-4" />
                返回面试麦
              </Link>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs md:flex">
                <Icon name="i-heroicons-shield-check" className="w-4 h-4 text-emerald-300" />
                <span>安全登录</span>
              </div>
            </div>

            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-8">
                <LoginPitch />
                <LoginFlowCard />
              </div>

              <div className="relative">
                <div className="absolute -top-6 -left-8 hidden h-24 w-24 rounded-full border border-white/10 lg:block" />
                <div className="absolute -bottom-6 -right-6 hidden h-20 w-20 rounded-full border border-white/10 lg:block" />
                <LoginEmailPanel />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
