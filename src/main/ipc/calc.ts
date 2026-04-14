import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDb }      from '../database/setup'
import { calculate }  from '../lib/calc-engine'
import type { CalcStep } from '../lib/calc-engine'
import { writeFileSync } from 'fs'

export function registerCalcHandlers(): void {

  // ── Profile ─────────────────────────────────────────────────
  ipcMain.handle('calc:listProfiles', () => {
    return getDb().prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM calc_steps s WHERE s.profile_id=p.id) AS step_count
      FROM calc_profiles p WHERE p.is_active=1
      ORDER BY p.sort_order ASC, p.name ASC
    `).all()
  })

  ipcMain.handle('calc:getProfile', (_e, id: number) => {
    const db = getDb()
    const profile = db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(id)
    const steps   = db.prepare('SELECT * FROM calc_steps WHERE profile_id=? ORDER BY sort_order ASC').all(id)
    return { ...profile as object, steps }
  })

  ipcMain.handle('calc:createProfile', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    if (!d.name || !d.code) throw new Error('Name und Code erforderlich')
    const r = db.prepare(`INSERT INTO calc_profiles
      (name,code,description,channel,currency,color,is_default,sort_order)
      VALUES(?,?,?,?,?,?,?,?)`).run(
      d.name, String(d.code).toUpperCase(),
      d.description||null, d.channel||'custom',
      d.currency||'EUR', d.color||'#8b5cf6',
      d.is_default?1:0, d.sort_order??0
    )
    return db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('calc:updateProfile', (_e, id: number, d: Record<string,unknown>) => {
    const db = getDb()
    db.prepare(`UPDATE calc_profiles SET name=?,code=?,description=?,channel=?,
      currency=?,color=?,sort_order=?,updated_at=datetime('now') WHERE id=?`).run(
      d.name, String(d.code||'').toUpperCase(),
      d.description||null, d.channel||'custom',
      d.currency||'EUR', d.color||'#8b5cf6',
      d.sort_order??0, id
    )
    return db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(id)
  })

  ipcMain.handle('calc:deleteProfile', (_e, id: number) => {
    getDb().prepare('DELETE FROM calc_profiles WHERE id=?').run(id)
    return { success: true }
  })

  ipcMain.handle('calc:duplicateProfile', (_e, id: number, newName: string) => {
    const db = getDb()
    const src = db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(id) as Record<string,unknown>|undefined
    if (!src) throw new Error('Profil nicht gefunden')

    const code = String(newName).toUpperCase().replace(/\s+/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4)
    const r = db.prepare(`INSERT INTO calc_profiles
      (name,code,description,channel,currency,color,sort_order)
      VALUES(?,?,?,?,?,?,?)`).run(
      newName, code, src.description, src.channel,
      src.currency, src.color, src.sort_order
    )
    const newId = r.lastInsertRowid

    // Schritte kopieren
    const steps = db.prepare('SELECT * FROM calc_steps WHERE profile_id=? ORDER BY sort_order ASC').all(id) as CalcStep[]
    const ins = db.prepare(`INSERT INTO calc_steps
      (profile_id,sort_order,step_type,label,value_source,value_manual,value_percent,
       linked_id,linked_type,percent_base,is_subtotal,is_result,is_visible,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    for (const s of steps) {
      ins.run(newId,s.sort_order,s.step_type,s.label,s.value_source,
        s.value_manual,s.value_percent,s.linked_id,s.linked_type,
        s.percent_base,s.is_subtotal,s.is_result,s.is_visible,s.notes)
    }
    return db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(newId)
  })

  // ── Schritte ────────────────────────────────────────────────
  ipcMain.handle('calc:getSteps', (_e, profileId: number) => {
    return getDb().prepare('SELECT * FROM calc_steps WHERE profile_id=? ORDER BY sort_order ASC').all(profileId)
  })

  ipcMain.handle('calc:saveStep', (_e, d: Record<string,unknown>) => {
    const db = getDb()
    if (d.id) {
      db.prepare(`UPDATE calc_steps SET sort_order=?,step_type=?,label=?,value_source=?,
        value_manual=?,value_percent=?,linked_id=?,linked_type=?,percent_base=?,
        is_subtotal=?,is_result=?,is_visible=?,notes=? WHERE id=?`).run(
        d.sort_order??0, d.step_type, d.label,
        d.value_source||'manual', d.value_manual??null, d.value_percent??null,
        d.linked_id??null, d.linked_type??null, d.percent_base||'running',
        d.is_subtotal?1:0, d.is_result?1:0, d.is_visible?1:0,
        d.notes||null, d.id
      )
      return db.prepare('SELECT * FROM calc_steps WHERE id=?').get(d.id)
    } else {
      // Neuer Schritt – sort_order am Ende
      const maxOrder = (db.prepare(
        'SELECT MAX(sort_order) AS m FROM calc_steps WHERE profile_id=?'
      ).get(d.profile_id) as { m: number | null }).m ?? 0
      const r = db.prepare(`INSERT INTO calc_steps
        (profile_id,sort_order,step_type,label,value_source,value_manual,value_percent,
         linked_id,linked_type,percent_base,is_subtotal,is_result,is_visible,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        d.profile_id, maxOrder + 10, d.step_type||'add_fixed', d.label||'Neuer Schritt',
        d.value_source||'manual', d.value_manual??null, d.value_percent??null,
        d.linked_id??null, d.linked_type??null, d.percent_base||'running',
        d.is_subtotal?1:0, d.is_result?1:0, 1, d.notes||null
      )
      return db.prepare('SELECT * FROM calc_steps WHERE id=?').get(r.lastInsertRowid)
    }
  })

  ipcMain.handle('calc:deleteStep', (_e, id: number) => {
    getDb().prepare('DELETE FROM calc_steps WHERE id=?').run(id)
    return { success: true }
  })

  ipcMain.handle('calc:reorderSteps', (_e, profileId: number, orderedIds: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE calc_steps SET sort_order=? WHERE id=? AND profile_id=?')
    orderedIds.forEach((id, idx) => stmt.run((idx + 1) * 10, id, profileId))
    return { success: true }
  })

  // ── Berechnen ───────────────────────────────────────────────
  ipcMain.handle('calc:run', (_e, profileId: number, overrides: Record<number,number> = {}) => {
    const db = getDb()
    const profile = db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(profileId) as { currency: string }|undefined
    if (!profile) throw new Error('Profil nicht gefunden')
    const steps = db.prepare(
      'SELECT * FROM calc_steps WHERE profile_id=? AND is_visible=1 ORDER BY sort_order ASC'
    ).all(profileId) as CalcStep[]
    return calculate(steps, overrides, profile.currency)
  })

  ipcMain.handle('calc:runMultiple', (_e, profileIds: number[], overrides: Record<number, Record<number,number>> = {}) => {
    const db = getDb()
    const results: Record<number, unknown> = {}
    for (const pid of profileIds) {
      const profile = db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(pid) as { currency: string }|undefined
      if (!profile) continue
      const steps = db.prepare(
        'SELECT * FROM calc_steps WHERE profile_id=? AND is_visible=1 ORDER BY sort_order ASC'
      ).all(pid) as CalcStep[]
      results[pid] = calculate(steps, overrides[pid] ?? {}, profile.currency)
    }
    return results
  })

  // ── CSV Export ──────────────────────────────────────────────
  ipcMain.handle('calc:exportCSV', async (_e, profileId: number, overrides: Record<number,number> = {}) => {
    const db = getDb()
    const profile = db.prepare('SELECT * FROM calc_profiles WHERE id=?').get(profileId) as Record<string,unknown>|undefined
    if (!profile) throw new Error('Profil nicht gefunden')

    const steps  = db.prepare(
      'SELECT * FROM calc_steps WHERE profile_id=? AND is_visible=1 ORDER BY sort_order ASC'
    ).all(profileId) as CalcStep[]
    const result = calculate(steps, overrides, String(profile.currency||'EUR'))

    const win = BrowserWindow.getFocusedWindow()
    const { filePath } = await dialog.showSaveDialog(win!, {
      title:       'CSV exportieren',
      defaultPath: `kalkulation-${String(profile.code)}.csv`,
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (!filePath) return { cancelled: true }

    const rows = [
      ['Profil', profile.name],
      ['Kanal',  profile.channel],
      ['Datum',  new Date().toLocaleDateString('de-DE')],
      [],
      ['Schritt', 'Betrag', 'Laufendes Total'],
      ...result.steps.map(s => [
        s.step.label,
        s.delta.toFixed(2).replace('.', ','),
        s.running.toFixed(2).replace('.', ','),
      ]),
      [],
      ['Ausgangswert', result.base.toFixed(2).replace('.', ',')],
      ['Endwert',      result.final.toFixed(2).replace('.', ',')],
      ['Marge',        result.margin != null ? result.margin.toFixed(1).replace('.',',') + ' %' : '–'],
      ['Aufschlag',    result.markup != null ? result.markup.toFixed(1).replace('.',',') + ' %' : '–'],
    ]

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n')
    writeFileSync(filePath, '\uFEFF' + csv, 'utf8') // BOM für Excel
    return { success: true, path: filePath }
  })
}
