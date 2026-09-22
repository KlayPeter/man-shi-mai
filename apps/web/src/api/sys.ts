import request from '@/lib/request'

export const getConfigAPI = () => {
  return request.get('/sys/config')
}

export const getPositionsAPI = () => {
  return request.get('/sys/positions')
}

export const uploadFileAPI = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/sys/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
