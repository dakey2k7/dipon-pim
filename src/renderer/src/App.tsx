import { HashRouter, BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell }             from '@/components/layout/AppShell'
import Dashboard                from '@/pages/Dashboard'
import CategoriesPage           from '@/pages/categories/CategoriesPage'
import SuppliersPage            from '@/pages/suppliers/SuppliersPage'
import MaterialsPage            from '@/pages/materials/MaterialsPage'
import PriceHistoryPage, { PlaceholderPage } from '@/pages/price-history/PriceHistoryPage'
import MarginsPage              from '@/pages/margins/MarginsPage'
import ProductsPage             from '@/pages/products/ProductsPage'
import ProductCreatePage        from '@/pages/products/ProductCreatePage'
import CurrencyPage             from '@/pages/currency/CurrencyPage'
import VatCheckerPage           from '@/pages/vat/VatCheckerPage'
import ScenarioPage             from '@/pages/scenario/ScenarioPage'
import SettingsPage             from '@/pages/settings/SettingsPage'
import PackagingPage            from '@/pages/packaging/PackagingPage'
import LabelsPage               from '@/pages/labels/LabelsPage'
import CartonsPage              from '@/pages/cartons/CartonsPage'
import { PlatformsPage, CustomersPage, DiscountsPage } from '@/pages/platforms/BusinessPages'
import RecipesPage              from '@/pages/recipes/RecipesPage'
import SystemsPage              from '@/pages/systems/SystemsPage'
import VatRatesPage            from '@/pages/vat-rates/VatRatesPage'
import ShippingPage             from '@/pages/shipping/ShippingPage'
import PaymentProfilesPage      from '@/pages/payment/PaymentProfilesPage'
import PsmKalkulationPage       from '@/pages/psm/PsmKalkulationPage'
import RmiiPage                 from '@/pages/rmii/RmiiPage'
import SystempreisePage         from '@/pages/systemprices/SystempreisePage'
import DocumentsPage            from '@/pages/documents/DocumentsPage'
import TrashPage                from '@/pages/trash/TrashPage'
import VariantTemplatesPage     from '@/pages/variant-templates/VariantTemplatesPage'
import PreistabellePage         from '@/pages/preistabelle/PreistabellePage'
import WettbewerbPage           from '@/pages/wettbewerb/WettbewerbPage'
import { isElectron }           from '@/lib/api'
import { useThemeStore, applyThemeToDom } from '@/store/themeStore'

const Router = isElectron() ? HashRouter : BrowserRouter
const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
})

export default function App() {
  const { active } = useThemeStore()
  try {
    if (typeof document !== 'undefined') {
      const safeBg = (active.bgPrimary||'').match(/^#[0-9a-f]/i) && !active.bgPrimary.match(/^#[2-9a-f][^0]/i)
        ? active.bgPrimary : '#0c0e1a'
      applyThemeToDom({ ...active, bgPrimary: safeBg })
      document.body.style.background = '#0c0e1a'
      document.documentElement.style.background = '#0c0e1a'
    }
  } catch {}

  return (
    <QueryClientProvider client={qc}>
      <Router>
        <Routes>
          <Route element={<AppShell />}>
            <Route index                    element={<Dashboard />} />
            <Route path="categories"        element={<CategoriesPage />} />
            <Route path="suppliers"         element={<SuppliersPage />} />
            <Route path="materials"         element={<MaterialsPage />} />
            <Route path="price-history"     element={<PriceHistoryPage />} />
            <Route path="products"          element={<ProductsPage />} />
            <Route path="products/new"      element={<ProductCreatePage />} />
            <Route path="products/edit/:id" element={<ProductCreatePage />} />
            <Route path="recipes"           element={<RecipesPage />} />
            <Route path="systems"           element={<SystemsPage />} />
            <Route path="vat-rates"         element={<VatRatesPage />} />
            <Route path="shipping-manager"  element={<ShippingPage />} />
            <Route path="payment-profiles"  element={<PaymentProfilesPage />} />
            <Route path="psm-kalkulation"   element={<PsmKalkulationPage />} />
            <Route path="rmii"              element={<RmiiPage />} />
            <Route path="margins"           element={<MarginsPage />} />
            <Route path="preistabelle"      element={<PreistabellePage />} />
            <Route path="wettbewerb"        element={<WettbewerbPage />} />
            <Route path="system-prices"     element={<SystempreisePage />} />
            <Route path="currency"          element={<CurrencyPage />} />
            <Route path="vat"               element={<VatCheckerPage />} />
            <Route path="scenario"          element={<ScenarioPage />} />
            <Route path="packaging"         element={<PackagingPage />} />
            <Route path="labels"            element={<LabelsPage />} />
            <Route path="cartons"           element={<CartonsPage />} />
            <Route path="platforms"         element={<PlatformsPage />} />
            <Route path="payments"          element={<PlaceholderPage title="Zahlungsprofile" phase="wie Plattformprofile" />} />
            <Route path="customers"         element={<CustomersPage />} />
            <Route path="discounts"         element={<DiscountsPage />} />
            <Route path="documents"         element={<DocumentsPage />} />
            <Route path="trash"             element={<TrashPage />} />
            <Route path="variant-templates" element={<VariantTemplatesPage />} />
            <Route path="settings"          element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}
