import api from '@/lib/request';

export const getMockInterviewCountAPI = () => {
  return api.get('/admin/mock-interview-count');
};
