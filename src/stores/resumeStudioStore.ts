import { create } from 'zustand';
import request from '@/lib/request';
import { IResume, IResumeEditorData } from '@/types/resume';
import { toast } from './toastStore';

interface ResumeStudioState {
  currentResume: IResume | null;
  isLoading: boolean;
  isSaving: boolean;
  activeSection: string; // 当前激活的左侧版块 (如 'basics', 'work', 'education')
  
  // Actions
  fetchResumeDetail: (id: string) => Promise<void>;
  updateEditorData: (section: keyof IResumeEditorData, data: any) => void;
  setActiveSection: (section: string) => void;
  saveResumeContent: () => Promise<void>;
}

const defaultEditorData: IResumeEditorData = {
  basics: { name: '' },
  education: [],
  work: [],
  projects: [],
  skills: [],
};

// 辅助函数：将 editorData 生成基础的纯文本快照
function generatePlainTextSnapshot(editorData: IResumeEditorData): string {
  let text = '';
  
  if (editorData.basics?.name) {
    text += `姓名：${editorData.basics.name}\n`;
    if (editorData.basics.jobTitle) text += `期望职位：${editorData.basics.jobTitle}\n`;
    if (editorData.basics.experienceYears) text += `工作经验：${editorData.basics.experienceYears}年\n`;
    if (editorData.basics.summary) text += `自我评价：${editorData.basics.summary}\n`;
  }
  
  if (editorData.work?.length) {
    text += `\n【工作经历】\n`;
    editorData.work.forEach(w => {
      text += `- ${w.company} (${w.position}) [${w.startDate} - ${w.endDate}]\n`;
      text += `  ${w.description}\n`;
    });
  }
  
  if (editorData.projects?.length) {
    text += `\n【项目经历】\n`;
    editorData.projects.forEach(p => {
      text += `- ${p.name} (${p.role}) [${p.startDate} - ${p.endDate}]\n`;
      text += `  ${p.description}\n`;
    });
  }
  
  if (editorData.education?.length) {
    text += `\n【教育经历】\n`;
    editorData.education.forEach(e => {
      text += `- ${e.school} (${e.degree} - ${e.major}) [${e.startDate} - ${e.endDate}]\n`;
    });
  }
  
  if (editorData.skills?.length) {
    text += `\n【专业技能】\n`;
    editorData.skills.forEach(s => {
      text += `- ${s.name}: ${s.keywords.join(', ')}\n`;
    });
  }
  
  return text;
}

export const useResumeStudioStore = create<ResumeStudioState>((set, get) => ({
  currentResume: null,
  isLoading: false,
  isSaving: false,
  activeSection: 'basics',

  setActiveSection: (section: string) => set({ activeSection: section }),

  fetchResumeDetail: async (id: string) => {
    set({ isLoading: true });
    try {
      const data: any = await request.get(`/resume/detail/${id}`);
      const resume = data;
      if (!resume.editorData || Object.keys(resume.editorData).length === 0) {
        resume.editorData = defaultEditorData;
      }
      set({ currentResume: resume });
    } catch (e: any) {
      toast({ title: '网络错误', description: '无法加载简历数据', color: 'red' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateEditorData: (section: keyof IResumeEditorData, data: any) => {
    set((state) => {
      if (!state.currentResume) return state;
      const newEditorData = {
        ...state.currentResume.editorData,
        [section]: data,
      } as IResumeEditorData;

      return {
        currentResume: {
          ...state.currentResume,
          editorData: newEditorData,
        },
      };
    });
  },

  saveResumeContent: async () => {
    const { currentResume } = get();
    if (!currentResume) return;

    set({ isSaving: true });
    try {
      const plainTextSnapshot = generatePlainTextSnapshot(currentResume.editorData as IResumeEditorData);
      
      const data: any = await request.put(`/resume/content/${currentResume._id}`, {
        editorData: currentResume.editorData,
        plainTextSnapshot,
      });

      toast({ title: '保存成功', color: 'green' });
      set({ currentResume: data }); // 更新本地带有 updated timestamp 的数据
    } catch (e: any) {
      toast({ title: '保存出错', description: e.message || '请重试', color: 'red' });
    } finally {
      set({ isSaving: false });
    }
  },
}));
