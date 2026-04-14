import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tag, ChevronRight } from 'lucide-react'
import { api }            from '@/lib/api'
import { Button }         from '@/components/ui/Input'
import { Modal }          from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast }       from '@/hooks/useToast'
import type { Category, CategoryFormData } from '@/types'

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']
const EMPTY_CAT: CategoryFormData = { name:'', code:'', parent_id:'', description:'', color:'#6366f1', icon:'folder', sort_order:0 }

function CategoryForm({ initial, categories, onSubmit, onCancel, loading }:
  { initial?:Category; categories:Category[]; onSubmit:(d:CategoryFormData)=>Promise<void>; onCancel:()=>void; loading?:boolean }) {
  const [form, setForm] = useState<CategoryFormData>(EMPTY_CAT)
  const [errors, setErrors] = useState<Partial<CategoryFormData>>({})
  useEffect(() => {
    setForm(initial ? {
      name:initial.name, code:initial.code??'', parent_id:initial.parent_id?.toString()??'',
      description:initial.description??'', color:initial.color, icon:initial.icon, sort_order:initial.sort_order,
    } : EMPTY_CAT)
    setErrors({})
  }, [initial])
  const set = (k: keyof CategoryFormData, v: string|number) => setForm(f => ({...f,[k]:v}))
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({name:'Name ist erforderlich'}); return }
    await onSubmit(form)
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Name *" value={form.name} error={errors.name} autoFocus
            onChange={e => set('name', e.target.value)} placeholder="z.B. Rohstoffe"/>
        </div>
        <Input label="Code" value={form.code} onChange={e => set('code',e.target.value.toUpperCase())} placeholder="z.B. RAW"/>
        <Select label="Übergeordnet" value={form.parent_id} onChange={e => set('parent_id',e.target.value)}>
          <option value="">– Keine –</option>
          {categories.filter(c=>c.id!==initial?.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="col-span-2">
          <Textarea label="Beschreibung" value={form.description} rows={2}
            onChange={e => set('description',e.target.value)}/>
        </div>
        <Input label="Sortierung" type="number" value={form.sort_order}
          onChange={e => set('sort_order',Number(e.target.value))} min={0}/>
        <div className="flex flex-col gap-1">
          <label className="form-label">Farbe</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>set('color',c)}
                className={`w-6 h-6 rounded-lg transition-all ${form.color===c?'ring-2 ring-white/60 scale-110':'opacity-70 hover:opacity-100'}`}
                style={{backgroundColor:c,boxShadow:form.color===c?`0 0 12px ${c}`:"none"}}/>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" loading={loading}>{initial?'Speichern':'Anlegen'}</Button>
      </div>
    </form>
  )
}

export default function CategoriesPage() {
  const qc=useQueryClient(), toast=useToast()
  const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<Category|undefined>()
  const [deleting,setDeleting]=useState<Category|undefined>()
  const {data,isLoading}=useQuery<Category[]>({queryKey:['categories'],queryFn:()=>api.categories.list()})
  const cats=data??[]
  const inv=()=>qc.invalidateQueries({queryKey:['categories']})
  const createM=useMutation({mutationFn:(d:CategoryFormData)=>api.categories.create(d),
    onSuccess:()=>{inv();setOpen(false);toast.success('Kategorie angelegt')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:CategoryFormData})=>api.categories.update(id,d),
    onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>api.categories.delete(id),
    onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})
  const submit=async(form:CategoryFormData)=>{
    if(editing) await updateM.mutateAsync({id:editing.id,d:form})
    else        await createM.mutateAsync(form)
  }
  if(isLoading) return <Spinner/>
  const roots=cats.filter(c=>!c.parent_id)
  const children=(pid:number)=>cats.filter(c=>c.parent_id===pid)
  return (
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Kategorien</h2><p className="page-subtitle">{cats.length} Kategorien</p></div>
        <Button icon={<Plus size={16}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>Anlegen</Button>
      </div>
      <div className="glass-card overflow-hidden">
        {!cats.length ? (
          <EmptyState icon={<Tag size={40}/>} title="Noch keine Kategorien"
            action={<Button icon={<Plus size={16}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>Erste Kategorie</Button>}/>
        ) : (
          <table className="w-full">
            <thead className="border-b border-white/5"><tr>
              <th className="table-th">Name</th><th className="table-th">Code</th>
              <th className="table-th">Übergeordnet</th>
              <th className="table-th text-center">Unterkat.</th><th className="table-th text-center">Mat.</th>
              <th className="table-th text-right">Aktionen</th>
            </tr></thead>
            <tbody>
              {roots.map(cat=>(
                <React.Fragment key={cat.id}>
                  <CatRow cat={cat} depth={0} onEdit={c=>{setEditing(c);setOpen(true)}} onDelete={setDeleting}/>
                  {children(cat.id).map(ch=>(
                    <CatRow key={ch.id} cat={ch} depth={1} onEdit={c=>{setEditing(c);setOpen(true)}} onDelete={setDeleting}/>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Bearbeiten':'Neue Kategorie'} size="md">
        <CategoryForm initial={editing} categories={cats} onSubmit={submit} onCancel={()=>setOpen(false)}
          loading={createM.isPending||updateM.isPending}/>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Kategorie löschen?"
        message={`"${deleting?.name}" wirklich löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)}
        onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}

function CatRow({cat,depth,onEdit,onDelete}:
  {cat:Category;depth:number;onEdit:(c:Category)=>void;onDelete:(c:Category)=>void}) {
  return (
    <tr className="table-row group">
      <td className="table-td">
        <div className="flex items-center gap-2" style={{paddingLeft:depth*20}}>
          {depth>0&&<ChevronRight size={12} className="text-slate-600 shrink-0"/>}
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:cat.color,boxShadow:`0 0 8px ${cat.color}`,border:`1px solid ${cat.color}`}}/>
          <span className="font-medium text-slate-200">{cat.name}</span>
        </div>
      </td>
      <td className="table-td">{cat.code?<span className="badge-blue font-mono text-xs">{cat.code}</span>:<span className="text-slate-600">–</span>}</td>
      <td className="table-td text-slate-500">{cat.parent_name??'–'}</td>
      <td className="table-td text-center text-slate-400">{cat.children_count??0}</td>
      <td className="table-td text-center text-slate-400">{cat.materials_count??0}</td>
      <td className="table-td text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="btn-ghost p-1.5" onClick={()=>onEdit(cat)}><Pencil size={13}/></button>
          <button className="btn-ghost p-1.5 text-red-400" onClick={()=>onDelete(cat)}><Trash2 size={13}/></button>
        </div>
      </td>
    </tr>
  )
}
