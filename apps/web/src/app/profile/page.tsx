'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { useUserStore } from '@/stores/userStore'
import request from '@/lib/request'
import EditProfileModal from '@/components/profile/EditProfileModal'
import UploadResumeModal from '@/components/profile/UploadResumeModal'
import RedeemServiceModal from '@/components/profile/RedeemServiceModal'
import RechargeModal from '@/components/profile/RechargeModal'
import { getUserInfoAPI } from '@/api/user'

const MAX_RESUME_COUNT = 5

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ProfilePage() {
  const userStore = useUserStore()
  const [activeRecordTab, setActiveRecordTab] = useState<'recharge' | 'consumption'>('recharge')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showUploadResume, setShowUploadResume] = useState(false)
  const [showRedeem, setShowRedeem] = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeRecords, setRechargeRecords] = useState<any[]>([])
  const [consumeRecords, setConsumeRecords] = useState<any[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const router = useRouter()

  const fetchRecords = useCallback(async (tab: 'recharge' | 'consumption') => {
    setRecordsLoading(true)
    try {
      const endpoint = tab === 'recharge' ? '/user/transactions' : '/user/consumption-records'
      const data: any = await request.get(endpoint)
      if (tab === 'recharge') setRechargeRecords(Array.isArray(data) ? data : (data?.records || data?.list || []))
      else setConsumeRecords(Array.isArray(data) ? data : (data?.records || data?.list || []))
    } catch { /* ignore */ }
    finally { setRecordsLoading(false) }
  }, [])

  const fetchResumes = useCallback(async () => {
    try {
      const data: any = await request.get('/resume/getInterviewResumeList')
      userStore.updateResumes(Array.isArray(data) ? data : (data?.list || []))
    } catch { /* ignore */ }
  }, [userStore])

  // 获取最新用户信息（包括剩余次数）
  const fetchUserInfo = useCallback(async () => {
    try {
      const userInfo: any = await getUserInfoAPI()
      userStore.updateUserInfo(userInfo)
    } catch { /* ignore */ }
  }, [userStore])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchResumes(); fetchUserInfo() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRecords(activeRecordTab) }, [activeRecordTab])



  const stats = [
    { label: '面试押题', value: (userStore.userInfo as any)?.resumeRemainingCount || 0, icon: 'i-heroicons-document-text' },
    { label: '专项面试', value: (userStore.userInfo as any)?.specialRemainingCount || 0, icon: 'i-heroicons-bolt' },
    { label: '行测+HR', value: (userStore.userInfo as any)?.behaviorRemainingCount || 0, icon: 'i-heroicons-user-group' }
  ]

  const currentRecords = activeRecordTab === 'recharge' ? rechargeRecords : consumeRecords

  return (
    <>
      <div className="workspace-page">
        <div className="page-container">
          <div className="mb-8"><p className="eyebrow">你的练习空间</p><h1 className="workspace-heading mt-3">账户与权益</h1><p className="mt-3 text-muted">管理个人资料，查看练习权益与账户记录。</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="surface-panel p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">个人信息</h2>
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-4">
                    <div className="p-1 bg-white rounded-full shadow-sm ring-1 ring-gray-100">
                      {userStore.userInfo?.avatar ? (
                        <Image src={userStore.userInfo.avatar} alt="头像" width={96} height={96} className="w-24 h-24 rounded-full object-cover" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-3xl font-bold">
                          {userStore.userInfo?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{userStore.userInfo?.username || '未设置昵称'}</h3>
                  <div className="px-3 py-1 rounded-md bg-gray-100 text-xs text-gray-500 font-mono mb-4">
                    ID: {(userStore.userInfo as any)?._id || '-'}
                  </div>
                  <Button color="gray" variant="solid" className="w-full" onClick={() => setShowEditProfile(true)}>
                    <Icon name="i-heroicons-pencil-square" className="w-4 h-4 mr-2" />
                    编辑资料
                  </Button>
                </div>
                <div className="pt-6 border-t border-gray-200">
                  <div className="rounded-2xl p-6 bg-ink text-white shadow-xl relative overflow-hidden">
                    <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 blur-2xl rounded-full pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon name="i-heroicons-currency-dollar" className="w-5 h-5" />
                        <p className="text-base font-semibold">账户总览</p>
                      </div>
                      <div className="mb-4">
                        <p className="text-xs opacity-80">当前可用小麦币余额</p>
                        <p className="text-3xl font-bold tracking-tight mt-1">
                          {(userStore.userInfo?.maiCoinBalance ?? 0).toFixed(2)}
                        </p>
                        <p className="text-xs opacity-70 mt-2">
                          <span className="text-yellow-200 font-bold">20 小麦币兑换一次</span> 面试押题 / 专项面试 / 行测+HR
                        </p>
                      </div>
                      <div className="space-y-3 mb-4">
                        {stats.map((stat, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                                <Icon name={stat.icon} className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{stat.label}</p>
                                <p className="text-xs opacity-70">剩余次数</p>
                              </div>
                            </div>
                            <p className="text-2xl font-semibold">
                              {stat.value}<span className="text-xs font-normal opacity-70 ml-1">次</span>
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setShowRedeem(true)}
                          className="flex-1 py-2.5 rounded-xl bg-lime hover:bg-primary-200 text-ink text-sm font-medium flex items-center justify-center gap-1.5 transition-colors shadow-lg">
                          <Icon name="i-heroicons-sparkles" className="w-4 h-4" />
                          小麦币兑换
                        </button>
                        <button onClick={() => setShowRecharge(true)}
                          className="flex-1 py-2.5 rounded-xl border border-white/30 bg-white/5 hover:bg-white/15 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors">
                          <Icon name="i-heroicons-credit-card" className="w-4 h-4" />
                          优惠充值
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="surface-panel p-5 sm:p-6">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Icon name="i-heroicons-folder" className="w-5 h-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">简历中心</h2>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {userStore.resumes.length}/{MAX_RESUME_COUNT}
                    </span>
                  </div>
                  <Button color="primary" onClick={() => router.push('/resume')}>
                    前往简历中心
                    <Icon name="i-heroicons-arrow-right" className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="bg-paper rounded-xl p-5 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                      <Icon name="i-heroicons-document-duplicate" className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">统一简历管理</h3>
                      <p className="text-sm text-gray-500 mt-1">整理项目经历、在线编辑简历，为下一场面试做好准备。</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push('/resume')}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    管理我的 {userStore.resumes.length} 份简历
                  </button>
                </div>
              </div>

              <div className="surface-panel p-5 sm:p-6">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Icon name="i-heroicons-chart-bar" className="w-5 h-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">消费与充值记录</h2>
                  </div>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-full">
                    {(['recharge', 'consumption'] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveRecordTab(tab)}
                        aria-pressed={activeRecordTab === tab} className={`min-h-11 px-4 py-1.5 text-xs font-medium rounded-full transition-all ${activeRecordTab === tab ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-primary-600'}`}>
                        {tab === 'recharge' ? '充值记录' : '消费记录'}
                      </button>
                    ))}
                  </div>
                </div>
                {recordsLoading ? (
                  <div className="text-center py-12">
                    <Icon name="i-heroicons-arrow-path" className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-spin" />
                    <p className="text-gray-400 text-sm">加载中...</p>
                  </div>
                ) : currentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {currentRecords.map((record: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeRecordTab === 'recharge' ? 'bg-green-100' : 'bg-orange-100'}`}>
                            <Icon name={activeRecordTab === 'recharge' ? 'i-heroicons-arrow-down' : 'i-heroicons-arrow-up'}
                              className={`w-5 h-5 ${activeRecordTab === 'recharge' ? 'text-green-600' : 'text-orange-600'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{record.description || record.planName || (activeRecordTab === 'recharge' ? '充值' : '消费')}</p>
                            <p className="text-xs text-gray-400">{formatDate(record.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${activeRecordTab === 'recharge' ? 'text-green-600' : 'text-orange-600'}`}>
                            {activeRecordTab === 'recharge' ? '+' : '-'}{record.amount || record.coins} 小麦币
                          </p>
                          {record.price && <p className="text-xs text-gray-400">{record.price}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Icon name="i-heroicons-clipboard-document-list" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">暂无{activeRecordTab === 'recharge' ? '充值' : '消费'}记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditProfileModal open={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <UploadResumeModal open={showUploadResume} onClose={() => setShowUploadResume(false)} onUploaded={fetchResumes} />
      <RedeemServiceModal
        open={showRedeem}
        onClose={() => setShowRedeem(false)}
        onRedeemSuccess={(serviceType) => { alert(`兑换成功：${serviceType}`); fetchResumes() }}
        onGoToRecharge={() => { setShowRedeem(false); setShowRecharge(true) }}
      />
      <RechargeModal open={showRecharge} onClose={() => setShowRecharge(false)} onRecharged={fetchResumes} />


    </>
  )
}