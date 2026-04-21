import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, RotateCcw, FlaskConical, Package, AlertTriangle } from 'lucide-react'
import { ConfirmDialog, SkeletonList } from '@/components/ui/Badge'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

export default function TrashPage() {
  const qc = useQueryClient(); const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [confirmEmpty, setConfirmEmpty]   = useState(false)

  const { data:items=[], isLoading } = useQuery<any[]>({
    queryKey: ['trash'],
    queryFn:  () => window.api.products.trash() as Promise<any[]>,
    refetchInterval: 10_000,
  })

  const restore    = useMutation({ mutationFn:(id:number)=>window.api.products.restore(id), onSuccess:()=>{ qc.invalidateQueries({queryKey:['trash']}); qc.invalidateQueries({queryKey:['products']}); toast.success('Wiederhergestellt') } })
  const permDelete = useMutation({ mutationFn:(id:number)=>window.api.products.permanentDelete(id), onSuccess:()=>{ qc.invalidateQueries({queryKey:['trash']}); setConfirmDelete(null); toast.success('Endgültig gelöscht') } })
  const emptyTrash = useMutation({ mutationFn:async()=>{ for(const i of items) await window.api.products.permanentDelete(i.id) }, onSuccess:()=>{ qc.invalidateQueries({queryKey:['trash']}); setConfirmEmpty(false); toast.success('Papierkorb geleert') } })

  const fmtDate = (s:string) => s ? new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '–'

  if (isLoading) return <SkeletonList items={3}/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2"><Trash2 size={20} className="text-red-400"/>Papierkorb</h2>
          <p className="page-subtitle">{items.length} gelöschte Element{items.length!==1?'e':''}</p>
        </div>
        {items.length>0&&(
          <button onClick={()=>setConfirmEmpty(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
            style={{border:'1px solid rgba(239,68,68,0.3)'}}>
            <Trash2 size={14}/>Papierkorb leeren
          </button>
        )}
      </div>
      {!items.length ? (
        <div className="glass-card flex flex-col items-center justify-center py-20">
          <Trash2 size={48} className="text-slate-700 mb-4"/>
          <p className="text-slate-400 text-lg font-semibold">Papierkorb ist leer</p>
          <p className="text-slate-600 text-sm mt-1">Gelöschte Produkte erscheinen hier</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="p-3 flex items-center gap-2" style={{borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(239,68,68,0.04)'}}>
            <AlertTriangle size={13} className="text-red-400"/>
            <p className="text-xs text-red-400">Gelöschte Elemente können wiederhergestellt oder endgültig gelöscht werden.</p>
          </div>
          <div className="divide-y divide-white/5">
            {items.map((item:any)=>(
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/2 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}>
                    {item.material_count>0?<FlaskConical size={16} className="text-red-400"/>:<Package size={16} className="text-red-400"/>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-300">{item.name}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{background:'rgba(255,255,255,0.06)',color:'#64748b'}}>{item.code}</span>
                      {item.group_name&&<span className="text-[10px] text-slate-600">{item.group_name}</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">Gelöscht: {fmtDate(item.updated_at)} · {item.material_count>0?`${item.material_count} Rohstoffe`:'Kein Rezept'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>restore.mutate(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    style={{border:'1px solid rgba(16,185,129,0.3)'}}>
                    <RotateCcw size={12}/>Wiederherstellen
                  </button>
                  <button onClick={()=>setConfirmDelete(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                    style={{border:'1px solid rgba(239,68,68,0.3)'}}>
                    <Trash2 size={12}/>Endgültig löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog open={!!confirmDelete} title="Endgültig löschen?"
        message={`"${confirmDelete?.name}" wird unwiderruflich gelöscht.`}
        confirmLabel="Endgültig löschen"
        onConfirm={()=>confirmDelete&&permDelete.mutate(confirmDelete.id)}
        onCancel={()=>setConfirmDelete(null)} loading={permDelete.isPending}/>
      <ConfirmDialog open={confirmEmpty} title="Papierkorb leeren?"
        message={`Alle ${items.length} Elemente werden unwiderruflich gelöscht.`}
        confirmLabel="Alle löschen"
        onConfirm={()=>emptyTrash.mutate()}
        onCancel={()=>setConfirmEmpty(false)} loading={emptyTrash.isPending}/>
    </div>
  )
}
