'use client'

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useResumeStudioStore } from '@/stores/resumeStudioStore';
import Icon from '@/components/ui/Icon';
import BasicInfoForm from './forms/BasicInfoForm';
import WorkExperienceForm from './forms/WorkExperienceForm';
import EducationForm from './forms/EducationForm';

interface Props {
  id: string;
}

const SECTIONS = [
  { id: 'basics', label: '基本信息', icon: 'i-heroicons-user' },
  { id: 'work', label: '工作经历', icon: 'i-heroicons-briefcase' },
  { id: 'education', label: '教育经历', icon: 'i-heroicons-academic-cap' },
  { id: 'projects', label: '项目经验', icon: 'i-heroicons-code-bracket' },
  { id: 'skills', label: '专业技能', icon: 'i-heroicons-wrench-screwdriver' },
];

export default function ResumeStudio({ id }: Props) {
  const router = useRouter();
  const store = useResumeStudioStore();

  useEffect(() => {
    store.fetchResumeDetail(id);
  }, [id]);

  if (store.isLoading || !store.currentResume) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Icon name="i-heroicons-arrow-path" className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const { activeSection, currentResume, isSaving } = store;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/resume')} className="text-gray-500 hover:text-gray-900 transition-colors">
            <Icon name="i-heroicons-arrow-left" className="w-5 h-5" />
          </button>
          <span className="font-medium text-gray-900">{currentResume.resumeName}</span>
          {currentResume.status === 'draft' && (
            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">草稿</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => store.saveResumeContent()}
            disabled={isSaving}
            className="flex items-center px-4 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
          >
            <Icon name="i-heroicons-document-check" className="w-4 h-4 mr-1.5" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>

      {/* 主工作区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧模块导航 */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 shrink-0 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">简历模块</div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => store.setActiveSection(s.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Icon name={s.icon} className={`w-5 h-5 ${activeSection === s.id ? 'text-primary-600' : 'text-gray-400'}`} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 中间编辑区 */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            
            {/* 动态渲染对应表单 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              {activeSection === 'basics' && <BasicInfoForm />}
              {activeSection === 'work' && <WorkExperienceForm />}
              {activeSection === 'education' && <EducationForm />}
              {(activeSection === 'projects' || activeSection === 'skills') && (
                <div className="text-gray-500 py-10 text-center">该模块的表单组件尚未完全实现，请先测试基础信息和工作经历。</div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧实时预览 (MVP阶段：先展示纯文本快照效果，后续可替换为 PDF 模板渲染) */}
        <div className="w-[400px] lg:w-[500px] bg-white border-l border-gray-200 shrink-0 flex flex-col shadow-xl z-10">
          <div className="h-12 border-b border-gray-200 flex items-center px-4 bg-gray-50">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Icon name="i-heroicons-eye" className="w-4 h-4" />
              实时预览
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
            {/* 模拟一张 A4 纸 */}
            <div className="bg-white shadow-sm rounded border border-gray-200 min-h-[800px] p-8">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                {/* 实时从 store 获取当前的 editorData，而不是等保存后的 plainTextSnapshot */}
                {JSON.stringify(currentResume.editorData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
