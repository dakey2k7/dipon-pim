import { registerCategoryHandlers }       from './categories'
import { registerSupplierHandlers }        from './suppliers'
import { registerMaterialHandlers }        from './materials'
import { registerPriceHistoryHandlers }    from './price-history'
import { registerDashboardHandlers }       from './dashboard'
import { registerPackagingHandlers }       from './packaging'
import { registerCalcHandlers }            from './calc'
import { registerProductImageHandlers }    from './product-images'
import { registerExportImportHandlers }    from './export-import'
import { registerVariantTemplateHandlers } from './variant-templates'
import { registerProducts2kHandlers }      from './products2k'
import { registerProductHandlers }         from './products'
import { registerRecipesCsvHandlers }      from './recipes-csv'
import { registerCurrencyHandlers }        from './currency'
import { registerDocumentHandlers }        from './documents'
import { registerAuditHandlers }           from './audit'
import { registerVatHandlers }             from './vat'
import { registerBackupHandlers }          from './backup'
import { registerPricingHandlers, ensurePricingTables }          from './pricing'
import { registerCompetitorHandlers, ensureCompetitorTables }    from './competitors'
import { registerSystemHandlers }                                    from './systems'
import { registerPsmHandlers }                                       from './psm'
import { registerGeoHandlers }                                       from './geo'

export function registerAllHandlers(): void {
  registerCategoryHandlers()
  registerSupplierHandlers()
  registerMaterialHandlers()
  registerPriceHistoryHandlers()
  registerDashboardHandlers()
  registerPackagingHandlers()
  registerCalcHandlers()
  registerProductImageHandlers()
  registerExportImportHandlers()
  registerVariantTemplateHandlers()
  registerProducts2kHandlers()
  registerProductHandlers()
  registerRecipesCsvHandlers()
  registerCurrencyHandlers()
  registerDocumentHandlers()
  registerAuditHandlers()
  registerVatHandlers()
  registerBackupHandlers()
  ensurePricingTables()
  registerPricingHandlers()
  ensureCompetitorTables()
  registerCompetitorHandlers()
  registerSystemHandlers()
  registerGeoHandlers()
  registerPsmHandlers()
  console.log('📡 Alle IPC-Handler registriert')
}
