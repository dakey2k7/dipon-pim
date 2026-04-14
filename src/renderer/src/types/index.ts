export interface BaseEntity {
  id: number; created_at: string; updated_at: string;
}
export interface Category extends BaseEntity {
  name: string; code: string | null; parent_id: number | null; parent_name?: string;
  description: string | null; color: string; icon: string; sort_order: number;
  children_count?: number; materials_count?: number;
}
export interface Supplier extends BaseEntity {
  name: string; code: string; contact_person: string | null; email: string | null;
  phone: string | null; website: string | null; address: string | null;
  postal_code: string | null; city: string | null; country: string;
  tax_id: string | null; payment_terms: number; lead_time_days: number;
  currency: string; discount_percent: number; notes: string | null;
  is_active: number; materials_count?: number; prices?: SupplierPrice[];
}
export interface Material extends BaseEntity {
  name: string; code: string; category_id: number | null;
  category_name?: string; category_color?: string; unit: string;
  density: number | null; description: string | null; cas_number: string | null;
  inci_name: string | null; min_stock: number; current_stock: number;
  safety_stock: number; storage_conditions: string | null;
  shelf_life_months: number | null; is_hazardous: number; is_active: number;
  preferred_price?: number; preferred_currency?: string; preferred_unit?: string;
  preferred_supplier?: string; supplier_count?: number; prices?: SupplierPrice[];
}
export interface SupplierPrice extends BaseEntity {
  material_id: number; supplier_id: number; supplier_name?: string;
  supplier_code?: string; price_per_unit: number; currency: string; unit: string;
  min_order_qty: number; min_order_unit: string | null; lead_time_days: number | null;
  is_preferred: number; valid_from: string | null; valid_until: string | null;
  notes: string | null;
}
export interface PriceHistory {
  id: number; material_id: number; material_name?: string; material_code?: string;
  supplier_id: number | null; supplier_name?: string; price_per_unit: number;
  currency: string; unit: string; change_percent: number | null;
  recorded_at: string; source: string; invoice_number: string | null; notes: string | null;
}
export interface DashboardStats {
  materials_count: number; suppliers_count: number;
  categories_count: number; low_stock_count: number;
  recent_price_changes: PriceHistory[];
  top_materials_by_cost: Array<{ material_name:string; price_per_unit:number; currency:string; unit:string }>;
  suppliers_by_material_count: Array<{ name:string; code:string; material_count:number }>;
  price_changes_last_30d: Array<{ date:string; changes:number; avg_change:number }>;
}
export type CategoryFormData = {
  name:string; code:string; parent_id:string; description:string;
  color:string; icon:string; sort_order:number;
}
export type SupplierFormData = {
  name:string; code:string; contact_person:string; email:string; phone:string;
  website:string; address:string; postal_code:string; city:string; country:string;
  tax_id:string; payment_terms:number; lead_time_days:number; currency:string;
  discount_percent:number; notes:string; is_active:number;
}
export type MaterialFormData = {
  name:string; code:string; category_id:string; unit:string; density:string;
  description:string; cas_number:string; inci_name:string; min_stock:number;
  current_stock:number; safety_stock:number; storage_conditions:string;
  shelf_life_months:string; is_hazardous:number; is_active:number;
}
export type SupplierPriceFormData = {
  supplier_id:string; price_per_unit:number; currency:string; unit:string;
  min_order_qty:number; lead_time_days:string; is_preferred:number;
  valid_from:string; notes:string;
}
export type PriceHistoryFormData = {
  material_id:string; supplier_id:string; price_per_unit:number; currency:string;
  unit:string; recorded_at:string; source:string; invoice_number:string; notes:string;
}
