import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RefreshCw, Trash2, RotateCcw, Clock,
  HardDrive, CheckCircle, AlertTriangle, Calendar,
} from 'lucide-react'
import { Button }        from '@/components/ui/Input'
import { Spinner, Card } from '@/components/ui/Badge'
import { useToast }      from '@/hooks/useToast'

interface BackupFile { name:string; path:string; size:number; created_at:string }
interface BackupSettings { auto12h:boolean; auto24h:boolean; maxBackups:number; lastBackup:string|null }

const fmtSize=(b:number)=>b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(2)} MB`
const fmtDT=(dt:string)=>{try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(dt))}catch{return dt}}

export default function BackupPage() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [restoreConfirm, setRestoreConfirm] = useState<BackupFile|null>(null)

  const {data:backups=[],isLoading:bLoading}=useQuery<BackupFile[]>({
    queryKey:['backups'],
    queryFn: ()=>window.api.backup.list() as Promise<BackupFile[]>,
    refetchInterval:30_000,
  })
  const {data:settings,isLoading:sLoading}=useQuery<BackupSettings>({
    queryKey:['backup-settings'],
    queryFn: ()=>window.api.backup.getSettings() as Promise<BackupSettings>,
  })
  const [localSettings,setLocalSettings]=useState<BackupSettings|null>(null)
  const s=localSettings??settings??{auto12h:false,auto24h:true,maxBackups:30,lastBackup:null}
  const setS=(k:keyof BackupSettings,v:unknown)=>setLocalSettings({...s,[k]:v})

  const inv=()=>{qc.invalidateQueries({queryKey:['backups']});qc.invalidateQueries({queryKey:['backup-settings']})}

  const createMut=useMutation({
    mutationFn:()=>window.api.backup.create('manual'),
    onSuccess:(r:any)=>{inv();toast.success(`Backup erstellt (${fmtSize(r.size)})`)},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })
  const deleteMut=useMutation({
    mutationFn:(path:string)=>window.api.backup.delete(path),
    onSuccess:()=>{inv();toast.success('Backup gelöscht')},
  })
  const restoreMut=useMutation({
    mutationFn:(path:string)=>window.api.backup.restore(path),
    onSuccess:(r:any)=>{setRestoreConfirm(null);toast.success(r.message)},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })
  const saveMut=useMutation({
    mutationFn:(s:BackupSettings)=>window.api.backup.saveSettings(s),
    onSuccess:()=>{inv();toast.success('Einstellungen gespeichert')},
  })

  const totalSize=backups.reduce((a,b)=>a+b.size,0)

  return(
    <div className="space-y-5 max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="page-title">Backup & Wiederherstellung</h2>
          <p className="page-subtitle">{backups.length} Backups · {fmtSize(totalSize)} gesamt</p>
        </div>
        <Button icon={<Save size={14} className={createMut.isPending?'animate-pulse':''}/>}
          onClick={()=>createMut.mutate()} loading={createMut.isPending}>
          Sofort-Backup
        </Button>
      </div>

      {/* Auto-Backup Einstellungen */}
      <Card>
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Clock size={14} className="text-brand-400"/> Auto-Backup Einstellungen
        </h3>
        {sLoading?<Spinner size={20}/>:(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 12h */}
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{background:s.auto12h?'rgb(139 92 246/0.1)':'rgb(255 255 255/0.03)',border:`1px solid ${s.auto12h?'rgb(139 92 246/0.3)':'rgb(255 255 255/0.06)'}`}}>
                <div className="flex items-center gap-3">
                  <Clock size={18} className={s.auto12h?'text-brand-400':'text-slate-600'}/>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Alle 12 Stunden</p>
                    <p className="text-xs text-slate-500">Stündlich rotierend</p>
                  </div>
                </div>
                <button onClick={()=>setS('auto12h',!s.auto12h)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${s.auto12h?'bg-brand-500':'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${s.auto12h?'translate-x-5':'translate-x-0.5'}`}/>
                </button>
              </div>
              {/* 24h */}
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{background:s.auto24h?'rgb(139 92 246/0.1)':'rgb(255 255 255/0.03)',border:`1px solid ${s.auto24h?'rgb(139 92 246/0.3)':'rgb(255 255 255/0.06)'}`}}>
                <div className="flex items-center gap-3">
                  <Calendar size={18} className={s.auto24h?'text-brand-400':'text-slate-600'}/>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Alle 24 Stunden</p>
                    <p className="text-xs text-slate-500">Täglich rotierend</p>
                  </div>
                </div>
                <button onClick={()=>setS('auto24h',!s.auto24h)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${s.auto24h?'bg-brand-500':'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${s.auto24h?'translate-x-5':'translate-x-0.5'}`}/>
                </button>
              </div>
            </div>
            {/* Max. Backups */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 w-40">Max. Backups aufbewahren</span>
              <div className="flex items-center gap-3 flex-1">
                <input type="range" min={5} max={100} step={5} value={s.maxBackups}
                  onChange={e=>setS('maxBackups',Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full accent-violet-500"/>
                <span className="text-sm font-mono text-slate-200 w-8">{s.maxBackups}</span>
              </div>
            </div>
            {s.lastBackup&&(
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle size={11} className="text-emerald-400"/>
                Letztes Auto-Backup: {fmtDT(s.lastBackup)}
              </p>
            )}
            <div className="flex justify-end">
              <Button loading={saveMut.isPending} onClick={()=>saveMut.mutate(s)}>Einstellungen speichern</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Backup-Liste */}
      <Card>
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <HardDrive size={14} className="text-cyan-400"/> Gespeicherte Backups
        </h3>
        {bLoading?<Spinner size={20}/>:!backups.length?(
          <div className="text-center py-8">
            <HardDrive size={36} className="text-slate-700 mx-auto mb-3"/>
            <p className="text-slate-500 text-sm">Noch keine Backups vorhanden</p>
            <Button className="mt-3" icon={<Save size={13}/>} onClick={()=>createMut.mutate()}>
              Erstes Backup erstellen
            </Button>
          </div>
        ):(
          <div className="space-y-2">
            {backups.map(b=>{
              const isAuto  = b.name.includes('-auto-')
              const isPre   = b.name.includes('-pre-restore-')
              const tagColor= isAuto?'#06b6d4':isPre?'#f59e0b':'#10b981'
              const tagLabel= isAuto?'Auto':isPre?'Vor-Restore':'Manuell'
              return(
                <div key={b.name}
                  className="flex items-center justify-between p-3 rounded-xl group"
                  style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
                  <div className="flex items-center gap-3">
                    <HardDrive size={16} className="text-slate-500 shrink-0"/>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{b.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{background:`${tagColor}20`,color:tagColor}}>{tagLabel}</span>
                        <span className="text-xs text-slate-500">{fmtSize(b.size)}</span>
                        <span className="text-xs text-slate-600">{fmtDT(b.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="secondary" icon={<RotateCcw size={11}/>}
                      onClick={()=>setRestoreConfirm(b)}>
                      Wiederherstellen
                    </Button>
                    <button className="btn-ghost p-1.5 text-red-400"
                      onClick={()=>deleteMut.mutate(b.path)}><Trash2 size={13}/></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Restore Confirm */}
      {restoreConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-amber-400 shrink-0"/>
              <div>
                <h3 className="text-base font-bold text-white">Backup wiederherstellen?</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Der aktuelle Stand wird gesichert, dann wird das Backup eingespielt.
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl mb-4 text-xs font-mono text-slate-400"
              style={{background:'rgb(0 0 0/0.3)'}}>
              {restoreConfirm.name}
            </div>
            <p className="text-xs text-amber-400 mb-4 flex items-center gap-1.5">
              <AlertTriangle size={11}/> Die App muss danach neu gestartet werden.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={()=>setRestoreConfirm(null)}>Abbrechen</Button>
              <Button loading={restoreMut.isPending}
                onClick={()=>restoreMut.mutate(restoreConfirm.path)}
                style={{background:'#f59e0b',borderColor:'#f59e0b'}}>
                Jetzt wiederherstellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
