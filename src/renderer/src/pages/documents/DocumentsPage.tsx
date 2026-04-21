import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Upload, Trash2, FolderOpen, Search,
  FileSpreadsheet, File, Image, ChevronDown, MoveRight, Tag,
} from 'lucide-react'
import { ConfirmDialog, SkeletonList } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

// ── Kategorien ─────────────────────────────────────────────────
const DOC_CATEGORIES = [
  { id:'sicherheitsdatenblatt', label:'Sicherheitsdatenblätter', icon:'🛡️', color:'#ef4444' },
  { id:'rechnung',              label:'Rechnungen',               icon:'🧾', color:'#f59e0b' },
  { id:'zertifikat',            label:'Zertifikate',             icon:'🏆', color:'#10b981' },
  { id:'technisch',             label:'Technische Infos',        icon:'⚙️', color:'#6366f1' },
  { id:'lieferschein',          label:'Lieferscheine',           icon:'📦', color:'#06b6d4' },
  { id:'vertrag',               label:'Verträge',                icon:'📄', color:'#8b5cf6' },
  { id:'bild',                  label:'Bilder',                  icon:'🖼️', color:'#ec4899' },
  { id:'other',                 label:'Sonstige',                icon:'📁', color:'#64748b' },
]
const ALL_CATS = ['all', ...DOC_CATEGORIES.map(c=>c.id)]

function getCat(id: string) {
  return DOC_CATEGORIES.find(c=>c.id===id) ?? { id:'other', label:'Sonstige', icon:'📁', color:'#64748b' }
}

function DocIcon({ mime }: { mime?: string }) {
  if (!mime) return <FileText size={16} className="text-slate-500"/>
  if (mime.startsWith('image/'))  return <Image size={16} className="text-pink-400"/>
  if (mime.includes('pdf'))       return <FileText size={16} className="text-red-400"/>
  if (mime.includes('sheet') || mime.includes('csv')) return <FileSpreadsheet size={16} className="text-green-400"/>
  if (mime.includes('word'))      return <File size={16} className="text-blue-400"/>
  return <FileText size={16} className="text-slate-400"/>
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024/1024).toFixed(1)} MB`
}
function fmtDate(s?: string) {
  if (!s) return '–'
  return new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})
}

function EntityBadge({ type, name }: { type: string; name?: string }) {
  const map: Record<string,{label:string;color:string}> = {
    material: { label:'Rohstoff', color:'#8b5cf6' },
    supplier: { label:'Lieferant', color:'#06b6d4' },
    product:  { label:'Produkt',   color:'#10b981' },
  }
  const m = map[type] ?? { label:type, color:'#64748b' }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
      style={{ background:`${m.color}15`, color:m.color, border:`1px solid ${m.color}30` }}>
      {m.label}{name ? ` · ${name}` : ''}
    </span>
  )
}

export default function DocumentsPage() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch]       = useState('')
  const [movingDoc, setMovingDoc] = useState<any>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [deleting, setDeleting]   = useState<any>(null)

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ['documents:all', activeCat],
    queryFn:  () => (window.api as any).documents.listAll(activeCat === 'all' ? undefined : activeCat) as Promise<any[]>,
    refetchInterval: 15_000,
  })
  const { data: summary = [] } = useQuery<any[]>({
    queryKey: ['documents:summary'],
    queryFn:  () => (window.api as any).documents.categorySummary() as Promise<any[]>,
    refetchInterval: 30_000,
  })

  const updateCat = useMutation({
    mutationFn: ({ id, cat }: { id:number; cat:string }) => (window.api as any).documents.updateCategory(id, cat),
    onSuccess:  () => { qc.invalidateQueries({queryKey:['documents:all']}); qc.invalidateQueries({queryKey:['documents:summary']}); setMovingDoc(null); toast.success('Kategorie geändert') },
  })
  const deleteDoc = useMutation({
    mutationFn: (id:number) => (window.api as any).documents.purge(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:['documents:all']}); qc.invalidateQueries({queryKey:['documents:summary']}); setDeleting(null); toast.success('Dokument gelöscht') },
  })

  const filtered = docs.filter(d =>
    !search || d.file_name?.toLowerCase().includes(search.toLowerCase()) || d.entity_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category
  const groups = DOC_CATEGORIES.map(cat => ({
    ...cat,
    docs: filtered.filter(d => d.category === cat.id),
  })).filter(g => activeCat === 'all' ? g.docs.length > 0 : g.id === activeCat)

  const totalCount = (summary as any[]).reduce((s:number,r:any)=>s+(r.count||0),0)

  if (isLoading) return <SkeletonList items={4}/>

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2"><FolderOpen size={20} className="text-brand-400"/>Dokumentenarchiv</h2>
          <p className="page-subtitle">{totalCount} Dokumente · Rohstoffe, Lieferanten & Produkte</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* ── Sidebar: Kategorien ── */}
        <div className="w-56 shrink-0 space-y-1">
          <button onClick={() => setActiveCat('all')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background:activeCat==='all'?'var(--accent)20':'rgba(255,255,255,0.03)', color:activeCat==='all'?'var(--text-primary)':'var(--text-secondary)', border:`1px solid ${activeCat==='all'?'var(--accent)40':'rgba(255,255,255,0.06)'}` }}>
            <span className="flex items-center gap-2"><span>📂</span>Alle</span>
            <span className="text-xs font-bold" style={{ color:'var(--text-muted)' }}>{totalCount}</span>
          </button>
          <div className="pt-1 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider px-2 mb-1" style={{ color:'var(--text-muted)' }}>Kategorien</p>
          </div>
          {DOC_CATEGORIES.map(cat => {
            const s = (summary as any[]).find(r=>r.category===cat.id)
            const count = s?.count ?? 0
            const isActive = activeCat === cat.id
            return (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background:isActive?`${cat.color}18`:'rgba(255,255,255,0.02)', color:isActive?'var(--text-primary)':'var(--text-secondary)', border:`1px solid ${isActive?cat.color+'35':'rgba(255,255,255,0.05)'}` }}>
                <span className="flex items-center gap-2"><span>{cat.icon}</span>{cat.label}</span>
                {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:`${cat.color}20`, color:cat.color }}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Main: Dokumente ── */}
        <div className="flex-1 min-w-0">
          {/* Suche */}
          <div className="relative mb-4">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              className="form-input pl-9 text-sm w-full" placeholder="Dokument oder Zugehörigkeit suchen …"/>
          </div>

          {!filtered.length && (
            <div className="glass-card flex flex-col items-center justify-center py-16">
              <FolderOpen size={40} className="text-slate-700 mb-3"/>
              <p className="text-slate-500">Keine Dokumente in dieser Kategorie</p>
              <p className="text-xs text-slate-600 mt-1">Dokumente über Lieferanten oder Rohstoffe hochladen</p>
            </div>
          )}

          {/* Grouped by category */}
          {groups.map(group => (
            <div key={group.id} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{group.icon}</span>
                <h3 className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>{group.label}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background:`${group.color}15`, color:group.color }}>{group.docs.length}</span>
              </div>

              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <tr>
                      <th className="table-th">Dokument</th>
                      <th className="table-th">Zugehörigkeit</th>
                      <th className="table-th">Größe</th>
                      <th className="table-th">Datum</th>
                      <th className="table-th text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.docs.map((doc:any) => (
                      <tr key={doc.id} className="table-row group">
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <DocIcon mime={doc.mime_type}/>
                            <div>
                              <p className="text-sm font-medium truncate max-w-48" style={{ color:'var(--text-primary)' }}>{doc.original_name||doc.file_name}</p>
                              {doc.description && <p className="text-xs truncate max-w-48" style={{ color:'var(--text-muted)' }}>{doc.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-td">
                          <EntityBadge type={doc.entity_type} name={doc.entity_name}/>
                        </td>
                        <td className="table-td text-xs" style={{ color:'var(--text-muted)' }}>{fmtSize(doc.file_size)}</td>
                        <td className="table-td text-xs" style={{ color:'var(--text-muted)' }}>{fmtDate(doc.uploaded_at)}</td>
                        <td className="table-td text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Open */}
                            <button onClick={() => (window.api as any).documents.open(doc.id)}
                              className="btn-ghost p-1.5 text-xs" style={{ color:'var(--accent)' }} title="Öffnen">
                              <FolderOpen size={12}/>
                            </button>
                            {/* Move to category */}
                            <button onClick={() => { setMovingDoc(doc); setMoveTarget(doc.category||'other') }}
                              className="btn-ghost p-1.5 text-xs" style={{ color:'var(--text-secondary)' }} title="Kategorie ändern">
                              <Tag size={12}/>
                            </button>
                            {/* Delete */}
                            <button onClick={() => setDeleting(doc)}
                              className="btn-ghost p-1.5 text-red-400" title="Löschen">
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Move category modal */}
      {movingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }}>
          <div className="w-80 p-5" style={{background:'rgba(8,11,24,0.88)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',boxShadow:'0 32px 80px rgba(0,0,0,0.7)'}}>
            <h3 className="text-sm font-bold mb-1" style={{ color:'var(--text-primary)' }}>Kategorie ändern</h3>
            <p className="text-xs mb-4 truncate" style={{ color:'var(--text-muted)' }}>{movingDoc.original_name||movingDoc.file_name}</p>
            <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
              {DOC_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setMoveTarget(cat.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background:moveTarget===cat.id?`${cat.color}20`:'rgba(255,255,255,0.03)', border:`1px solid ${moveTarget===cat.id?cat.color+'40':'rgba(255,255,255,0.06)'}`, color:moveTarget===cat.id?'var(--text-primary)':'var(--text-secondary)' }}>
                  <span>{cat.icon}</span>{cat.label}
                  {moveTarget===cat.id && <span className="ml-auto"><span style={{ color:cat.color }}>✓</span></span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMovingDoc(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)' }}>
                Abbrechen
              </button>
              <button onClick={() => updateCat.mutate({ id:movingDoc.id, cat:moveTarget })}
                className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                style={{ background:'var(--accent)30', border:'1px solid var(--accent)50', color:'var(--text-primary)' }}>
                <MoveRight size={12}/>Verschieben
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleting} title="Dokument löschen?"
        message={`"${deleting?.original_name||deleting?.file_name}" wirklich löschen?`}
        confirmLabel="Löschen"
        onConfirm={() => deleting && deleteDoc.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        loading={deleteDoc.isPending}/>
    </div>
  )
}
