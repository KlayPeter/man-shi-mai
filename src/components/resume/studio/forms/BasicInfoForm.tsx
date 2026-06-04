'use client'

import React from 'react';
import { useResumeStudioStore } from '@/stores/resumeStudioStore';

export default function BasicInfoForm() {
  const { currentResume, updateEditorData } = useResumeStudioStore();
  const basics = currentResume?.editorData?.basics || { name: '' };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateEditorData('basics', { ...basics, [name]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
          <input
            type="text"
            name="name"
            value={basics.name || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="张三"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">期望职位</label>
          <input
            type="text"
            name="jobTitle"
            value={basics.jobTitle || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="高级前端工程师"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">工作经验（年）</label>
          <input
            type="number"
            name="experienceYears"
            value={basics.experienceYears || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">所在城市</label>
          <input
            type="text"
            name="location"
            value={basics.location || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="北京 / 上海"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
          <input
            type="tel"
            name="phone"
            value={basics.phone || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="13800138000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">电子邮箱</label>
          <input
            type="email"
            name="email"
            value={basics.email || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            placeholder="example@gmail.com"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">个人优势 / 自我评价</label>
        <textarea
          name="summary"
          value={basics.summary || ''}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow resize-none"
          placeholder="简短介绍您的核心竞争力和技术深度..."
        />
      </div>
    </div>
  );
}
