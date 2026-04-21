import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, X, Trash2, ZoomIn } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ProductImageProps {
  productId: number
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  editable?: boolean
}

const SIZES = {
  sm: { box: 'w-9 h-9', text: 'text-xs', icon: 14 },
  md: { box: 'w-12 h-12', text: 'text-sm', icon: 18 },
  lg: { box: 'w-16 h-16', text: 'text-base', icon: 22 },
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ productId, name, onClose }: { productId:number; name:string; onClose:()=>void }) {
  const [src, setSrc] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(window.api as any).productImages.getFull(productId).then((data:string|null) => {
      setSrc(data)
      setLoading(false)
    })
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [productId])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)'}}
      onClick={onClose}>
      <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between w-full mb-3 px-1">
          <p className="text-white font-semibold text-sm">{name}</p>
          <button onClick={onClose} className="btn-ghost p-1.5 text-slate-400 hover:text-white">
            <X size={18}/>
          </button>
        </div>
        {loading ? (
          <div className="w-64 h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"/>
          </div>
        ) : src ? (
          <img src={src} alt={name}
            className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            style={{boxShadow:'0 0 60px rgba(139,92,246,0.3)'}}/>
        ) : (
          <p className="text-slate-500">Kein Bild verfügbar</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────
export function ProductImage({ productId, name, color='#7c3aed', size='md', editable=false }: ProductImageProps) {
  const qc = useQueryClient()
  const s  = SIZES[size]
  const [imgSrc, setImgSrc]     = useState<string|null>(null)
  const [loading, setLoading]   = useState(true)
  const [hover, setHover]       = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await (window.api as any).productImages.get(productId)
      setImgSrc(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [productId])

  const handleUpload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setUploading(true)
    try {
      const r = await (window.api as any).productImages.upload(productId)
      if (r?.success) { await load(); qc.invalidateQueries({queryKey:['product-detail', productId]}) }
    } catch {}
    setUploading(false)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await (window.api as any).productImages.delete(productId)
    setImgSrc(null)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (imgSrc) setLightbox(true)
    else if (editable) handleUpload(e)
  }

  const initials = name.slice(0,2).toUpperCase()

  return (
    <>
      <div
        className={`${s.box} rounded-xl flex items-center justify-center relative shrink-0 overflow-hidden transition-all cursor-pointer`}
        style={{background: imgSrc ? 'transparent' : `linear-gradient(135deg,${color},#4a57e5)`}}
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        onClick={handleClick}>

        {loading ? (
          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
        ) : imgSrc ? (
          <>
            <img src={imgSrc} alt={name}
              className="w-full h-full object-cover"
              style={{transition:'filter 0.2s', filter:hover?'brightness(0.7)':'brightness(1)'}}/>
            {/* Hover overlay */}
            {hover && (
              <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                <button className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80" title="Vergrößern"
                  onClick={e=>{e.stopPropagation();setLightbox(true)}}>
                  <ZoomIn size={12}/>
                </button>
                {editable && (
                  <>
                    <button className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80" title="Bild ändern"
                      onClick={handleUpload}>
                      <Camera size={12}/>
                    </button>
                    <button className="p-1 rounded-lg bg-red-500/70 text-white hover:bg-red-600" title="Bild löschen"
                      onClick={handleDelete}>
                      <Trash2 size={12}/>
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <span className={`${s.text} font-black text-white`}>{initials}</span>
            {editable && hover && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{background:'rgba(0,0,0,0.5)'}}>
                {uploading
                  ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                  : <Camera size={s.icon} className="text-white"/>}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <Lightbox productId={productId} name={name} onClose={()=>setLightbox(false)}/>
      )}
    </>
  )
}
