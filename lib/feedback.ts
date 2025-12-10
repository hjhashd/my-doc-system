import { toast } from "sonner"

type ToastType = "success" | "error" | "loading" | "info"

interface FeedbackOptions {
  title?: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

const DEFAULT_SUCCESS_DURATION = 3000
const DEFAULT_ERROR_DURATION = 5000
const DEFAULT_INFO_DURATION = 4000

export const feedback = {
  success: (message: string, options?: FeedbackOptions) => {
    toast.dismiss()
    toast.success(message, {
      description: options?.description,
      duration: options?.duration || DEFAULT_SUCCESS_DURATION,
      action: options?.action,
    })
  },

  error: (message: string, options?: FeedbackOptions) => {
    toast.dismiss()
    toast.error(message, {
      description: options?.description,
      duration: options?.duration || DEFAULT_ERROR_DURATION,
      action: options?.action,
    })
  },

  loading: (message: string, options?: FeedbackOptions) => {
    toast.dismiss()
    return toast.loading(message, {
      description: options?.description,
    })
  },

  info: (message: string, options?: FeedbackOptions) => {
    toast.dismiss()
    toast.info(message, {
      description: options?.description,
      duration: options?.duration || DEFAULT_INFO_DURATION,
      action: options?.action,
    })
  },

  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId)
  },

  promise: <T>(
    promise: Promise<T>,
    {
      loading = "加载中...",
      success = "操作成功",
      error = "操作失败",
    }: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((error: any) => string)
    }
  ) => {
    toast.dismiss()
    return toast.promise(promise, {
      loading,
      success,
      error,
    })
  },
}
