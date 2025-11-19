import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_PDF_API_BASE_URL || "http://host.docker.internal"

const instance: AxiosInstance = axios.create({
  timeout: 20000,
  withCredentials: false,
})

instance.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {}
    config.headers["Accept"] = "application/json"

    const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData
    if (!isFormData && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json"
    }

    // 如果URL以/api开头，使用相对路径，这样会请求到Next.js API路由
    // 否则使用完整的API_BASE_URL
    if (config.url && config.url.startsWith('/api')) {
      config.baseURL = ''
    } else {
      config.baseURL = API_BASE_URL
    }

    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return instance.get<T>(url, config).then((res) => res.data)
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return instance.post<T>(url, data, config).then((res) => res.data)
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return instance.put<T>(url, data, config).then((res) => res.data)
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return instance.delete<T>(url, config).then((res) => res.data)
  },
  instance,
}

export default http