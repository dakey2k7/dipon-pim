import { useQuery }     from '@tanstack/react-query'
import { FlaskConical, Truck, Tag, AlertTriangle, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Link }          from 'react-router-dom'
import { api }           from '@/lib/api'
import { KpiCard, Card, Spinner } from '@/components/ui/Badge'
import { formatCurrency, formatPercent, formatRelativeDate, trendBg } from '@/lib/formatters'
import type { DashboardStats } from '@/types'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  () => api.dashboard.stats(),
    refetchInterval: 60_000,
  })
  if (isLoading) return <Spinner/>
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Rohstoffe"        value={stats?.materials_count??0}  subtitle="aktive Materialien"   icon={<FlaskConical size={18}/>} accentColor="#6366f1"/>
        <KpiCard title="Lieferanten"      value={stats?.suppliers_count??0}  subtitle="aktive Partner"       icon={<Truck size={18}/>}        accentColor="#06b6d4"/>
        <KpiCard title="Kategorien"       value={stats?.categories_count??0} subtitle="Strukturebenen"       icon={<Tag size={18}/>}          accentColor="#8b5cf6"/>
        <KpiCard title="Niedriger Bestand" value={stats?.low_stock_count??0} subtitle="unter Mindestbestand" icon={<AlertTriangle size={18}/>}
          accentColor={stats?.low_stock_count ? '#f59e0b' : '#10b981'}/>
      </div>

      {/* Middle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">Teuerste Rohstoffe</h3>
            <Link to="/materials" className="btn-ghost text-xs">Alle <ArrowRight size={12}/></Link>
          </div>
          {(stats?.top_materials_by_cost??[]).map((m,i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold">{i+1}</span>
                <p className="text-sm text-slate-200 truncate">{m.material_name}</p>
              </div>
              <p className="text-sm font-semibold text-slate-100 shrink-0">{formatCurrency(m.price_per_unit, m.currency)} / {m.unit}</p>
            </div>
          ))}
          {!stats?.top_materials_by_cost?.length && <p className="text-xs text-slate-500 text-center py-4">Keine Preisdaten</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">Lieferanten nach Materialien</h3>
            <Link to="/suppliers" className="btn-ghost text-xs">Alle <ArrowRight size={12}/></Link>
          </div>
          {(stats?.suppliers_by_material_count??[]).map((s,i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold">
                  {s.code?.slice(0,2)}
                </div>
                <p className="text-sm text-slate-200">{s.name}</p>
              </div>
              <span className="badge-cyan text-xs">{s.material_count} Mat.</span>
            </div>
          ))}
          {!stats?.suppliers_by_material_count?.length && <p className="text-xs text-slate-500 text-center py-4">Keine Lieferanten</p>}
        </Card>
      </div>

      {/* Preis-Bewegungen */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">Letzte Preisänderungen</h3>
          <Link to="/price-history" className="btn-ghost text-xs">Vollständige Historie <ArrowRight size={12}/></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              <th className="table-th">Material</th>
              <th className="table-th">Lieferant</th>
              <th className="table-th text-right">Preis</th>
              <th className="table-th text-right">Änderung</th>
              <th className="table-th">Datum</th>
            </tr></thead>
            <tbody>
              {(stats?.recent_price_changes??[]).map(ph => (
                <tr key={ph.id} className="table-row">
                  <td className="table-td font-medium text-slate-200">{ph.material_name}</td>
                  <td className="table-td text-slate-400">{ph.supplier_name??'–'}</td>
                  <td className="table-td text-right font-mono text-xs">
                    {formatCurrency(ph.price_per_unit, ph.currency)} / {ph.unit}
                  </td>
                  <td className="table-td text-right">
                    {ph.change_percent!=null
                      ? <span className={`badge text-xs ${trendBg(ph.change_percent)}`}>
                          {ph.change_percent>0?<TrendingUp size={10} className="inline mr-0.5"/>:<TrendingDown size={10} className="inline mr-0.5"/>}
                          {formatPercent(ph.change_percent)}
                        </span>
                      : <span className="text-slate-600">–</span>}
                  </td>
                  <td className="table-td text-slate-500 text-xs">{formatRelativeDate(ph.recorded_at)}</td>
                </tr>
              ))}
              {!stats?.recent_price_changes?.length && (
                <tr><td colSpan={5} className="table-td text-center text-slate-500 py-8">Noch keine Preisänderungen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 30-Tage Balken */}
      {(stats?.price_changes_last_30d?.length??0)>0 && (
        <Card>
          <h3 className="text-sm font-bold text-slate-200 mb-4">Preisänderungen – letzte 30 Tage</h3>
          <div className="flex items-end gap-1 h-20">
            {stats!.price_changes_last_30d.map((d,i) => {
              const max = Math.max(...stats!.price_changes_last_30d.map(x=>x.changes))
              const h   = max>0 ? (d.changes/max)*100 : 0
              return (
                <div key={i} className="flex-1" title={`${d.date}: ${d.changes} Änderungen`}>
                  <div className={`w-full rounded-t-sm ${d.avg_change>=0?'bg-red-500/40':'bg-emerald-500/40'}`}
                    style={{ height:`${Math.max(h,4)}%` }}/>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">Rot = Preiserhöhungen · Grün = Preissenkungen</p>
        </Card>
      )}
    </div>
  )
}
