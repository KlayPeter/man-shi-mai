import { Metadata } from 'next';
import ResumeList from '@/components/resume/ResumeList';

export const metadata: Metadata = {
  title: '简历中心 - 面试麦',
  description: '管理您的简历、在线编辑、上传文件',
};

export default function ResumePage() {
  return <ResumeList />;
}
