'use client'

import React from 'react'
import Button from '@/components/ui/Button'

export default function HomeCTA() {
  return (
    <section className="py-10 md:py-22 bg-white">
      <div className="container px-4">
        <div className="relative rounded-3xl overflow-hidden bg-neutral-900 px-6 py-16 sm:px-12 sm:py-20 lg:px-16">
          <div className="relative mx-auto max-w-2xl text-center z-10">
            <h3 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              准备好体验全链路 AI 面试服务了吗？
            </h3>
            <p className="mx-auto mt-6 text-lg leading-8 text-neutral-300">
              从押题预测到实战模拟，再到综合评估，3
              大服务全覆盖。现在开始，3分钟完成首次押题，立即获得高分参考答案。
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button
                size="xl"
                color="primary"
                to="/interview/start"
                className="px-8 font-semibold shadow-lg shadow-primary-500/20"
              >
                免费开始
              </Button>
              <Button
                size="xl"
                color="white"
                variant="ghost"
                to="/contact"
                className="px-8 font-medium text-white hover:bg-white/10"
              >
                联系我
              </Button>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-900/50 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-900/30 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>
    </section>
  )
}
