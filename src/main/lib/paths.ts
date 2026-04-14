import { app }  from 'electron'
import { join }  from 'path'
import { mkdirSync, existsSync } from 'fs'

// Im Dev-Modus: ./data/  (neben dem Projektordner)
// Im Prod-Modus: %APPDATA%/dipon-pim/  (Windows)
function getDataDir(): string {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const devData = join(process.cwd(), 'data')
    mkdirSync(devData, { recursive: true })
    return devData
  }
  const userData = join(app.getPath('userData'), 'data')
  mkdirSync(userData, { recursive: true })
  return userData
}

export const Paths = {
  get data()    { return getDataDir() },
  get db()      { return join(getDataDir(), 'dipon-pim.db') },
  get backups() {
    const p = join(getDataDir(), 'backups')
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
    return p
  },
  get docs() {
    const p = join(getDataDir(), 'documents')
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
    return p
  },
}
