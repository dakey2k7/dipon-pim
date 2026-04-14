import React    from 'react'
import ReactDOM  from 'react-dom/client'
import App       from './App'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'


// Globale Fehlerbehandlung – verhindert schwarzen Bildschirm
class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{background:'#0c0e1a',color:'#f8fafc',padding:40,fontFamily:'monospace',minHeight:'100vh'}}>
          <h2 style={{color:'#ef4444',marginBottom:16}}>⚠ App-Fehler</h2>
          <p style={{marginBottom:8,color:'#94a3b8'}}>Bitte AppData löschen und neu starten:</p>
          <pre style={{background:'#11142a',padding:16,borderRadius:8,fontSize:12,color:'#8b5cf6'}}>
{`# PowerShell:
Remove-Item "$env:APPDATA\dipon-pim" -Recurse -Force
npx electron-vite dev`}
          </pre>
          <p style={{marginTop:16,color:'#475569',fontSize:12}}>{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
)
