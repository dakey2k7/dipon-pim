import { useAppStore } from '@/store/appStore'
export function useToast() {
  const add = useAppStore(s => s.addToast)
  return {
    success: (title: string, message?: string) => add({ type:'success', title, message }),
    error:   (title: string, message?: string) => add({ type:'error',   title, message }),
    info:    (title: string, message?: string) => add({ type:'info',    title, message }),
    warning: (title: string, message?: string) => add({ type:'warning', title, message }),
  }
}
