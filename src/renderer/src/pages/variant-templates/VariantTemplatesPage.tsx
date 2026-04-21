import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Package, X,
  Download, Upload, FileSpreadsheet, ChevronDown, ChevronRight, FolderOpen
} from 'lucide-react'
import { Button, Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ConfirmDialog, SkeletonTable } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

interface VT {
  id:number; name:string; fill_amount:number; fill_unit:string
  sort_order:number; group_name?:string
}

const UNITS = ['kg','g','l','ml','stk']
const fmtSize = (amt:number, unit:string) => {
  const s = Number.isInteger(amt) ? String(amt) : String(amt).replace('.',',')
  return `${s} ${unit}`
}
const newRow = () => ({ fill_amount:'', fill_unit:'kg', name:'', group_name:'Größe' })
const EMPTY_EDIT = { name:'', fill_amount:'', fill_unit:'kg', group_name:'Größe' }

export default function VariantTemplatesPage() {
  const qc = useQueryClient(); const toast = useToast()
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<VT|undefined>()
  const [deleting, setDeleting]       = useState<VT|undefined>()
  const [editForm, setEditForm]       = useState(EMPTY_EDIT)
  const [rows, setRows]               = useState([newRow()])
  const [openGroups, setOpenGroups]   = useState<Record<string,boolean>>({})

  const { data: templates=[], isLoading } = useQuery<VT[]>({
    queryKey: ['variant-templates'],
    queryFn:  () => window.api.variantTemplates.list() as Promise<VT[]>,
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['variant-templates'] })
  const createM = useMutation({ mutationFn:(d:unknown)=>window.api.variantTemplates.create(d), onSuccess:inv, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const updateM = useMutation({ mutationFn:({id,d}:{id:number;d:unknown})=>window.api.variantTemplates.update(id,d), onSuccess:()=>{inv();setShowModal(false);toast.success('Gespeichert')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const deleteM = useMutation({ mutationFn:(id:number)=>window.api.variantTemplates.delete(id), onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')} })

  // Collect unique group names
  const groupNames = [...new Set(templates.map(t => (t as any).group_name || 'Größe'))].sort()

  // Group templates
  const grouped = templates.reduce((m, t) => {
    const g = (t as any).group_name || 'Größe'
    if (!m[g]) m[g] = []
    m[g].push(t)
    return m
  }, {} as Record<string,VT[]>)

  const toggleGroup = (g:string) => setOpenGroups(p => ({...p,[g]:!p[g]}))
  const isOpen = (g:string) => g in openGroups ? openGroups[g] : true // default open

  const autoName = (amt:string, unit:string) => {
    const n = parseFloat(amt.replace(',','.'))
    if (!n) return ''
    const s = Number.isInteger(n) ? String(n) : String(n).replace('.',',')
    return `${s} ${unit} Set`
  }
  const updateRow = (i:number, k:string, v:string) => {
    setRows(prev => prev.map((r,idx) => {
      if (idx !== i) return r
      const u = {...r,[k]:v}
      if ((k==='fill_amount'||k==='fill_unit')&&!r.name) u.name=autoName(u.fill_amount,u.fill_unit)
      return u
    }))
  }

  const openCreate = () => { setEditing(undefined); setRows([newRow()]); setShowModal(true) }
  const openEdit = (t:VT) => {
    setEditing(t)
    setEditForm({name:t.name,fill_amount:String(t.fill_amount),fill_unit:t.fill_unit,group_name:(t as any).group_name||'Größe'})
    setShowModal(true)
  }

  const submitBulk = async () => {
    const valid = rows.filter(r=>r.fill_amount&&parseFloat(r.fill_amount.replace(',','.'))||0)
    if (!valid.length) return
    for (const r of valid) {
      await createM.mutateAsync({
        name: r.name || autoName(r.fill_amount,r.fill_unit),
        fill_amount: parseFloat(r.fill_amount.replace(',','.')),
        fill_unit: r.fill_unit,
        group_name: r.group_name || 'Größe',
        sort_order: 0,
      })
    }
    toast.success(`${valid.length} Vorlage(n) angelegt`)
    setShowModal(false); setRows([newRow()])
  }
  const submitEdit = () => {
    if (!editing) return
    updateM.mutate({id:editing.id,d:{
      name:editForm.name,
      fill_amount:parseFloat(editForm.fill_amount.replace(',','.')),
      fill_unit:editForm.fill_unit,
      group_name:editForm.group_name,
      sort_order:editing.sort_order,
    }})
  }

  // Export/Import
  const handleExport = async (type:'csv'|'xlsx'|'template') => {
    const api = (window.api as any).exportImport
    const fn = type==='csv' ? api.exportVariantTemplates :
               type==='xlsx'? api.exportVariantTemplatesXlsx :
                              api.exportVariantTemplatesTemplate
    const r = await fn()
    if (r?.success) toast.success(type==='template'?'Vorlage gespeichert':`${r.count} Vorlagen exportiert`)
  }
  const handleImport = async () => {
    const r = await (window.api as any).exportImport.importVariantTemplates()
    if (r?.success) { inv(); toast.success(`${r.count} Vorlagen importiert`) }
    else if (r?.success===false) toast.error('Import abgebrochen')
  }

  if (isLoading) return <SkeletonTable rows={6} cols={3}/>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Varianten-Vorlagen</h2>
          <p className="page-subtitle">{templates.length} Vorlagen in {groupNames.length} Gruppe(n)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import/Export */}
          <div className="flex items-center gap-1">
            <button onClick={()=>handleExport('template')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              style={{border:'1px solid rgba(255,255,255,0.08)'}}>
              <Download size={11}/>Vorlage
            </button>
            <button onClick={()=>handleExport('csv')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              style={{border:'1px solid rgba(255,255,255,0.08)'}}>
              <Download size={11}/>CSV
            </button>
            <button onClick={async()=>{
                const data = await (window.api as any).exportImport?.exportVariantTemplatesData?.()
                if(!data?.length) return
                const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs' as any)
                const ws = XLSX.utils.json_to_sheet(data)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Varianten')
                XLSX.writeFile(wb, 'varianten-vorlagen.xlsx')
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              style={{border:'1px solid rgba(255,255,255,0.08)'}}>
              <FileSpreadsheet size={11}/>Excel
            </button>
            <button onClick={handleImport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              style={{border:'1px solid rgba(255,255,255,0.08)'}}>
              <Upload size={11}/>Import
            </button>
          </div>
          <Button icon={<Plus size={13}/>} onClick={openCreate}>Vorlagen anlegen</Button>
        </div>
      </div>

      {!templates.length ? (
        <EmptyState icon={<Package size={40}/>} title="Keine Vorlagen"
          description="Lege Varianten-Vorlagen an (z.B. 0,75 kg, 1,5 kg). EAN und Preise trägst du beim jeweiligen Produkt ein."
          action={<Button icon={<Plus size={14}/>} onClick={openCreate}>Erste Vorlagen anlegen</Button>}/>
      ) : (
        <div className="space-y-2">
          {groupNames.map(group => {
            const items = grouped[group] || []
            const open = isOpen(group)
            return (
              <div key={group} className="glass-card overflow-hidden">
                {/* Group header — clickable */}
                <button
                  onClick={()=>toggleGroup(group)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-all"
                  style={{borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none'}}>
                  <FolderOpen size={13} className="text-brand-400 shrink-0"/>
                  <span className="text-sm font-bold text-slate-200">{group}</span>
                  <span className="text-xs text-slate-600 ml-1">({items.length})</span>
                  <div className="ml-auto text-slate-600">
                    {open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                  </div>
                </button>

                {/* Compact table */}
                {open && (
                  <table className="w-full">
                    <thead>
                      <tr style={{background:'rgba(255,255,255,0.01)'}}>
                        <th className="text-left px-4 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Name</th>
                        <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Füllmenge</th>
                        <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Einheit</th>
                        <th className="w-16 py-1.5"/>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((t,i) => (
                        <tr key={t.id} className="group hover:bg-white/3 transition-all"
                          style={{borderTop: i===0?'none':'1px solid rgba(255,255,255,0.04)'}}>
                          <td className="px-4 py-1.5">
                            <span className="text-xs font-medium text-slate-200">{t.name}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-mono text-brand-400">
                              {String(t.fill_amount).replace('.',',')}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs text-slate-500">{t.fill_unit}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="btn-ghost p-1" onClick={()=>openEdit(t)}><Pencil size={11}/></button>
                              <button className="btn-ghost p-1 text-red-400" onClick={()=>setDeleting(t)}><Trash2 size={11}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={()=>setShowModal(false)}
        title={editing?'Vorlage bearbeiten':'Vorlagen anlegen'} size="md">
        <div className="space-y-4 mt-2">
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-500 block mb-1">Name</label>
                <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-brand-500"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Füllmenge</label>
                <input type="text" inputMode="decimal" value={editForm.fill_amount}
                  onChange={e=>setEditForm(f=>({...f,fill_amount:e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-brand-500"/>
              </div>
              <Select label="Einheit" value={editForm.fill_unit} onChange={e=>setEditForm(f=>({...f,fill_unit:e.target.value}))}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </Select>
              <div className="col-span-2">
                <label className="text-[10px] text-slate-500 block mb-1">Gruppe</label>
                <input value={editForm.group_name} onChange={e=>setEditForm(f=>({...f,group_name:e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-brand-500"
                  placeholder="z.B. Größe, Sonderformat, Industrial"
                  list="group-suggestions"/>
                <datalist id="group-suggestions">
                  {groupNames.map(g=><option key={g} value={g}/>)}
                </datalist>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Mehrere Größen auf einmal anlegen.</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {rows.map((row,i)=>(
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl"
                    style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div className="w-24">
                      <input type="text" inputMode="decimal" value={row.fill_amount}
                        onChange={e=>updateRow(i,'fill_amount',e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-sm text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-brand-500"
                        placeholder="0,75"/>
                    </div>
                    <div className="w-16">
                      <select value={row.fill_unit} onChange={e=>updateRow(i,'fill_unit',e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/5 border border-white/10 outline-none">
                        {UNITS.map(u=><option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <input value={row.name} onChange={e=>updateRow(i,'name',e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-brand-500"
                        placeholder={autoName(row.fill_amount,row.fill_unit)||'Name (auto)'}/>
                    </div>
                    <div className="w-24">
                      <input value={row.group_name} onChange={e=>updateRow(i,'group_name',e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-brand-500"
                        placeholder="Gruppe" list="group-suggestions2"/>
                      <datalist id="group-suggestions2">
                        {groupNames.map(g=><option key={g} value={g}/>)}
                      </datalist>
                    </div>
                    {rows.length>1&&(
                      <button onClick={()=>setRows(p=>p.filter((_,idx)=>idx!==i))}
                        className="btn-ghost p-1 text-red-400 shrink-0"><X size={12}/></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={()=>setRows(p=>[...p,newRow()])}
                className="w-full py-1.5 rounded-xl text-xs text-slate-500 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-all">
                + Weitere Zeile
              </button>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Abbrechen</Button>
            <Button onClick={editing?submitEdit:submitBulk} loading={createM.isPending||updateM.isPending}>
              {editing?'Speichern':`${rows.filter(r=>r.fill_amount).length||''} Anlegen`}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Vorlage löschen?"
        message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)}
        onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
