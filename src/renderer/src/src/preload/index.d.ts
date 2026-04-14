import { ElectronAPI } from '@electron-toolkit/preload'

// Typen für alle IPC-Kanäle – vom Renderer aus nutzbar als window.api.*
interface Api {
  dashboard: {
    stats: () => Promise<unknown>
  }
  categories: {
    list:   ()                         => Promise<unknown[]>
    get:    (id: number)               => Promise<unknown>
    create: (data: unknown)            => Promise<unknown>
    update: (id: number, d: unknown)   => Promise<unknown>
    delete: (id: number)               => Promise<{ success: boolean }>
  }
  suppliers: {
    list:         (search?: string)    => Promise<unknown[]>
    get:          (id: number)         => Promise<unknown>
    create:       (d: unknown)         => Promise<unknown>
    update:       (id: number, d: unknown) => Promise<unknown>
    toggleActive: (id: number)         => Promise<unknown>
    delete:       (id: number)         => Promise<{ success: boolean }>
  }
  materials: {
    list:        (params?: unknown)    => Promise<unknown[]>
    get:         (id: number)          => Promise<unknown>
    create:      (d: unknown)          => Promise<unknown>
    update:      (id: number, d: unknown) => Promise<unknown>
    delete:      (id: number)          => Promise<{ success: boolean }>
    getPrices:   (id: number)          => Promise<unknown[]>
    savePrice:   (id: number, d: unknown) => Promise<{ success: boolean }>
    deletePrice: (matId: number, priceId: number) => Promise<{ success: boolean }>
  }
  priceHistory: {
    list:       (params?: unknown)     => Promise<unknown[]>
    byMaterial: (id: number)           => Promise<unknown>
    create:     (d: unknown)           => Promise<unknown>
    delete:     (id: number)           => Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
