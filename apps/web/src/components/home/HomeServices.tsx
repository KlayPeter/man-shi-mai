'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function HomeServices() {
  const router = useRouter()

  return (
    <section id="features" className="py-10 md:py-22 bg-white">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs font-medium text-primary-700 mb-6">
            <Icon name="i-heroicons-sparkles" className="w-4 h-4" />
            全链路 AI 面试解决方案
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">
            三大核心服务，覆盖面试全流程
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            不同于市面上单一的 AI 面试工具，面试麦提供从<span className="font-semibold text-primary-600">准备阶段</span>
            到<span className="font-semibold text-primary-600">实战训练</span>
            再到<span className="font-semibold text-primary-600">综合评估</span>的完整服务链
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div
            className="cursor-pointer relative group bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-3xl border-2 border-blue-100 p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
            onClick={() => router.push('/interview/start')}
          >
            <div className="absolute -top-3 -right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              准备阶段
            </div>

            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-blue-200">
                <Icon name="i-heroicons-document-text" className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">面试押题</h3>
              <p className="text-sm text-blue-600 font-semibold mb-4">
                3-5 分钟快速生成 · 命中率 80%+
              </p>
            </div>

            <p className="text-neutral-600 leading-relaxed mb-6">
              基于岗位 JD 和个人简历，AI 智能分析并预测高频面试题，提供参考答案与回答技巧，得到专业反馈报告
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <span>智能分析岗位 JD，精准匹配技能要求</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <span>覆盖技术、项目、行为等多维度题型</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <span>附带高分参考答案与 STAR 回答框架</span>
              </li>
            </ul>

            <div className="pt-4 border-t border-blue-100 flex items-center justify-between text-sm">
              <span className="text-neutral-500">适合场景</span>
              <span className="font-semibold text-neutral-900">面试前快速准备</span>
            </div>
          </div>

          <div
            className="cursor-pointer relative group bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-3xl border-2 border-emerald-100 p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ring-4 ring-emerald-100/50"
            onClick={() => router.push('/interview/start')}
          >
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
              🔥 最受欢迎
            </div>

            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-emerald-200">
                <Icon name="i-heroicons-bolt" className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">专项面试模拟</h3>
              <p className="text-sm text-emerald-600 font-semibold mb-4">
                约 1 小时 · 支持语音/文字多模态
              </p>
            </div>

            <p className="text-neutral-600 leading-relaxed mb-6">
              针对技术面、业务面进行深度 1v1 模拟，AI 面试官实时追问与反馈，全面提升实战能力
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>真实面试场景 1v1 对话模拟</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>AI 智能追问，深度挖掘技术能力</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>多轮问答评估，即时反馈与打分</span>
              </li>
            </ul>

            <div className="pt-4 border-t border-emerald-100 flex items-center justify-between text-sm">
              <span className="text-neutral-500">适合场景</span>
              <span className="font-semibold text-neutral-900">深度实战训练</span>
            </div>
          </div>

          <div
            className="cursor-pointer relative group bg-gradient-to-br from-purple-50 via-white to-purple-50/30 rounded-3xl border-2 border-purple-100 p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
            onClick={() => router.push('/interview/start')}
          >
            <div className="absolute -top-3 -right-3 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              综合评估
            </div>

            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-purple-200">
                <Icon name="i-heroicons-chat-bubble-left-right" className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">行测 + HR 面试</h3>
              <p className="text-sm text-purple-600 font-semibold mb-4">
                约 45 分钟 · 双重评估维度
              </p>
            </div>

            <p className="text-neutral-600 leading-relaxed mb-6">
              覆盖行政能力测试 + HR 软技能面试，全面评估综合素质与软实力表现，大幅提升入职率
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <span>行测题库与限时模拟测试</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <span>HR 面试软技能深度评估</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <span>沟通表达与情商能力评测反馈</span>
              </li>
            </ul>

            <div className="pt-4 border-t border-purple-100 flex items-center justify-between text-sm">
              <span className="text-neutral-500">适合场景</span>
              <span className="font-semibold text-neutral-900">全面能力提升</span>
            </div>
          </div>
        </div>

        <div className="mt-16 max-w-4xl mx-auto bg-gradient-to-r from-primary-50 to-emerald-50 rounded-2xl p-8 border border-primary-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500 text-white flex items-center justify-center shrink-0">
              <Icon name="i-heroicons-light-bulb" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">为什么选择面试麦？</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-neutral-700">
                <div className="flex items-start gap-2">
                  <Icon name="i-heroicons-check-badge" className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">全流程覆盖</p>
                    <p className="text-neutral-600">
                      市面上的 AI 工具多为单一模拟，我们覆盖准备-实战-评估全链路
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="i-heroicons-check-badge" className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">三位一体服务</p>
                    <p className="text-neutral-600">
                      押题、模拟、行测三大服务互补，满足不同阶段需求
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="i-heroicons-check-badge" className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">极速见效</p>
                    <p className="text-neutral-600">
                      3 分钟完成押题，1 小时深度训练，比传统方法效率提升 10 倍
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="i-heroicons-check-badge" className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">数据驱动优化</p>
                    <p className="text-neutral-600">
                      基于真实面试数据持续优化，确保题库与反馈的准确性
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
