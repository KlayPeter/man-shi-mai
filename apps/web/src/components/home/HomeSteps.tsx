'use client'

import React from 'react'
import Button from '@/components/ui/Button'

export default function HomeSteps() {
  return (
    <section id="steps" className="py-10 md:py-22 overflow-hidden">
      <div className="container px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">
            极简 3 步，完成全链路 AI 面试服务
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            从押题到实战，从评估到提升，用最短路径构建完整面试能力。
          </p>
        </div>
        <div className="relative mt-12">
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-neutral-100 -translate-y-1/2 z-0"></div>

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            <div className="group bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 font-bold text-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ring-4 ring-white">
                1
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">选择岗位与简历</h3>
              <p className="text-neutral-600 leading-relaxed">
                设置目标岗位/公司，导入简历，选择所需服务类型（押题/模拟/行测）。
              </p>
            </div>
            <div className="group bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-bold text-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ring-4 ring-white">
                2
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">获取 AI 服务</h3>
              <p className="text-neutral-600 leading-relaxed">
                快速押题预测、深度实战模拟、或综合能力评估，灵活选择适合的服务。
              </p>
            </div>
            <div className="group bg-white p-8 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 font-bold text-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ring-4 ring-white">
                3
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">查看报告与提升</h3>
              <p className="text-neutral-600 leading-relaxed">
                获得详细评估报告、雷达图分析与针对性提升建议，持续优化面试能力。
              </p>
            </div>
          </div>
        </div>
        <div className="mt-16 text-center">
          <Button
            color="primary"
            size="xl"
            to="/interview/start"
            className="px-8 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all font-semibold"
          >
            开启全链路 AI 服务
          </Button>
        </div>
      </div>
    </section>
  )
}
