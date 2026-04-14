/**
 * api.ts – Universeller Transport-Layer
 *
 * Electron-Modus:  window.api ist verfügbar  → IPC direkt (kein HTTP)
 * Browser-Modus:   window.api fehlt          → fetch('/api/...')
 *
 * Komponenten rufen immer `api.materials.list()` auf – egal welcher Modus.
 */

import type {
  Category, Supplier, Material, SupplierPrice,
  PriceHistory, DashboardStats,
} from '@/types'

// ─── Erkennung ────────────────────────────────────────────────
const isElectron = (): boolean =>
  typeof window !== 'undefined' && typeof window.api !== 'undefined'

// ─── HTTP-Fallback (Browser-Modus) ────────────────────────────
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new HttpError(res.status, body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

const get  = <T>(path: string)             => http<T>(path)
const post = <T>(path: string, body: unknown) => http<T>(path, { method:'POST',  body: JSON.stringify(body) })
const put  = <T>(path: string, body: unknown) => http<T>(path, { method:'PUT',   body: JSON.stringify(body) })
const patch= <T>(path: string)             => http<T>(path, { method:'PATCH'  })
const del  = <T>(path: string)             => http<T>(path, { method:'DELETE' })

// ─── API-Objekt ───────────────────────────────────────────────
export const api = {

  // ── Dashboard ──────────────────────────────────────────────
  dashboard: {
    stats: (): Promise<DashboardStats> =>
      isElectron()
        ? window.api.dashboard.stats() as Promise<DashboardStats>
        : get<{ data: DashboardStats }>('/dashboard/stats').then(r => r.data),
  },

  // ── Kategorien ─────────────────────────────────────────────
  categories: {
    list: (): Promise<Category[]> =>
      isElectron()
        ? window.api.categories.list() as Promise<Category[]>
        : get<{ data: Category[] }>('/categories').then(r => r.data),

    get: (id: number): Promise<Category> =>
      isElectron()
        ? window.api.categories.get(id) as Promise<Category>
        : get<{ data: Category }>(`/categories/${id}`).then(r => r.data),

    create: (d: unknown): Promise<Category> =>
      isElectron()
        ? window.api.categories.create(d) as Promise<Category>
        : post<{ data: Category }>('/categories', d).then(r => r.data),

    update: (id: number, d: unknown): Promise<Category> =>
      isElectron()
        ? window.api.categories.update(id, d) as Promise<Category>
        : put<{ data: Category }>(`/categories/${id}`, d).then(r => r.data),

    delete: (id: number) =>
      isElectron()
        ? window.api.categories.delete(id)
        : del(`/categories/${id}`),
  },

  // ── Lieferanten ────────────────────────────────────────────
  suppliers: {
    list: (search?: string): Promise<Supplier[]> =>
      isElectron()
        ? window.api.suppliers.list(search) as Promise<Supplier[]>
        : get<{ data: Supplier[] }>(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.data),

    get: (id: number): Promise<Supplier> =>
      isElectron()
        ? window.api.suppliers.get(id) as Promise<Supplier>
        : get<{ data: Supplier }>(`/suppliers/${id}`).then(r => r.data),

    create: (d: unknown): Promise<Supplier> =>
      isElectron()
        ? window.api.suppliers.create(d) as Promise<Supplier>
        : post<{ data: Supplier }>('/suppliers', d).then(r => r.data),

    update: (id: number, d: unknown): Promise<Supplier> =>
      isElectron()
        ? window.api.suppliers.update(id, d) as Promise<Supplier>
        : put<{ data: Supplier }>(`/suppliers/${id}`, d).then(r => r.data),

    toggleActive: (id: number): Promise<Supplier> =>
      isElectron()
        ? window.api.suppliers.toggleActive(id) as Promise<Supplier>
        : patch<{ data: Supplier }>(`/suppliers/${id}/toggle-active`).then(r => r.data),

    delete: (id: number) =>
      isElectron()
        ? window.api.suppliers.delete(id)
        : del(`/suppliers/${id}`),
  },

  // ── Materialien ────────────────────────────────────────────
  materials: {
    list: (params?: { search?: string; category_id?: number; low_stock?: boolean }): Promise<Material[]> => {
      if (isElectron()) return window.api.materials.list(params) as Promise<Material[]>
      const q = new URLSearchParams()
      if (params?.search)      q.set('search', params.search)
      if (params?.category_id) q.set('category_id', String(params.category_id))
      if (params?.low_stock)   q.set('low_stock', 'true')
      const qs = q.toString()
      return get<{ data: Material[] }>(`/materials${qs ? `?${qs}` : ''}`).then(r => r.data)
    },

    get: (id: number): Promise<Material & { prices: SupplierPrice[] }> =>
      isElectron()
        ? window.api.materials.get(id) as Promise<Material & { prices: SupplierPrice[] }>
        : get<{ data: Material & { prices: SupplierPrice[] } }>(`/materials/${id}`).then(r => r.data),

    create: (d: unknown): Promise<Material> =>
      isElectron()
        ? window.api.materials.create(d) as Promise<Material>
        : post<{ data: Material }>('/materials', d).then(r => r.data),

    update: (id: number, d: unknown): Promise<Material> =>
      isElectron()
        ? window.api.materials.update(id, d) as Promise<Material>
        : put<{ data: Material }>(`/materials/${id}`, d).then(r => r.data),

    delete: (id: number) =>
      isElectron()
        ? window.api.materials.delete(id)
        : del(`/materials/${id}`),

    getPrices: (id: number): Promise<SupplierPrice[]> =>
      isElectron()
        ? window.api.materials.getPrices(id) as Promise<SupplierPrice[]>
        : get<{ data: SupplierPrice[] }>(`/materials/${id}/prices`).then(r => r.data),

    savePrice: (id: number, d: unknown) =>
      isElectron()
        ? window.api.materials.savePrice(id, d)
        : post(`/materials/${id}/prices`, d),

    deletePrice: (matId: number, priceId: number) =>
      isElectron()
        ? window.api.materials.deletePrice(matId, priceId)
        : del(`/materials/${matId}/prices/${priceId}`),
  },

  // ── Preis-Historien ────────────────────────────────────────
  priceHistory: {
    list: (params?: { material_id?: number; supplier_id?: number; limit?: number }): Promise<PriceHistory[]> => {
      if (isElectron()) return window.api.priceHistory.list(params) as Promise<PriceHistory[]>
      const q = new URLSearchParams()
      if (params?.material_id) q.set('material_id', String(params.material_id))
      if (params?.supplier_id) q.set('supplier_id', String(params.supplier_id))
      if (params?.limit)       q.set('limit', String(params.limit))
      const qs = q.toString()
      return get<{ data: PriceHistory[] }>(`/price-history${qs ? `?${qs}` : ''}`).then(r => r.data)
    },

    byMaterial: (id: number) =>
      isElectron()
        ? window.api.priceHistory.byMaterial(id)
        : get<{ data: unknown }>(`/price-history/material/${id}`).then(r => r.data),

    create: (d: unknown): Promise<PriceHistory> =>
      isElectron()
        ? window.api.priceHistory.create(d) as Promise<PriceHistory>
        : post<{ data: PriceHistory }>('/price-history', d).then(r => r.data),

    delete: (id: number) =>
      isElectron()
        ? window.api.priceHistory.delete(id)
        : del(`/price-history/${id}`),
  },
}

export { isElectron }
