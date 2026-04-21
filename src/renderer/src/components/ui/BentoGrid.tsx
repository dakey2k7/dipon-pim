/**
 * BentoGrid – Drag & Drop Ordner + Einträge für Rezepturen/Produkte
 * Frozen Glass Design · Glowing Icons · Icon Library
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FolderOpen, Plus, X, Check, GripVertical, ChevronDown, ChevronUp,
  Pencil, Trash2, Image, Search,
  // Chemistry icons
  FlaskConical, Beaker, Atom, Microscope, TestTube, Zap, Activity,
  // Business icons
  Package, Truck, TrendingUp, Calculator, Store, FileText, Tag,
  BarChart2, PieChart, DollarSign, CreditCard, ShoppingCart,
  // UI icons
  Star, Heart, Bookmark, Bell, Settings, Home, Grid, List,
  ArrowRight, Link, Globe, Mail, Phone, Clock, Calendar,
  Shield, Lock, Key, Upload, Download, RefreshCw, Eye,
  // Nature / Material icons
  Layers, Box, Cylinder, Circle, Square, Triangle,
} from 'lucide-react'

// ── Icon Library ───────────────────────────────────────────────
export const ICON_LIBRARY = [
  { group:'Chemie & Labor', icons:[
    { id:'FlaskConical', label:'Kolben',      el:<FlaskConical/> },
    { id:'Beaker',       label:'Becherglas',  el:<Beaker/> },
    { id:'Atom',         label:'Atom',        el:<Atom/> },
    { id:'Microscope',   label:'Mikroskop',   el:<Microscope/> },
    { id:'TestTube',     label:'Reagenzglas', el:<TestTube/> },
    { id:'Activity',     label:'Analyse',     el:<Activity/> },
    { id:'Zap',          label:'Reaktion',    el:<Zap/> },
  ]},
  { group:'Logistik & Handel', icons:[
    { id:'Package',      label:'Paket',       el:<Package/> },
    { id:'Truck',        label:'LKW',         el:<Truck/> },
    { id:'ShoppingCart', label:'Warenkorb',   el:<ShoppingCart/> },
    { id:'Store',        label:'Lager',       el:<Store/> },
    { id:'Tag',          label:'Etikett',     el:<Tag/> },
    { id:'Box',          label:'Box',         el:<Box/> },
  ]},
  { group:'Finanzen & Analyse', icons:[
    { id:'TrendingUp',   label:'Trend',       el:<TrendingUp/> },
    { id:'BarChart2',    label:'Balken',      el:<BarChart2/> },
    { id:'PieChart',     label:'Kreisdiagramm',el:<PieChart/> },
    { id:'Calculator',   label:'Kalkulation', el:<Calculator/> },
    { id:'DollarSign',   label:'Preis',       el:<DollarSign/> },
    { id:'CreditCard',   label:'Zahlung',     el:<CreditCard/> },
  ]},
  { group:'Dokumente & Verwaltung', icons:[
    { id:'FileText',     label:'Dokument',    el:<FileText/> },
    { id:'Layers',       label:'Schichten',   el:<Layers/> },
    { id:'Bookmark',     label:'Lesezeichen', el:<Bookmark/> },
    { id:'Link',         label:'Verknüpfung', el:<Link/> },
    { id:'Globe',        label:'Global',      el:<Globe/> },
    { id:'Shield',       label:'Schutz',      el:<Shield/> },
  ]},
  { group:'Allgemein', icons:[
    { id:'Star',         label:'Favorit',     el:<Star/> },
    { id:'Heart',        label:'Favorit 2',   el:<Heart/> },
    { id:'Bell',         label:'Alarm',       el:<Bell/> },
    { id:'Settings',     label:'Einstellungen',el:<Settings/> },
    { id:'Home',         label:'Startseite',  el:<Home/> },
    { id:'Clock',        label:'Zeit',        el:<Clock/> },
    { id:'Calendar',     label:'Kalender',    el:<Calendar/> },
    { id:'Eye',          label:'Ansicht',     el:<Eye/> },
    { id:'Key',          label:'Schlüssel',   el:<Key/> },
  ]},
]

function getIconEl(id: string, size=16): React.ReactElement {
  for (const group of ICON_LIBRARY) {
    const found = group.icons.find(i=>i.id===id)
    if (found) return found.el as React.ReactElement
  }
  return <FolderOpen size={size}/>
}

// ── Color Palette ──────────────────────────────────────────────
const GLOW_COLORS = [
  '#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899',
  '#ef4444','#3b82f6','#a78bfa','#34d399','#fbbf24',
]

// ── Types ──────────────────────────────────────────────────────
export interface BentoItem {
  id: string
  type: 'entry' | 'folder'
  name: string
  code?: string
  folderId?: string | null
  order: number
}
export interface BentoFolder {
  id: string
  title: string
  icon: string
  color: string
  imageUrl?: string
  collapsed: boolean
  order: number
}

interface BentoGridProps {
  items: BentoItem[]
  folders: BentoFolder[]
  onReorder: (items: BentoItem[], folders: BentoFolder[]) => void
  onItemClick: (item: BentoItem) => void
  renderItemContent: (item: BentoItem) => React.ReactNode
  className?: string
}

// ── Icon Picker Modal ──────────────────────────────────────────
function IconPicker({ value, color, onSelect, onClose }: {
  value: string; color: string; onSelect:(id:string)=>void; onClose:()=>void
}) {
  const [search, setSearch] = useState('')
  const filtered = ICON_LIBRARY.map(g=>({
    ...g,
    icons: g.icons.filter(i=>!search || i.label.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()))
  })).filter(g=>g.icons.length>0)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{background:'rgba(4,6,14,0.55)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)'}}
      onClick={onClose}>
      <div className="rounded-2xl overflow-hidden w-96 max-h-[70vh] flex flex-col"
        style={{background:'rgba(8,11,24,0.88)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',boxShadow:'0 32px 80px rgba(0,0,0,0.7)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <p className="text-sm font-bold text-white">Icon auswählen</p>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14}/></button>
        </div>
        <div className="p-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Icon suchen…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/8 text-white outline-none focus:border-brand-500"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {filtered.map(group=>(
            <div key={group.group}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{group.group}</p>
              <div className="grid grid-cols-5 gap-2">
                {group.icons.map(icon=>(
                  <button key={icon.id} onClick={()=>onSelect(icon.id)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                    style={{
                      background:value===icon.id?`${color}25`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${value===icon.id?color+'60':'rgba(255,255,255,0.06)'}`,
                      boxShadow:value===icon.id?`0 0 12px ${color}40`:'none',
                    }}>
                    <span style={{color:value===icon.id?color:'#64748b',filter:value===icon.id?`drop-shadow(0 0 4px ${color})`:'none'}}>
                      {React.cloneElement(icon.el as React.ReactElement<any>, {size:20})}
                    </span>
                    <span className="text-[9px]" style={{color:value===icon.id?'white':'#475569'}}>{icon.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Folder Editor Modal ────────────────────────────────────────
function FolderEditor({ folder, onSave, onClose }: {
  folder?: Partial<BentoFolder>; onSave:(f:Partial<BentoFolder>)=>void; onClose:()=>void
}) {
  const [title, setTitle]     = useState(folder?.title||'Neuer Ordner')
  const [icon, setIcon]       = useState(folder?.icon||'FolderOpen')
  const [color, setColor]     = useState(folder?.color||'#8b5cf6')
  const [showIcons, setShowIcons] = useState(false)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{background:'rgba(0,0,0,0.65)',backdropFilter:'blur(8px)'}}
      onClick={onClose}>
      <div className="rounded-2xl overflow-hidden w-80"
        style={{background:'rgba(8,11,24,0.88)',border:`1px solid rgba(255,255,255,0.1)`,borderRadius:20,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',boxShadow:`0 32px 80px rgba(0,0,0,0.7),0 0 30px ${color}12`}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <p className="text-sm font-bold text-white">{folder?.id?'Ordner bearbeiten':'Neuer Ordner'}</p>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14}/></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Preview */}
          <div className="flex items-center justify-center py-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{background:`${color}20`,border:`1px solid ${color}40`,boxShadow:`0 0 24px ${color}40`}}>
              <span style={{color,filter:`drop-shadow(0 0 8px ${color})`}}>
                {React.cloneElement(getIconEl(icon) as React.ReactElement<any>, {size:28})}
              </span>
            </div>
          </div>
          {/* Title */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Titel</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} autoFocus
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-brand-500"/>
          </div>
          {/* Icon */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Icon</label>
            <button onClick={()=>setShowIcons(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'white'}}>
              <span style={{color}}>{React.cloneElement(getIconEl(icon) as React.ReactElement<any>, {size:16})}</span>
              {icon}
              <span className="ml-auto text-slate-500 text-xs">Ändern →</span>
            </button>
          </div>
          {/* Color */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Farbe / Glow</label>
            <div className="flex gap-2 flex-wrap">
              {GLOW_COLORS.map(col=>(
                <button key={col} onClick={()=>setColor(col)}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{background:col,boxShadow:color===col?`0 0 12px ${col},0 0 4px ${col}`:'none',transform:color===col?'scale(1.2)':'scale(1)',border:color===col?`2px solid white`:'2px solid transparent'}}/>
              ))}
              <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0" style={{colorScheme:'dark'}}/>
            </div>
          </div>
          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8'}}>Abbrechen</button>
            <button onClick={()=>onSave({title,icon,color})}
              className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{background:`${color}30`,border:`1px solid ${color}50`,color:'white',boxShadow:`0 0 12px ${color}25`}}>
              <Check size={12}/>Speichern
            </button>
          </div>
        </div>
      </div>
      {showIcons&&<IconPicker value={icon} color={color} onSelect={id=>{setIcon(id);setShowIcons(false)}} onClose={()=>setShowIcons(false)}/>}
    </div>,
    document.body
  )
}

// ── Draggable Item Row ─────────────────────────────────────────
function DraggableItem({ item, color, onDragStart, onDragOver, onDrop, children, onItemClick }: {
  item: BentoItem; color: string; onDragStart:(id:string)=>void; onDragOver:(e:React.DragEvent)=>void;
  onDrop:(targetId:string)=>void; children: React.ReactNode; onItemClick:(item:BentoItem)=>void
}) {
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)

  return (
    <div
      draggable
      onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDragging(true);onDragStart(item.id)}}
      onDragEnd={()=>setDragging(false)}
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setOver(true)}}
      onDragEnter={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(false)}}
      onDrop={e=>{e.preventDefault();e.stopPropagation();setOver(false);onDrop(item.id)}}
      className="flex items-center gap-2 rounded-xl transition-all group"
      style={{
        opacity:dragging?0.3:1,
        background:over?`${color}12`:'rgba(255,255,255,0.02)',
        border:`1px solid ${over?color+'50':'rgba(255,255,255,0.05)'}`,
        cursor:'grab',
        transform:over?'scale(1.015)':'scale(1)',
        boxShadow:over?`0 0 12px ${color}25`:'none',
        transition:'all 0.15s ease',
      }}>
      {/* Drag handle */}
      <div className="p-2 cursor-grab opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
        <GripVertical size={14} className="text-slate-500"/>
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0" onClick={()=>onItemClick(item)}>
        {children}
      </div>
    </div>
  )
}

// ── Main BentoGrid Component ───────────────────────────────────
import React from 'react'

export function BentoGrid({ items, folders, onReorder, onItemClick, renderItemContent }: BentoGridProps) {
  const [localItems, setLocalItems]     = useState<BentoItem[]>(items)
  const [localFolders, setLocalFolders] = useState<BentoFolder[]>(folders)
  const [draggingId, setDraggingId]     = useState<string|null>(null)
  const [editFolder, setEditFolder]     = useState<string|'new'|null>(null)
  const [deletingFolder, setDeletingFolder] = useState<string|null>(null)

  // Sync props → local only on initial mount, not on every prop change
  // (prevents drag positions from resetting when products query refetches)
  useEffect(()=>{ setLocalItems(items) },[]) // mount only
  useEffect(()=>{ setLocalFolders(folders) },[]) // mount only

  const handleDrop = useCallback((targetId: string) => {
    if (!draggingId || draggingId === targetId) return
    const newItems = [...localItems]
    const fromIdx = newItems.findIndex(i=>i.id===draggingId)
    const toIdx   = newItems.findIndex(i=>i.id===targetId)
    if (fromIdx<0||toIdx<0) return
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    const reordered = newItems.map((item,i)=>({...item, order:i}))
    setLocalItems(reordered)
    onReorder(reordered, localFolders)
    setDraggingId(null)
  }, [draggingId, localItems, localFolders, onReorder])

  const addFolder = (data: Partial<BentoFolder>) => {
    const newFolder: BentoFolder = {
      id: `folder-${Date.now()}`,
      title: data.title||'Neuer Ordner',
      icon: data.icon||'FolderOpen',
      color: data.color||'#8b5cf6',
      collapsed: false,
      order: localFolders.length,
    }
    const updated = [...localFolders, newFolder]
    setLocalFolders(updated)
    onReorder(localItems, updated)
    setEditFolder(null)
  }

  const updateFolder = (id: string, data: Partial<BentoFolder>) => {
    const updated = localFolders.map(f=>f.id===id?{...f,...data}:f)
    setLocalFolders(updated)
    onReorder(localItems, updated)
    setEditFolder(null)
  }

  const deleteFolder = (id: string) => {
    // Move items out of folder
    const updatedItems = localItems.map(i=>i.folderId===id?{...i,folderId:null}:i)
    const updatedFolders = localFolders.filter(f=>f.id!==id)
    setLocalItems(updatedItems)
    setLocalFolders(updatedFolders)
    onReorder(updatedItems, updatedFolders)
    setDeletingFolder(null)
  }

  const toggleFolder = (id: string) => {
    const updated = localFolders.map(f=>f.id===id?{...f,collapsed:!f.collapsed}:f)
    setLocalFolders(updated)
    onReorder(localItems, updated)
  }

  const ungroupedItems = localItems.filter(i=>!i.folderId)
  const foldersOrdered = [...localFolders].sort((a,b)=>a.order-b.order)

  const currentEditFolder = editFolder && editFolder!=='new'
    ? localFolders.find(f=>f.id===editFolder)
    : undefined

  return (
    <div className="space-y-3">
      {/* Add folder button */}
      <div className="flex justify-end">
        <button onClick={()=>setEditFolder('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.25)',color:'#a78bfa',boxShadow:'0 0 12px rgba(139,92,246,0.1)'}}>
          <Plus size={12}/>Ordner anlegen
        </button>
      </div>

      {/* Folders */}
      {foldersOrdered.map(folder=>{
        const folderItems = localItems.filter(i=>i.folderId===folder.id).sort((a,b)=>a.order-b.order)
        return (
          <div key={folder.id} className="rounded-2xl overflow-hidden transition-all"
            style={{
              background:`linear-gradient(135deg,${folder.color}08,rgba(0,0,0,0.3))`,
              border:`1px solid ${folder.color}25`,
              backdropFilter:'blur(20px)',
              boxShadow:`0 4px 24px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}>
            {/* Folder header */}
            <div className="flex items-center gap-3 px-4 py-3"
              style={{borderBottom:folder.collapsed?'none':`1px solid ${folder.color}15`,background:`${folder.color}06`}}>
              {/* Glowing icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                style={{background:`${folder.color}20`,border:`1px solid ${folder.color}40`,boxShadow:`0 0 16px ${folder.color}30`}}>
                <span style={{color:folder.color,filter:`drop-shadow(0 0 6px ${folder.color})`}}>
                  {React.cloneElement(getIconEl(folder.icon) as React.ReactElement<any>, {size:17})}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{folder.title}</p>
                <p className="text-[10px] text-slate-500">{folderItems.length} Einträge</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={()=>setEditFolder(folder.id)}
                  className="p-1.5 rounded-lg transition-all" style={{color:'rgba(255,255,255,0.4)'}}>
                  <Pencil size={12}/>
                </button>
                <button onClick={()=>setDeletingFolder(folder.id)}
                  className="p-1.5 rounded-lg transition-all text-red-400/40 hover:text-red-400">
                  <Trash2 size={12}/>
                </button>
                <button onClick={()=>toggleFolder(folder.id)}
                  className="p-1.5 rounded-lg" style={{color:'rgba(255,255,255,0.4)'}}>
                  {folder.collapsed?<ChevronDown size={14}/>:<ChevronUp size={14}/>}
                </button>
              </div>
            </div>
            {/* Folder items */}
            {!folder.collapsed&&(
              <div className="p-3 space-y-1.5">
                {!folderItems.length&&(
                  <p className="text-[10px] text-center py-3 text-slate-700">Keine Einträge</p>
                )}
                {folderItems.map(item=>(
                  <DraggableItem key={item.id} item={item} color={folder.color}
                    onDragStart={setDraggingId} onDragOver={()=>{}} onDrop={handleDrop}
                    onItemClick={onItemClick}>
                    {renderItemContent(item)}
                  </DraggableItem>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Ungrouped items */}
      {ungroupedItems.length>0&&(
        <div className="space-y-1.5">
          {ungroupedItems.sort((a,b)=>a.order-b.order).map(item=>(
            <DraggableItem key={item.id} item={item} color="#8b5cf6"
              onDragStart={setDraggingId} onDragOver={()=>{}} onDrop={handleDrop}
              onItemClick={onItemClick}>
              {renderItemContent(item)}
            </DraggableItem>
          ))}
        </div>
      )}

      {/* Folder editor */}
      {editFolder&&(
        <FolderEditor
          folder={editFolder==='new'?{}:currentEditFolder}
          onSave={data=>{
            if (editFolder==='new') addFolder(data)
            else updateFolder(editFolder, data)
          }}
          onClose={()=>setEditFolder(null)}/>
      )}

      {/* Delete folder confirm */}
      {deletingFolder&&createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{background:'rgba(0,0,0,0.65)',backdropFilter:'blur(8px)'}}
          onClick={()=>setDeletingFolder(null)}>
          <div className="rounded-2xl p-5 w-72 text-center"
            style={{background:'rgba(8,11,24,0.88)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',boxShadow:'0 32px 80px rgba(0,0,0,0.7)'}}
            onClick={e=>e.stopPropagation()}>
            <Trash2 size={32} className="text-red-400 mx-auto mb-3"/>
            <p className="text-sm font-bold text-white mb-1">Ordner löschen?</p>
            <p className="text-xs text-slate-500 mb-4">Inhalte bleiben erhalten und werden ohne Ordner angezeigt</p>
            <div className="flex gap-2">
              <button onClick={()=>setDeletingFolder(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8'}}>Abbrechen</button>
              <button onClick={()=>deleteFolder(deletingFolder!)} className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',color:'#f87171'}}>Löschen</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
