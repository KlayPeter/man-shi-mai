'use client'

import React from 'react'
import Icon from '@/components/ui/Icon'
import StarMethodModal from '@/components/StarMethodModal'

export default function HomeFeatures() {
  return (
    <section className="py-10 md:py-22 bg-neutral-50/50">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">
            三大服务 × 全流程覆盖
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            不同于市面上单一的 AI 面试模拟工具，面试麦提供从
            <span className="font-semibold text-primary-600">押题预测</span>到
            <span className="font-semibold text-primary-600">实战模拟</span>再到
            <span className="font-semibold text-primary-600">综合评估</span>的完整解决方案，全方位提升面试竞争力。
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="group p-8 bg-gradient-to-br from-blue-50/50 to-white rounded-2xl border-2 border-blue-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
              <Icon name="i-heroicons-document-text" className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-neutral-900">面试押题</h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                核心服务
              </span>
            </div>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              基于岗位 JD 和简历，AI 智能预测 80% 高频面试题，附带参考答案与回答技巧，3 分钟快速生成。
            </p>
          </div>

          <div className="group p-8 bg-gradient-to-br from-emerald-50/50 to-white rounded-2xl border-2 border-emerald-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-200">
              <Icon name="i-heroicons-bolt" className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-neutral-900">专项面试</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                核心服务
              </span>
            </div>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              针对技术面、业务面进行深度模拟，AI 面试官实时追问与反馈，支持语音/文字，约 1 小时实战训练。
            </p>
          </div>

          <div className="group p-8 bg-gradient-to-br from-purple-50/50 to-white rounded-2xl border-2 border-purple-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-purple-200">
              <Icon name="i-heroicons-chat-bubble-left-right" className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-neutral-900">行测+HR面试</h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                核心服务
              </span>
            </div>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              覆盖行政能力测试 + HR 软技能面试，评估沟通表达与情商，约 45 分钟全面提升综合素质。
            </p>
          </div>

          <div className="group p-8 bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Icon name="i-heroicons-chart-pie" className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900">结构化评估报告</h3>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              覆盖 <StarMethodModal /> 模型、技能矩阵、雷达图与改进建议，一键导出复盘。
            </p>
          </div>

          <div className="group p-8 bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Icon name="i-heroicons-sparkles" className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900">真实公司风格</h3>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              按公司/岗位/等级定制问法与偏好，模拟真实面试氛围与风格。
            </p>
          </div>

          <div className="group p-8 bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Icon name="i-heroicons-shield-check" className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900">隐私与数据安全</h3>
            <p className="mt-3 text-neutral-600 leading-relaxed">
              企业级数据加密，你的简历与面试数据只属于你，安全可控。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
