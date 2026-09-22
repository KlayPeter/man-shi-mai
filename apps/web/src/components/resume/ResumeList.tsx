'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import request from '@/lib/request';
import { toast } from '@/stores/toastStore';
import Icon from '@/components/ui/Icon';
import UploadResumeModal from '@/components/profile/UploadResumeModal';

export default function ResumeList() {
  const router = useRouter();
  const [resumes, setResumes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchResumes = async () => {
    setIsLoading(true);
    try {
      const data: any = await request.get('/resume/getInterviewResumeList');
      setResumes(data || []);
    } catch (e: any) {
      toast({ title: '加载失败', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleCreateEmpty = async () => {
    setIsCreating(true);
    try {
      const data: any = await request.post('/resume/create-empty', {
        resumeName: `未命名简历 ${new Date().toLocaleDateString()}`,
      });
      toast({ title: '创建成功', color: 'green' });
      router.push(`/resume/${data._id}`);
    } catch (e: any) {
      toast({ title: '创建失败', color: 'red' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这份简历吗？')) return;
    try {
      await request.post('/resume/deleteResume', { resumeId: id });
      toast({ title: '删除成功', color: 'green' });
      fetchResumes();
    } catch (e: any) {
      toast({ title: '删除失败', color: 'red' });
    }
  };

  return (
    <div className="workspace-page page-container">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="workspace-heading">我的简历</h1>
          <p className="text-gray-500 mt-1">让每段经历更清晰，让每次练习更有针对性。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
          >
            <Icon name="i-heroicons-arrow-up-tray" className="w-5 h-5 mr-2" />
            上传文件
          </button>
          <button
            onClick={handleCreateEmpty}
            disabled={isCreating}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
          >
            <Icon name="i-heroicons-plus" className="w-5 h-5 mr-2" />
            {isCreating ? '创建中...' : '新建简历'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Icon name="i-heroicons-arrow-path" className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : resumes.length === 0 ? (
        <div className="surface-panel p-8 sm:p-16 text-center">
          <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="i-heroicons-document-text" className="w-10 h-10 text-primary-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有任何简历</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
            您可以新建一份空白简历在线编辑，或者直接上传您现有的 PDF / Word 文件。
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setShowUpload(true)}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              上传文件
            </button>
            <button
              onClick={handleCreateEmpty}
              disabled={isCreating}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
            >
              新建简历
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resumes.map((resume) => (
            <div key={resume._id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${resume.sourceType === 'editor' ? 'bg-primary-50 text-primary-600' : 'bg-green-50 text-green-600'}`}>
                    <Icon name={resume.sourceType === 'editor' ? 'i-heroicons-pencil-square' : 'i-heroicons-document'} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 truncate max-w-[150px]" title={resume.resumeName}>
                      {resume.resumeName}
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                      {resume.sourceType === 'editor' ? '在线简历' : '上传文件'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(resume._id)}
                  className="icon-button text-gray-500 hover:text-red-600"
                  aria-label={`删除简历：${resume.resumeName}`} title="删除"
                >
                  <Icon name="i-heroicons-trash" className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-gray-500 mb-6 flex items-center">
                <Icon name="i-heroicons-clock" className="w-3.5 h-3.5 mr-1" />
                更新于 {new Date(resume.updatedAt || resume.createdAt).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/resume/${resume._id}`)}
                  className="min-h-11 flex-1 bg-primary-50 text-primary-700 hover:bg-primary-100 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => router.push(`/interview/start?resumeId=${encodeURIComponent(resume._id)}`)}
                  className="min-h-11 flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  发起面试
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadResumeModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={(resumeId) => {
          fetchResumes();
          if (resumeId) {
            router.push(`/resume/${resumeId}`);
          }
        }}
      />
    </div>
  );
}
