import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  dashboard: {
    stats:       () => ipcRenderer.invoke('dashboard:stats'),
    getStats:    () => ipcRenderer.invoke('dashboard:stats'),
    getCurrency: () => ipcRenderer.invoke('dashboard:currency'),
  },
  categories: {
    list:   ()                            => ipcRenderer.invoke('categories:list'),
    get:    (id: number)                  => ipcRenderer.invoke('categories:get', id),
    create: (d: unknown)                  => ipcRenderer.invoke('categories:create', d),
    update: (id: number, d: unknown)      => ipcRenderer.invoke('categories:update', id, d),
    delete: (id: number)                  => ipcRenderer.invoke('categories:delete', id),
  },
  suppliers: {
    list:            (s?: string)              => ipcRenderer.invoke('suppliers:list', s),
    get:             (id: number)              => ipcRenderer.invoke('suppliers:get', id),
    create:          (d: unknown)              => ipcRenderer.invoke('suppliers:create', d),
    update:          (id: number, d: unknown)  => ipcRenderer.invoke('suppliers:update', id, d),
    toggleActive:    (id: number)              => ipcRenderer.invoke('suppliers:toggleActive', id),
    getConditions:   (id: number)              => ipcRenderer.invoke('suppliers:getConditions', id),
    getMaterials:    (id: number)              => ipcRenderer.invoke('suppliers:getMaterials', id),
    saveCondition:   (id: number, d: unknown)  => ipcRenderer.invoke('suppliers:saveCondition', id, d),
    deleteCondition: (id: number)              => ipcRenderer.invoke('suppliers:deleteCondition', id),
    delete:          (id: number)              => ipcRenderer.invoke('suppliers:delete', id),
  },
  materials: {
    list:        (p?: unknown)            => ipcRenderer.invoke('materials:list', p),
    get:         (id: number)             => ipcRenderer.invoke('materials:get', id),
    create:      (d: unknown)             => ipcRenderer.invoke('materials:create', d),
    update:      (id: number, d: unknown) => ipcRenderer.invoke('materials:update', id, d),
    delete:      (id: number)             => ipcRenderer.invoke('materials:delete', id),
    getPrices:   (id: number)             => ipcRenderer.invoke('materials:getPrices', id),
    savePrice:   (id: number, d: unknown) => ipcRenderer.invoke('materials:savePrice', id, d),
    deletePrice: (mid: number, pid: number) => ipcRenderer.invoke('materials:deletePrice', mid, pid),
  },
  priceHistory: {
    list:       (p?: unknown) => ipcRenderer.invoke('priceHistory:list', p),
    byMaterial: (id: number)  => ipcRenderer.invoke('priceHistory:byMaterial', id),
    create:     (d: unknown)  => ipcRenderer.invoke('priceHistory:create', d),
    delete:     (id: number)  => ipcRenderer.invoke('priceHistory:delete', id),
  },
  packaging: {
    list:   (p?: unknown)             => ipcRenderer.invoke('packaging:list', p),
    get:    (id: number)              => ipcRenderer.invoke('packaging:get', id),
    create: (d: unknown)              => ipcRenderer.invoke('packaging:create', d),
    update: (id: number, d: unknown)  => ipcRenderer.invoke('packaging:update', id, d),
    delete: (id: number)              => ipcRenderer.invoke('packaging:delete', id),
  },
  cartons: {
    list:   (s?: string)              => ipcRenderer.invoke('cartons:list', s),
    get:    (id: number)              => ipcRenderer.invoke('cartons:get', id),
    create: (d: unknown)              => ipcRenderer.invoke('cartons:create', d),
    update: (id: number, d: unknown)  => ipcRenderer.invoke('cartons:update', id, d),
    delete: (id: number)              => ipcRenderer.invoke('cartons:delete', id),
  },
  labels: {
    list:   (s?: string)              => ipcRenderer.invoke('labels:list', s),
    get:    (id: number)              => ipcRenderer.invoke('labels:get', id),
    create: (d: unknown)              => ipcRenderer.invoke('labels:create', d),
    update: (id: number, d: unknown)  => ipcRenderer.invoke('labels:update', id, d),
    delete: (id: number)              => ipcRenderer.invoke('labels:delete', id),
  },
  calc: {
    listProfiles:     ()                              => ipcRenderer.invoke('calc:listProfiles'),
    getProfile:       (id: number)                    => ipcRenderer.invoke('calc:getProfile', id),
    createProfile:    (d: unknown)                    => ipcRenderer.invoke('calc:createProfile', d),
    updateProfile:    (id: number, d: unknown)        => ipcRenderer.invoke('calc:updateProfile', id, d),
    deleteProfile:    (id: number)                    => ipcRenderer.invoke('calc:deleteProfile', id),
    duplicateProfile: (id: number, name: string)      => ipcRenderer.invoke('calc:duplicateProfile', id, name),
    getSteps:         (pid: number)                   => ipcRenderer.invoke('calc:getSteps', pid),
    saveStep:         (d: unknown)                    => ipcRenderer.invoke('calc:saveStep', d),
    deleteStep:       (id: number)                    => ipcRenderer.invoke('calc:deleteStep', id),
    reorderSteps:     (pid: number, ids: number[])    => ipcRenderer.invoke('calc:reorderSteps', pid, ids),
    run:              (pid: number, ov?: unknown)      => ipcRenderer.invoke('calc:run', pid, ov),
    runMultiple:      (ids: number[], ov?: unknown)    => ipcRenderer.invoke('calc:runMultiple', ids, ov),
    exportCSV:        (pid: number, ov?: unknown)      => ipcRenderer.invoke('calc:exportCSV', pid, ov),
  },
  productGroups: {
    list:   ()                            => ipcRenderer.invoke('productGroups:list'),
    create: (d: unknown)                  => ipcRenderer.invoke('productGroups:create', d),
    update: (id: number, d: unknown)      => ipcRenderer.invoke('productGroups:update', id, d),
    delete: (id: number)                  => ipcRenderer.invoke('productGroups:delete', id),
  },
  exportImport: {
    exportVariantTemplates:         () => ipcRenderer.invoke('export:variantTemplates'),
    exportVariantTemplatesXlsx:     () => ipcRenderer.invoke('export:variantTemplatesXlsx'),
    exportVariantTemplatesData:     () => ipcRenderer.invoke('export:variantTemplatesData'),
    exportProductsData:             () => ipcRenderer.invoke('export:productsData'),
    exportVariantTemplatesTemplate: () => ipcRenderer.invoke('export:variantTemplatesTemplate'),
    importVariantTemplates:         () => ipcRenderer.invoke('import:variantTemplates'),
    exportProducts:                 () => ipcRenderer.invoke('export:products'),
    exportProductsXlsx:             () => ipcRenderer.invoke('export:productsXlsx'),
    exportProductsTemplate:         () => ipcRenderer.invoke('export:productsTemplate'),
    importProducts:                 () => ipcRenderer.invoke('import:products'),
  },
  variantTemplates: {
    list:          ()                                     => ipcRenderer.invoke('variantTemplates:list'),
    create:        (d: unknown)                           => ipcRenderer.invoke('variantTemplates:create', d),
    update:        (id: number, d: unknown)               => ipcRenderer.invoke('variantTemplates:update', id, d),
    delete:        (id: number)                           => ipcRenderer.invoke('variantTemplates:delete', id),
    getAssignments:(productId: number)                    => ipcRenderer.invoke('variantTemplates:getAssignments', productId),
    assign:        (pid: number, tid: number, d: unknown) => ipcRenderer.invoke('variantTemplates:assign', pid, tid, d),
    unassign:      (pid: number, tid: number)             => ipcRenderer.invoke('variantTemplates:unassign', pid, tid),
  },
  productImages: {
    upload:  (productId: number) => ipcRenderer.invoke('productImages:upload', productId),
    get:     (productId: number) => ipcRenderer.invoke('productImages:get', productId),
    getFull: (productId: number) => ipcRenderer.invoke('productImages:getFull', productId),
    delete:  (productId: number) => ipcRenderer.invoke('productImages:delete', productId),
  },
  products2k: {
    list:          (p?: unknown)              => ipcRenderer.invoke('products2k:list', p),
    get:           (id: number)               => ipcRenderer.invoke('products2k:get', id),
    create:        (d: unknown)               => ipcRenderer.invoke('products2k:create', d),
    update:        (id: number, d: unknown)   => ipcRenderer.invoke('products2k:update', id, d),
    delete:        (id: number)               => ipcRenderer.invoke('products2k:delete', id),
    saveVariant:   (pid: number, d: unknown)  => ipcRenderer.invoke('products2k:saveVariant', pid, d),
    deleteVariant: (pid: number, vid: number) => ipcRenderer.invoke('products2k:deleteVariant', pid, vid),
    systemPrices:  ()                         => ipcRenderer.invoke('products2k:systemPrices'),
  },
  pricing: {
    tierslist:    ()                       => ipcRenderer.invoke('pricing:tiers:list'),
    tiersSave:    (t: any)                 => ipcRenderer.invoke('pricing:tiers:save', t),
    tiersDelete:  (id: number)             => ipcRenderer.invoke('pricing:tiers:delete', id),
    sizesList:    (id: number)             => ipcRenderer.invoke('pricing:sizes:list', id),
    sizesSave:    (id: number, s: number[]) => ipcRenderer.invoke('pricing:sizes:save', id, s),
    calculate:    (opts: any)              => ipcRenderer.invoke('pricing:calculate', opts),
    pricesSave:   (id: number, p: any[])   => ipcRenderer.invoke('pricing:prices:save', id, p),
    simulate:     (changes: any[])         => ipcRenderer.invoke('pricing:simulate', changes),
    scenarioSave: (d: any)                 => ipcRenderer.invoke('pricing:scenario:save', d),
    scenarioList: ()                       => ipcRenderer.invoke('pricing:scenario:list'),
    scenarioGet:  (id: number)             => ipcRenderer.invoke('pricing:scenario:get', id),
    shipping: {
      list: ()        => ipcRenderer.invoke('pricing:shipping:list'),
      save: (r: any)  => ipcRenderer.invoke('pricing:shipping:save', r),
    },
  },
  recipes: {
    exportCSV:        ()             => ipcRenderer.invoke('recipes:exportCSV'),
    downloadTemplate: ()             => ipcRenderer.invoke('recipes:downloadTemplate'),
    previewCSV:       ()             => ipcRenderer.invoke('recipes:previewCSV'),
    importCSV:        (mode: string) => ipcRenderer.invoke('recipes:importCSV', mode),
  },
  products: {
    list:           (p?: unknown)             => ipcRenderer.invoke('products:list', p),
    get:            (id: number)              => ipcRenderer.invoke('products:get', id),
    create:         (d: unknown)              => ipcRenderer.invoke('products:create', d),
    update:         (id: number, d: unknown)  => ipcRenderer.invoke('products:update', id, d),
    delete:         (id: number)              => ipcRenderer.invoke('products:delete', id),
    saveMaterial:   (pid: number, d: unknown) => ipcRenderer.invoke('products:saveMaterial', pid, d),
    deleteMaterial: (pid: number, mid: number) => ipcRenderer.invoke('products:deleteMaterial', pid, mid),
      reorderMaterial: (productId: number, matId: number, dir: 'up' | 'down') => ipcRenderer.invoke('products:reorderMaterial', productId, matId, dir),
    saveVariant:    (pid: number, d: unknown) => ipcRenderer.invoke('products:saveVariant', pid, d),
    deleteVariant:  (pid: number, vid: number) => ipcRenderer.invoke('products:deleteVariant', pid, vid),
    restore:        (id: number)              => ipcRenderer.invoke('products:restore', id),
    permanentDelete:(id: number)              => ipcRenderer.invoke('products:permanentDelete', id),
    trash:          ()                        => ipcRenderer.invoke('products:trash'),
    calcVariantCost:(vid: number, ov?: unknown) => ipcRenderer.invoke('products:calcVariantCost', vid, ov),
  },
  psm: {
    folders: {
      list:   ()            => ipcRenderer.invoke('psm:folders:list'),
      save:   (d: unknown)  => ipcRenderer.invoke('psm:folders:save', d),
      delete: (id: number)  => ipcRenderer.invoke('psm:folders:delete', id),
    },
    calcs: {
      list:   (folderId?: number | null) => ipcRenderer.invoke('psm:calcs:list', folderId),
      get:    (id: number)               => ipcRenderer.invoke('psm:calcs:get', id),
      save:   (d: unknown)               => ipcRenderer.invoke('psm:calcs:save', d),
      delete: (id: number)               => ipcRenderer.invoke('psm:calcs:delete', id),
    },
    rows: {
      save: (calc_id: number, rows: unknown[]) => ipcRenderer.invoke('psm:rows:save', calc_id, rows),
    },
    export: (calc_id: number) => ipcRenderer.invoke('psm:export', calc_id),
    import: (folder_id?: number) => ipcRenderer.invoke('psm:import', folder_id),
  },
  geo: {
    countries: {
      list:       (filter?: unknown)                       => ipcRenderer.invoke('geo:countries:list', filter),
      update:     (iso2: string, d: unknown)               => ipcRenderer.invoke('geo:countries:update', iso2, d),
    },
    vat: {
      history:    (iso2: string)                           => ipcRenderer.invoke('geo:vat:history', iso2),
      allCurrent: ()                                       => ipcRenderer.invoke('geo:vat:all-current'),
      save:       (d: unknown)                             => ipcRenderer.invoke('geo:vat:save', d),
    },
  },
  shipping: {
    carriers: {
      list: ()              => ipcRenderer.invoke('shipping:carriers:list'),
      save: (d: unknown)    => ipcRenderer.invoke('shipping:carriers:save', d),
    },
    zones: {
      list:         (carrier_id: number)              => ipcRenderer.invoke('shipping:zones:list', carrier_id),
      save:         (d: unknown)                      => ipcRenderer.invoke('shipping:zones:save', d),
      delete:       (id: number)                      => ipcRenderer.invoke('shipping:zones:delete', id),
      countries: {
        list: (zone_id: number)                       => ipcRenderer.invoke('shipping:zones:countries:list', zone_id),
        set:  (zone_id: number, isos: string[])       => ipcRenderer.invoke('shipping:zones:countries:set', zone_id, isos),
      },
    },
    tiers: {
      list:   (zone_id: number)  => ipcRenderer.invoke('shipping:tiers:list', zone_id),
      save:   (d: unknown)       => ipcRenderer.invoke('shipping:tiers:save', d),
      delete: (id: number)       => ipcRenderer.invoke('shipping:tiers:delete', id),
    },
    calculate: (d: unknown) => ipcRenderer.invoke('shipping:calculate', d),
  },
  payment: {
    providers: {
      list:   ()            => ipcRenderer.invoke('payment:providers:list'),
      save:   (d: unknown)  => ipcRenderer.invoke('payment:providers:save', d),
      delete: (id: number)  => ipcRenderer.invoke('payment:fees:delete-provider', id),
    },
    fees: {
      list:   (provider_id: number) => ipcRenderer.invoke('payment:fees:list', provider_id),
      save:   (d: unknown)          => ipcRenderer.invoke('payment:fees:save', d),
      delete: (id: number)          => ipcRenderer.invoke('payment:fees:delete', id),
    },
  },
  systems: {
    list:       ()                                       => ipcRenderer.invoke('systems:list'),
    get:        (id: number)                             => ipcRenderer.invoke('systems:get', id),
    create:     (d: unknown)                             => ipcRenderer.invoke('systems:create', d),
    update:     (id: number, d: unknown)                 => ipcRenderer.invoke('systems:update', id, d),
    delete:     (id: number)                             => ipcRenderer.invoke('systems:delete', id),
    calculate:  (opts: unknown)                          => ipcRenderer.invoke('systems:calculate', opts),
    hardeners: {
      list:   (system_id: number)                       => ipcRenderer.invoke('systems:hardeners:list', system_id),
      add:    (system_id: number, d: unknown)           => ipcRenderer.invoke('systems:hardeners:add', system_id, d),
      update: (hardener_id: number, d: unknown)         => ipcRenderer.invoke('systems:hardeners:update', hardener_id, d),
      remove: (hardener_id: number)                     => ipcRenderer.invoke('systems:hardeners:remove', hardener_id),
    },
    sizes: {
      list: ()                                          => ipcRenderer.invoke('systems:sizes:list'),
      save: (d: unknown)                               => ipcRenderer.invoke('systems:sizes:save', d),
    },
    prices: {
      save: (rows: unknown[])                           => ipcRenderer.invoke('systems:prices:save', rows),
    },
    probe: {
      calc: (d: unknown)                               => ipcRenderer.invoke('systems:probe:calc', d),
    },
  },
  competitors: {
    list:    ()                           => ipcRenderer.invoke('competitors:list'),
    create:  (d: unknown)                 => ipcRenderer.invoke('competitors:create', d),
    update:  (id: number, d: unknown)     => ipcRenderer.invoke('competitors:update', id, d),
    delete:  (id: number)                 => ipcRenderer.invoke('competitors:delete', id),
    compare: (opts?: unknown)             => ipcRenderer.invoke('competitors:compare', opts),
    stats:   (prices: unknown)            => ipcRenderer.invoke('competitors:stats', prices),
    prices: {
      list:   (competitorId: number)             => ipcRenderer.invoke('competitors:prices:list', competitorId),
      save:   (competitorId: number, d: unknown) => ipcRenderer.invoke('competitors:prices:save', competitorId, d),
      delete: (id: number)                       => ipcRenderer.invoke('competitors:prices:delete', id),
    },
  },
  currency: {
    getSupportedList: ()                                          => ipcRenderer.invoke('currency:getSupportedList'),
    fetchRates:       (base?: string)                             => ipcRenderer.invoke('currency:fetchRates', base),
    fetchHistory:     (base: string, target: string, days: number) => ipcRenderer.invoke('currency:fetchHistory', base, target, days),
    convert:          (amount: number, from: string, to: string)  => ipcRenderer.invoke('currency:convert', amount, from, to),
    getCached:        (base?: string)                             => ipcRenderer.invoke('currency:getCached', base),
  },
  audit: {
    list:  (limit?: number) => ipcRenderer.invoke('audit:list', limit),
    count: ()               => ipcRenderer.invoke('audit:count'),
    clear: ()               => ipcRenderer.invoke('audit:clear'),
  },
  backup: {
    create:       (tag?: string)  => ipcRenderer.invoke('backup:create', tag),
    list:         ()              => ipcRenderer.invoke('backup:list'),
    delete:       (path: string)  => ipcRenderer.invoke('backup:delete', path),
    restore:      (path: string)  => ipcRenderer.invoke('backup:restore', path),
    getSettings:  ()              => ipcRenderer.invoke('backup:getSettings'),
    saveSettings: (s: unknown)    => ipcRenderer.invoke('backup:saveSettings', s),
  },
  vat: {
    check:       (vatId: string, ownId?: string) => ipcRenderer.invoke('vat:check', vatId, ownId),
    getLog:      (limit?: number)                => ipcRenderer.invoke('vat:getLog', limit),
    recheck:     (ids: string[])                 => ipcRenderer.invoke('vat:recheck', ids),
    getKnownIds: ()                              => ipcRenderer.invoke('vat:getKnownIds'),
  },
  documents: {
    upload:     (entityType: string, entityId: number, meta?: unknown) => ipcRenderer.invoke('documents:upload', entityType, entityId, meta),
    list:       (entityType: string, entityId: number)                 => ipcRenderer.invoke('documents:list', entityType, entityId),
    open:       (docId: number)                                        => ipcRenderer.invoke('documents:open', docId),
    preview:    (docId: number)                                        => ipcRenderer.invoke('documents:preview', docId),
    delete:     (docId: number)                                        => ipcRenderer.invoke('documents:delete', docId),
    purge:      (docId: number)                                        => ipcRenderer.invoke('documents:purge', docId),
    saveBuffer: (entityType: string, entityId: number, fileName: string, fileData: ArrayBuffer, meta?: unknown) =>
      ipcRenderer.invoke('documents:saveBuffer', entityType, entityId, fileName, Buffer.from(fileData), meta),
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) { console.error(e) }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
