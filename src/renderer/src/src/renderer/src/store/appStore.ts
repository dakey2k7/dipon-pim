import { create } from 'zustand'

interface Toast { id:string; type:'success'|'error'|'info'|'warning'; title:string; message?:string }
interface AppState {
  sidebarCollapsed: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  addToast: (t: Omit<Toast,'id'>) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toasts: [],
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`
    set(s => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
