'use client'

import React from 'react';
import { useResumeStudioStore } from '@/stores/resumeStudioStore';
import Icon from '@/components/ui/Icon';
import { v4 as uuidv4 } from 'uuid';
import { IResumeWorkExperience } from '@/types/resume';

export default function WorkExperienceForm() {
  const { currentResume, updateEditorData } = useResumeStudioStore();
  const work = currentResume?.editorData?.work || [];

  const handleAdd = () => {
    const newItem: IResumeWorkExperience = {
      id: uuidv4(),
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: ''
    };
    updateEditorData('work', [...work, newItem]);
  };

  const handleRemove = (id: string) => {
    updateEditorData('work', work.filter((w: IResumeWorkExperience) => w.id !== id));
  };

  const handleChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateEditorData('work', work.map((w: IResumeWorkExperience) => w.id === id ? { ...w, [name]: value } : w));
  };

  return (
    <div className="space-y-6">
      {work.map((item: IResumeWorkExperience, index: number) => (
        <div key={item.id} className="p-5 border border-gray-200 rounded-xl relative group bg-gray-50/50">
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleRemove(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
              <Icon name="i-heroicons-trash" className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">公司名称</label>
              <input
                type="text"
                name="company"
                value={item.company}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="腾讯科技"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">职位</label>
              <input
                type="text"
                name="position"
                value={item.position}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="前端开发工程师"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">开始时间</label>
              <input
                type="month"
                name="startDate"
                value={item.startDate}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">结束时间 (至今则留空)</label>
              <input
                type="month"
                name="endDate"
                value={item.endDate}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">工作内容与业绩</label>
            <textarea
              name="description"
              value={item.description}
              onChange={(e) => handleChange(item.id, e)}
              rows={4}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none resize-none"
              placeholder="- 负责核心业务线的研发&#10;- 优化首屏加载速度，提升了 30% 性能..."
            />
          </div>
        </div>
      ))}
      
      <button
        onClick={handleAdd}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center font-medium text-sm"
      >
        <Icon name="i-heroicons-plus" className="w-4 h-4 mr-1.5" />
        添加一条工作经历
      </button>
    </div>
  );
}
