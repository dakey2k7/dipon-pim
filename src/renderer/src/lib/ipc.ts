// Typisierter Wrapper um window.api (vom Preload-Script bereitgestellt)
// Verwendung identisch zum alten api.ts, aber ohne HTTP – direkt über Electron IPC

import type {
  Category, Supplier, Material, SupplierPrice,
  PriceHistory, DashboardStats,
} from '@/types'

type ListRes<T>  = T[]
type SingleRes<T> = T

export const api = {
  dashboard: {
    stats: (): Promise<DashboardStats> =>
      window.api.dashboard.stats() as Promise<DashboardStats>,
  },

  categories: {
    list:   (): Promise<ListRes<Category>>    => window.api.categories.list() as Promise<Category[]>,
    get:    (id: number): Promise<Category>   => window.api.categories.get(id) as Promise<Category>,
    create: (d: unknown): Promise<Category>   => window.api.categories.create(d) as Promise<Category>,
    update: (id: number, d: unknown): Promise<Category> =>
      window.api.categories.update(id, d) as Promise<Category>,
    delete: (id: number)                      => window.api.categories.delete(id),
  },

  suppliers: {
    list:         (search?: string): Promise<Supplier[]>  =>
      window.api.suppliers.list(search) as Promise<Supplier[]>,
    get:          (id: number): Promise<Supplier>         =>
      window.api.suppliers.get(id) as Promise<Supplier>,
    create:       (d: unknown): Promise<Supplier>         =>
      window.api.suppliers.create(d) as Promise<Supplier>,
    update:       (id: number, d: unknown): Promise<Supplier> =>
      window.api.suppliers.update(id, d) as Promise<Supplier>,
    toggleActive: (id: number): Promise<Supplier>         =>
      window.api.suppliers.toggleActive(id) as Promise<Supplier>,
    delete:       (id: number)                            =>
      window.api.suppliers.delete(id),
  },

  materials: {
    list: (params?: {
      search?: string; category_id?: number; low_stock?: boolean
    }): Promise<Material[]> =>
      window.api.materials.list(params) as Promise<Material[]>,
    get:         (id: number): Promise<Material & { prices: SupplierPrice[] }> =>
      window.api.materials.get(id) as Promise<Material & { prices: SupplierPrice[] }>,
    create:      (d: unknown): Promise<Material>         =>
      window.api.materials.create(d) as Promise<Material>,
    update:      (id: number, d: unknown): Promise<Material> =>
      window.api.materials.update(id, d) as Promise<Material>,
    delete:      (id: number)                            =>
      window.api.materials.delete(id),
    getPrices:   (id: number): Promise<SupplierPrice[]>  =>
      window.api.materials.getPrices(id) as Promise<SupplierPrice[]>,
    savePrice:   (id: number, d: unknown)                =>
      window.api.materials.savePrice(id, d),
    deletePrice: (matId: number, priceId: number)        =>
      window.api.materials.deletePrice(matId, priceId),
  },

  priceHistory: {
    list: (params?: {
      material_id?: number; supplier_id?: number; limit?: number
    }): Promise<PriceHistory[]> =>
      window.api.priceHistory.list(params) as Promise<PriceHistory[]>,
    byMaterial: (id: number): Promise<{
      material: Material; history: PriceHistory[]; trend: number | null
    }> => window.api.priceHistory.byMaterial(id) as Promise<{
      material: Material; history: PriceHistory[]; trend: number | null
    }>,
    create: (d: unknown): Promise<PriceHistory> =>
      window.api.priceHistory.create(d) as Promise<PriceHistory>,
    delete: (id: number) =>
      window.api.priceHistory.delete(id),
  },
}
