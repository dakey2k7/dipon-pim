import { registerCategoryHandlers }    from './categories'
import { registerSupplierHandlers }     from './suppliers'
import { registerMaterialHandlers }     from './materials'
import { registerPriceHistoryHandlers } from './price-history'
import { registerDashboardHandlers }    from './dashboard'
import { registerPackagingHandlers }    from './packaging'
import { registerCalcHandlers }         from './calc'
import { registerProductHandlers }      from './products'
import { registerCurrencyHandlers }     from './currency'
import { registerDocumentHandlers }     from './documents'
import { registerAuditHandlers }        from './audit'
import { registerVatHandlers }          from './vat'
import { registerBackupHandlers }       from './backup'

export function registerAllHandlers(): void {
  registerCategoryHandlers()
  registerSupplierHandlers()
  registerMaterialHandlers()
  registerPriceHistoryHandlers()
  registerDashboardHandlers()
  registerPackagingHandlers()
  registerCalcHandlers()
  registerProductHandlers()
  registerCurrencyHandlers()
  registerDocumentHandlers()
  registerAuditHandlers()
  registerVatHandlers()
  registerBackupHandlers()
  console.log('📡 Alle IPC-Handler registriert')
}
