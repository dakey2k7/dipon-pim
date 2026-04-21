import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { getDb }   from '../database/setup'
import { Paths }   from '../lib/paths'
import {
  copyFileSync, existsSync, mkdirSync,
  statSync, unlinkSync, readFileSync,
} from 'fs'
import { join, extname, basename } from 'path'

const MIME_MAP: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
}

export function registerDocumentHandlers(): void {

  // ── Dokument hochladen ─────────────────────────────────────
  ipcMain.handle('documents:upload', async (
    _e,
    entityType: string,
    entityId: number,
    meta: {
      category?: string
      description?: string
      valid_from?: string
      valid_until?: string
    } = {}
  ) => {
    const win = BrowserWindow.getAllWindows()[0] ?? BrowserWindow.getFocusedWindow()
    const { filePaths, canceled } = await dialog.showOpenDialog(win!, {
      title:   'Dokument hochladen',
      filters: [
        { name: 'Alle Dokumente', extensions: ['pdf','png','jpg','jpeg','xlsx','xls','docx','doc','txt','csv','webp'] },
        { name: 'PDF',            extensions: ['pdf'] },
        { name: 'Bilder',         extensions: ['png','jpg','jpeg','webp','gif'] },
        { name: 'Office',         extensions: ['xlsx','xls','docx','doc'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })

    if (canceled || !filePaths.length) return { cancelled: true }

    const db = getDb()
    const saved: unknown[] = []

    for (const srcPath of filePaths) {
      const ext      = extname(srcPath).toLowerCase()
      const origName = basename(srcPath)
      const stamp    = Date.now()
      const destName = `${entityType}-${entityId}-${stamp}${ext}`
      const destDir  = join(Paths.docs, entityType, String(entityId))

      mkdirSync(destDir, { recursive: true })
      const destPath = join(destDir, destName)

      copyFileSync(srcPath, destPath)

      const stat     = statSync(destPath)
      const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'

      const r = db.prepare(`
        INSERT INTO documents
          (entity_type, entity_id, file_name, file_path, file_size, mime_type,
           category, description, valid_from, valid_until)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(
        entityType, entityId, origName, destPath,
        stat.size, mimeType,
        meta.category ?? 'other',
        meta.description ?? null,
        meta.valid_from  ?? null,
        meta.valid_until ?? null,
      )

      saved.push(db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid))
    }

    return { success: true, documents: saved }
  })

  // ── Dokumente abrufen ──────────────────────────────────────
  ipcMain.handle('documents:list', (_e, entityType: string, entityId: number) => {
    return getDb().prepare(`
      SELECT * FROM documents
      WHERE entity_type=? AND entity_id=? AND is_deleted=0
      ORDER BY uploaded_at DESC
    `).all(entityType, entityId)
  })

  // ── Dokument im System-Viewer öffnen ──────────────────────
  ipcMain.handle('documents:open', (_e, docId: number) => {
    const db  = getDb()
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId) as
      { file_path: string } | undefined

    if (!doc || !existsSync(doc.file_path)) {
      throw new Error('Datei nicht gefunden')
    }
    shell.openPath(doc.file_path)
    return { success: true }
  })

  // ── Bild-Vorschau als Base64 (für In-App Preview) ─────────
  ipcMain.handle('documents:preview', (_e, docId: number) => {
    const db  = getDb()
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId) as
      { file_path: string; mime_type: string; file_name: string } | undefined

    if (!doc || !existsSync(doc.file_path)) throw new Error('Datei nicht gefunden')

    const isImage = doc.mime_type.startsWith('image/')
    const isPdf   = doc.mime_type === 'application/pdf'

    if (isImage || isPdf) {
      const buffer = readFileSync(doc.file_path)
      const base64 = buffer.toString('base64')
      return {
        type:     isImage ? 'image' : 'pdf',
        dataUrl:  `data:${doc.mime_type};base64,${base64}`,
        fileName: doc.file_name,
      }
    }

    // Für andere Dateitypen – im System öffnen
    shell.openPath(doc.file_path)
    return { type: 'opened', fileName: doc.file_name }
  })

  // ── Dokument löschen (soft delete) ────────────────────────
  ipcMain.handle('documents:delete', (_e, docId: number) => {
    getDb().prepare(
      "UPDATE documents SET is_deleted=1 WHERE id=?"
    ).run(docId)
    return { success: true }
  })

  // ── Dokument dauerhaft löschen ────────────────────────────
  ipcMain.handle('documents:purge', (_e, docId: number) => {
    const db  = getDb()
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId) as
      { file_path: string } | undefined

    if (doc?.file_path && existsSync(doc.file_path)) {
      try { unlinkSync(doc.file_path) } catch { /* ignore */ }
    }
    db.prepare('DELETE FROM documents WHERE id=?').run(docId)
    return { success: true }
  })
}

// ── Upload via Renderer-File-Input (zuverlässig ohne dialog) ──
ipcMain.handle('documents:saveBuffer', async (
  _e,
  entityType: string,
  entityId:   number,
  fileName:   string,
  fileData:   Buffer,
  meta:       { category?:string; description?:string; valid_from?:string; valid_until?:string } = {}
) => {
  const db      = getDb()
  const ext     = extname(fileName).toLowerCase()
  const stamp   = Date.now()
  const destName = `${entityType}-${entityId}-${stamp}${ext}`
  const destDir  = join(Paths.docs, entityType, String(entityId))

  mkdirSync(destDir, { recursive: true })
  const destPath = join(destDir, destName)

  const buf = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
  require('fs').writeFileSync(destPath, buf)

  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'

  const r = db.prepare(`
    INSERT INTO documents
      (entity_type, entity_id, file_name, file_path, file_size, mime_type,
       category, description, valid_from, valid_until)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    entityType, entityId, fileName, destPath,
    buf.length, mimeType,
    meta.category  ?? 'other',
    meta.description ?? null,
    meta.valid_from  ?? null,
    meta.valid_until ?? null,
  )

  return db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid)
})