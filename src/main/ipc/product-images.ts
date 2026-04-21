import { ipcMain, dialog, BrowserWindow, nativeImage } from 'electron'
import { getDb } from '../database/setup'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const getImageDir = () => {
  const dir = path.join(app.getPath('userData'), 'product-images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function registerProductImageHandlers(): void {

  ipcMain.handle('productImages:upload', async (_e, productId: number) => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Produktbild auswählen',
      filters: [{ name: 'Bilder', extensions: ['jpg','jpeg','png','webp','gif','bmp'] }],
      properties: ['openFile'],
    })
    if (!filePaths.length) return { success: false }

    const srcPath = filePaths[0]
    const imgDir  = getImageDir()

    // Load image via nativeImage for basic info
    const img = nativeImage.createFromPath(srcPath)
    if (img.isEmpty()) return { success: false, error: 'Ungültiges Bild' }

    const size = img.getSize()

    // Resize: max 400x400 thumbnail, preserve aspect ratio
    let resized = img
    const MAX = 400
    if (size.width > MAX || size.height > MAX) {
      const scale = Math.min(MAX / size.width, MAX / size.height)
      resized = img.resize({
        width:  Math.round(size.width  * scale),
        height: Math.round(size.height * scale),
        quality: 'good',
      })
    }

    // Save as JPEG with quality 85
    const fileName = `product-${productId}-${Date.now()}.jpg`
    const destPath = path.join(imgDir, fileName)
    const jpegData  = resized.toJPEG(85)
    fs.writeFileSync(destPath, jpegData)

    // Also save full-size version (max 1200px, quality 90) for zoom
    let fullSize = img
    const MAX_FULL = 1200
    if (size.width > MAX_FULL || size.height > MAX_FULL) {
      const scale = Math.min(MAX_FULL / size.width, MAX_FULL / size.height)
      fullSize = img.resize({
        width:  Math.round(size.width  * scale),
        height: Math.round(size.height * scale),
        quality: 'best',
      })
    }
    const fullName = `product-${productId}-${Date.now()}-full.jpg`
    const fullPath = path.join(imgDir, fullName)
    fs.writeFileSync(fullPath, fullSize.toJPEG(90))

    // Delete old image if exists
    const db = getDb()
    const old = db.prepare("SELECT image_path FROM products WHERE id=?").get(productId) as any
    if (old?.image_path) {
      try {
        const oldThumb = path.join(imgDir, path.basename(old.image_path))
        const oldFull  = oldThumb.replace('.jpg', '-full.jpg')
        if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb)
        if (fs.existsSync(oldFull))  fs.unlinkSync(oldFull)
      } catch {}
    }

    // Save path to DB
    db.prepare("UPDATE products SET image_path=? WHERE id=?").run(fileName, productId)

    return { success: true, fileName, thumbSize: jpegData.length }
  })

  ipcMain.handle('productImages:get', (_e, productId: number) => {
    const db = getDb()
    const row = db.prepare("SELECT image_path FROM products WHERE id=?").get(productId) as any
    if (!row?.image_path) return null
    const imgDir = getImageDir()
    const thumbPath = path.join(imgDir, row.image_path)
    if (!fs.existsSync(thumbPath)) return null
    const data = fs.readFileSync(thumbPath)
    return `data:image/jpeg;base64,${data.toString('base64')}`
  })

  ipcMain.handle('productImages:getFull', (_e, productId: number) => {
    const db = getDb()
    const row = db.prepare("SELECT image_path FROM products WHERE id=?").get(productId) as any
    if (!row?.image_path) return null
    const imgDir   = getImageDir()
    const fullName = row.image_path.replace('.jpg', '-full.jpg')
    const fullPath = path.join(imgDir, fullName)
    // Try full, fall back to thumb
    const usePath = fs.existsSync(fullPath) ? fullPath : path.join(imgDir, row.image_path)
    if (!fs.existsSync(usePath)) return null
    const data = fs.readFileSync(usePath)
    return `data:image/jpeg;base64,${data.toString('base64')}`
  })

  ipcMain.handle('productImages:delete', (_e, productId: number) => {
    const db = getDb()
    const row = db.prepare("SELECT image_path FROM products WHERE id=?").get(productId) as any
    if (row?.image_path) {
      const imgDir = getImageDir()
      try {
        const thumb = path.join(imgDir, row.image_path)
        const full  = thumb.replace('.jpg', '-full.jpg')
        if (fs.existsSync(thumb)) fs.unlinkSync(thumb)
        if (fs.existsSync(full))  fs.unlinkSync(full)
      } catch {}
      db.prepare("UPDATE products SET image_path=NULL WHERE id=?").run(productId)
    }
    return { success: true }
  })
}
