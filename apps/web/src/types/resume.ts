export interface IResumeBasicInfo {
  name: string;
  avatar?: string;
  jobTitle?: string;
  experienceYears?: number;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  summary?: string;
}

export interface IResumeEducation {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface IResumeWorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface IResumeProject {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  link?: string;
  description: string;
}

export interface IResumeSkill {
  id: string;
  name: string;
  level?: string;
  keywords: string[];
}

export interface IResumeEditorData {
  basics: IResumeBasicInfo;
  education: IResumeEducation[];
  work: IResumeWorkExperience[];
  projects: IResumeProject[];
  skills: IResumeSkill[];
}

export interface IResume {
  _id: string;
  userId: string;
  resumeName: string;
  url?: string;
  uploadTime: string;
  sourceType: 'upload' | 'editor' | 'hybrid';
  editorData: IResumeEditorData | Record<string, any>;
  plainTextSnapshot: string;
  templateId: string;
  themeSettings: any;
  status: 'draft' | 'ready' | 'archived';
  createdAt: string;
  updatedAt: string;
}
