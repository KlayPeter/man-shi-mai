import request from '@/lib/request'

export const createOrderAPI = (data: any) => {
  return request.post('/payment/create-order', data)
}

export const getPaymentStatusAPI = (orderId: string) => {
  return request.get(`/payment/status/${orderId}`)
}

export const getWalletBalanceAPI = () => {
  return request.get('/payment/wallet/balance')
}

export const mockPaymentSuccessAPI = (orderId: string) => {
  return request.post('/payment/mock-success', { orderId })
}
