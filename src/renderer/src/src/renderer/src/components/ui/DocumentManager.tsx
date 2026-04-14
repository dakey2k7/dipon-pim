import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, FileImage, File, Trash2, Eye, ExternalLink, CloudUpload } from 'lucide-react'
import { useToast }   from '@/hooks/useToast'
import { Input, Select } from '@/components/ui/Input'
import { Modal }      from '@/components/ui/Modal'

interface Doc {
  id:number; file_name:string; file_path:string; file_size:number|null
  mime_type:string; category:string; description:string|null
  valid_from:string|null; valid_until:string|null; uploaded_at:string
}
const CATS=[
  {value:'invoice',label:'🧾 Rechnung'},{value:'offer',label:'📋 Angebot'},
  {value:'sds',label:'⚠️ SDB'},{value:'spec',label:'📐 Spezifikation'},
  {value:'cert',label:'✅ Zertifikat'},{value:'pricelist',label:'💶 Preisliste'},
  {value:'contract',label:'📜 Vertrag'},{value:'other',label:'📄 Sonstiges'},
]
const fmtSz=(b:number|null)=>{if(!b)return '';if(b<1024)return `${b}B`;if(b<1048576)return `${(b/1024).toFixed(1)}KB`;return `${(b/1048576).toFixed(1)}MB`}
const fmtDt=(dt:string|null)=>{if(!dt)return '–';try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(dt))}catch{return dt}}
const getIcon=(m:string)=>m?.startsWith('image/')?<FileImage size={15} className="text-cyan-400"/>:m==='application/pdf'?<FileText size={15} className="text-red-400"/>:<File size={15} className="text-slate-400"/>
const getCat=(c:string)=>CATS.find(x=>x.value===c)?.label??c

function PreviewModal({docId,onClose}:{docId:number;onClose:()=>void}) {
  const {data,isLoading}=useQuery({queryKey:['doc-preview',docId],queryFn:()=>window.api.documents.preview(docId) as Promise<{type:string;dataUrl?:string;fileName:string}>,staleTime:Infinity})
  return (
    <Modal open onClose={onClose} title="Dokumentvorschau" size="xl">
      {isLoading?<div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin"/></div>
      :data?.type==='image'&&data.dataUrl?<img src={data.dataUrl} alt={data.fileName} className="w-full h-auto max-h-[70vh] object-contain rounded-xl"/>
      :data?.type==='pdf'&&data.dataUrl?<iframe src={data.dataUrl} className="w-full rounded-xl" style={{height:'70vh',border:'none'}} title={data.fileName}/>
      :<div className="text-center py-12 text-slate-400"><File size={40} className="mx-auto mb-3 text-slate-600"/><p>Im System-Viewer geöffnet.</p></div>}
    </Modal>
  )
}

export function DocumentManager({entityType,entityId,compact=false}:{entityType:string;entityId:number;compact?:boolean}) {
  const qc=useQueryClient(); const toast=useToast()
  const fileInputRef=useRef<HTMLInputElement>(null)
  const [previewId,setPreviewId]=useState<number|null>(null)
  const [uploading,setUploading]=useState(false)
  const [dragOver,setDragOver]=useState(false)
  const [showMeta,setShowMeta]=useState(false)
  const [meta,setMeta]=useState({category:'other',description:'',valid_from:'',valid_until:''})

  const {data:docs=[],isLoading}=useQuery<Doc[]>({
    queryKey:['documents',entityType,entityId],
    queryFn:()=>window.api.documents.list(entityType,entityId) as Promise<Doc[]>,
    enabled:!!entityId,
  })
  const inv=()=>qc.invalidateQueries({queryKey:['documents',entityType,entityId]})
  const deleteMut=useMutation({mutationFn:(id:number)=>window.api.documents.delete(id),onSuccess:()=>{inv();toast.success('Entfernt')}})

  const processFiles=async(files:FileList|File[])=>{
    const arr=Array.from(files); if(!arr.length) return
    setUploading(true); let count=0
    try {
      for(const file of arr){
        const buf=await file.arrayBuffer()
        await window.api.documents.saveBuffer(entityType,entityId,file.name,buf,meta)
        count++
      }
      inv(); toast.success(`${count} Dokument${count>1?'e':''} hochgeladen`)
      setShowMeta(false)
    } catch(e:unknown){ toast.error('Upload fehlgeschlagen',(e as Error).message) }
    finally{ setUploading(false); if(fileInputRef.current) fileInputRef.current.value='' }
  }

  if(isLoading) return <div className="text-xs text-slate-600 py-2">Lade …</div>
  return (
    <div className={compact?'':'glass-card p-4'}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <FileText size={14} className="text-brand-400"/>Dokumente
          {docs.length>0&&<span className="badge-blue text-xs">{docs.length}</span>}
        </h4>
        <button onClick={()=>setShowMeta(v=>!v)} className="text-xs text-slate-500 hover:text-brand-400 transition-colors">
          {showMeta?'Metadaten ▲':'+ Metadaten ▼'}
        </button>
      </div>
      {showMeta&&(
        <div className="mb-3 p-3 rounded-xl space-y-2" style={{background:'rgb(139 92 246 / 0.05)',border:'1px solid rgb(139 92 246 / 0.15)'}}>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Kategorie" value={meta.category} onChange={e=>setMeta(m=>({...m,category:e.target.value}))}>
              {CATS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Beschreibung" value={meta.description} onChange={e=>setMeta(m=>({...m,description:e.target.value}))} placeholder="Preisbestätigung Q1"/>
            <Input label="Gültig ab" type="date" value={meta.valid_from} onChange={e=>setMeta(m=>({...m,valid_from:e.target.value}))}/>
            <Input label="Gültig bis" type="date" value={meta.valid_until} onChange={e=>setMeta(m=>({...m,valid_until:e.target.value}))}/>
          </div>
        </div>
      )}
      {/* Drop Zone */}
      <div className={`relative mb-3 p-4 rounded-xl text-center cursor-pointer transition-all ${uploading?'opacity-50 pointer-events-none':''}`}
        style={{border:`2px dashed ${dragOver?'rgb(139 92 246 / 0.6)':'rgb(255 255 255 / 0.1)'}`,background:dragOver?'rgb(139 92 246 / 0.08)':'transparent'}}
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);if(e.dataTransfer.files)processFiles(e.dataTransfer.files)}}
        onClick={()=>fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.txt,.csv"
          onChange={e=>{if(e.target.files)processFiles(e.target.files)}}
          style={{display:'none'}}/>
        {uploading?(
          <div className="flex items-center justify-center gap-2 text-brand-400">
            <div className="w-4 h-4 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin"/>
            <span className="text-xs">Wird hochgeladen …</span>
          </div>
        ):(
          <div className="flex flex-col items-center gap-1">
            <CloudUpload size={22} className={dragOver?'text-brand-400':'text-slate-600'}/>
            <p className="text-xs text-slate-500">Dateien hier ablegen oder <span className="text-brand-400 font-semibold">klicken</span></p>
            <p className="text-[10px] text-slate-700">PDF · Bilder · Excel · Word · CSV</p>
          </div>
        )}
      </div>
      {!docs.length?<p className="text-xs text-slate-700 text-center py-2">Noch keine Dokumente</p>:(
        <div className="space-y-1.5">
          {docs.map(doc=>(
            <div key={doc.id} className="flex items-center gap-2.5 p-2.5 rounded-xl group transition-all"
              style={{background:'rgb(255 255 255 / 0.03)',border:'1px solid rgb(255 255 255 / 0.05)'}}>
              <div className="shrink-0">{getIcon(doc.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-600">{getCat(doc.category)}</span>
                  {doc.valid_from&&<span className="text-[10px] text-emerald-600">ab {fmtDt(doc.valid_from)}</span>}
                  {doc.file_size&&<span className="text-[10px] text-slate-700">{fmtSz(doc.file_size)}</span>}
                </div>
              </div>
              <span className="text-[10px] text-slate-700 hidden sm:block shrink-0">{fmtDt(doc.uploaded_at)}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={()=>setPreviewId(doc.id)} className="btn-ghost p-1.5"><Eye size={12}/></button>
                <button onClick={()=>window.api.documents.open(doc.id)} className="btn-ghost p-1.5"><ExternalLink size={12}/></button>
                <button onClick={()=>deleteMut.mutate(doc.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {previewId&&<PreviewModal docId={previewId} onClose={()=>setPreviewId(null)}/>}
    </div>
  )
}
