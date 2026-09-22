import { Metadata } from 'next';
import ResumeStudio from '@/components/resume/studio/ResumeStudio';

export const metadata: Metadata = {
  title: '编辑简历 - 漫视迈',
};

interface Props {
  params: {
    id: string;
  };
}

export default function ResumeStudioPage({ params }: Props) {
  // We cannot hide standard layout here trivially if it's under (main), 
  // but let's assume we want it full screen, so we might need a separate route outside (main) ideally.
  // Given the structure, we will just render the studio here. The layout might have a topnav, but ResumeStudio has its own header.
  return (
    <div className="absolute inset-0 z-50 bg-white">
      <ResumeStudio id={params.id} />
    </div>
  );
}
