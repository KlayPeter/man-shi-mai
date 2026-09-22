'use client'

import React from 'react';
import { useResumeStudioStore } from '@/stores/resumeStudioStore';
import Icon from '@/components/ui/Icon';
import { v4 as uuidv4 } from 'uuid';
import { IResumeEducation } from '@/types/resume';

export default function EducationForm() {
  const { currentResume, updateEditorData } = useResumeStudioStore();
  const education = currentResume?.editorData?.education || [];

  const handleAdd = () => {
    const newItem: IResumeEducation = {
      id: uuidv4(),
      school: '',
      degree: '',
      major: '',
      startDate: '',
      endDate: '',
      description: ''
    };
    updateEditorData('education', [...education, newItem]);
  };

  const handleRemove = (id: string) => {
    updateEditorData('education', education.filter((e: IResumeEducation) => e.id !== id));
  };

  const handleChange = (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateEditorData('education', education.map((ed: IResumeEducation) => ed.id === id ? { ...ed, [name]: value } : ed));
  };

  return (
    <div className="space-y-6">
      {education.map((item: IResumeEducation) => (
        <div key={item.id} className="p-5 border border-gray-200 rounded-xl relative group bg-gray-50/50">
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleRemove(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
              <Icon name="i-heroicons-trash" className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">学校名称</label>
              <input
                type="text"
                name="school"
                value={item.school}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="清华大学"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">专业</label>
              <input
                type="text"
                name="major"
                value={item.major}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="计算机科学与技术"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">学历</label>
              <select
                name="degree"
                value={item.degree}
                onChange={(e) => handleChange(item.id, e)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="">请选择学历</option>
                <option value="大专">大专</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">开始时间</label>
                <input
                  type="month"
                  name="startDate"
                  value={item.startDate}
                  onChange={(e) => handleChange(item.id, e)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">结束时间</label>
                <input
                  type="month"
                  name="endDate"
                  value={item.endDate}
                  onChange={(e) => handleChange(item.id, e)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">在校荣誉或经历 (可选)</label>
            <textarea
              name="description"
              value={item.description || ''}
              onChange={(e) => handleChange(item.id, e)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none resize-none"
              placeholder="连续三年获得国家奖学金..."
            />
          </div>
        </div>
      ))}
      
      <button
        onClick={handleAdd}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center font-medium text-sm"
      >
        <Icon name="i-heroicons-plus" className="w-4 h-4 mr-1.5" />
        添加一条教育经历
      </button>
    </div>
  );
}
