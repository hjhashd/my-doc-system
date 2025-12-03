import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"

// 默认地址，注意：这里通常只有 host，没有具体端口，容易误导
const API_BASE_URL = process.env.NEXT_PUBLIC_PDF_API_BASE_URL || "http://host.docker.internal"

const instance: AxiosInstance = axios.create({
  timeout: 30000, // 稍微改长一点，大模型处理慢
  withCredentials: false,
})

// === 请求拦截器 ===
instance.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {}
    config.headers["Accept"] = "application/json"

    const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData
    if (!isFormData && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json"
    }

    // === 核心修复逻辑 ===
    const url = config.url || ''
    
    // 1. 如果是绝对路径 (http:// 或 https://)，直接放行，不要设置 baseURL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        config.baseURL = undefined
    } 
    // 2. 如果是 Next.js 内部 API (/api)，清空 baseURL 使用相对路径
    else if (url.startsWith('/api')) {
      config.baseURL = ''
    } 
    // 3. 其他情况 (比如写了相对路径但不是 /api)，才使用默认 Base URL
    else {
      config.baseURL = API_BASE_URL
    }

    // === 【新增】请求调试日志 (Next.js 服务端可以看到) ===
    // 只有在服务端运行时才打印，避免浏览器控制台太乱，或者你可以全打印
    if (typeof window === 'undefined') {
        const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
        console.log(`[HTTP Request] 👉 ${config.method?.toUpperCase()} ${fullUrl}`);
    }

    return config
  },
  (error) => Promise.reject(error)
)

// === 响应拦截器 ===
instance.interceptors.response.use(
  (response: AxiosResponse) => {
      // 成功也打印一下，确认回来了
      if (typeof window === 'undefined') {
          console.log(`[HTTP Response] ✅ ${response.config.url} - ${response.status}`);
      }
      return response; 
  },
  (error: AxiosError) => {
    // === 【新增】详细错误日志 ===
    if (typeof window === 'undefined') {
        const targetUrl = error.config?.baseURL ? `${error.config?.baseURL}${error.config?.url}` : error.config?.url;
        console.error(`[HTTP Error] ❌ Request failed to: ${targetUrl}`);
        console.error(`[HTTP Error] Details: ${error.message}`);
        if (error.code) console.error(`[HTTP Error] Code: ${error.code}`);
    }
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