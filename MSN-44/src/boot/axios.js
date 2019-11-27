import axios from 'axios'

export default async ({ Vue }) => {
  const axiosInstance = axios.create({
    // withCredentials: true,
    baseURL: 'http://localhost:8044/chat/',
    crossdomain: true
  })

  // // INTERCEPTOR REQUEST
  // axiosInstance.interceptors.request.use((config) => {
  //   // TOKEN INCLUSION
  //   let token = localStorage.getItem('authtoken')

  //   if (token) {
  //     config.headers['Authorization'] = `EP2S ${token}`
  //   }

  //   return config
  // }, (error) => {
  //   return Promise.reject(error)
  // })

  Vue.prototype.$axios = axiosInstance
}
