import { ipcMain } from 'electron'
import { net }      from 'electron'
import { getDb }    from '../database/setup'

// ── HTTP-Helfer ───────────────────────────────────────────────
function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request(url)
    let body = ''
    req.on('response', res => {
      res.on('data',  chunk => body += chunk.toString())
      res.on('end',   ()    => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

// ── BZSt EVATR Error-Codes ────────────────────────────────────
const BZST_CODES: Record<string, string> = {
  '200': '✅ Gültige USt-IdNr.',
  '201': '⚠️ Gültig, aber Firmendaten nicht übereinstimmend',
  '202': '⚠️ Gültig, aber Firmenname nicht übereinstimmend',
  '203': '⚠️ Gültig, aber PLZ nicht übereinstimmend',
  '204': '⚠️ Gültig, aber Ort nicht übereinstimmend',
  '205': '⚠️ Gültig, aber Straße nicht übereinstimmend',
  '206': '⚠️ Gültig, Firmendaten teilweise nicht übereinstimmend',
  '207': '⚠️ Gültig, Firmendaten konnten nicht geprüft werden',
  '400': '❌ Ungültige USt-IdNr.',
  '401': '❌ USt-IdNr. ist momentan ungültig',
  '402': '❌ USt-IdNr. noch nicht erteilt',
  '403': '❌ USt-IdNr. nach § 18e UStG gesperrt',
  '600': '❌ Anfrage konnte nicht verarbeitet werden',
  '999': '❌ Unbekannter Fehler',
}

// ── DB-Schema sichern ─────────────────────────────────────────
function ensureVatTable() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS vat_check_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      vat_id       TEXT    NOT NULL,
      country_code TEXT    NOT NULL,
      company_name TEXT,
      address      TEXT,
      is_valid     INTEGER NOT NULL,
      status_code  TEXT,
      message      TEXT,
      checked_at   TEXT    DEFAULT (datetime('now')),
      source       TEXT    DEFAULT 'vies',
      raw_response TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vat_log_id   ON vat_check_log(vat_id);
    CREATE INDEX IF NOT EXISTS idx_vat_log_date ON vat_check_log(checked_at DESC);
  `)
}

// ── VIES REST API (EU-weit) ───────────────────────────────────
async function checkViaVIES(vatId: string) {
  // Format: DE123456789 → country=DE, number=123456789
  const country = vatId.slice(0,2).toUpperCase()
  const number  = vatId.slice(2).replace(/\s/g,'')

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`
  const body = await httpGet(url)
  const data = JSON.parse(body) as {
    isValid: boolean; name?: string; address?: string;
    requestDate?: string; vatNumber?: string; errorWrappers?: Array<{error:string;message:string}>
  }

  return {
    source:    'VIES (EU)',
    is_valid:  data.isValid,
    name:      data.name ?? null,
    address:   data.address ?? null,
    checked_at: new Date().toISOString(),
    message:   data.isValid ? '✅ Gültige USt-IdNr. (VIES)' : '❌ Ungültige oder unbekannte USt-IdNr.',
    raw:       body,
  }
}

// ── BZSt EVATR (Nur Deutschland, genauer) ────────────────────
async function checkViaBZSt(vatId1: string, vatId2: string) {
  const url = `https://evatr.bff-online.de/evatrRPC` +
    `?UstId_1=${encodeURIComponent(vatId1)}` +
    `&UstId_2=${encodeURIComponent(vatId2)}` +
    `&Firmenname=&Ort=&PLZ=&Strasse=`

  const body  = await httpGet(url)
  // XML parsen (einfach per Regex – keine externe Lib nötig)
  const getVal = (tag: string) => {
    const m = body.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
    return m ? m[1].trim() : null
  }
  const errCode  = getVal('ErrorCode') ?? '999'
  const ergName  = getVal('Erg_Name')
  const ergStreet= getVal('Erg_Str')
  const ergPlz   = getVal('Erg_PLZ')
  const ergOrt   = getVal('Erg_Ort')

  const isValid = errCode === '200' || (Number(errCode) >= 201 && Number(errCode) <= 207)
  const message = BZST_CODES[errCode] ?? `Fehlercode ${errCode}`

  return {
    source:    'BZSt EVATR',
    is_valid:  isValid,
    name:      ergName,
    address:   [ergStreet, ergPlz, ergOrt].filter(Boolean).join(', ') || null,
    checked_at: new Date().toISOString(),
    status_code: errCode,
    message,
    raw:       body,
  }
}

export function registerVatHandlers(): void {
  ensureVatTable()

  // ── USt-ID prüfen ───────────────────────────────────────────
  ipcMain.handle('vat:check', async (_e, vatId: string, ownVatId?: string) => {
    const db = getDb()
    const cleaned = vatId.replace(/\s/g,'').toUpperCase()
    if (cleaned.length < 4) throw new Error('USt-IdNr. zu kurz')

    const country = cleaned.slice(0,2)
    let result: ReturnType<typeof checkViaBZSt> extends Promise<infer T> ? T : never

    try {
      if (country === 'DE' && ownVatId) {
        // Deutsche Prüfung via BZSt (genauer, mit Firmenvergleich)
        result = await checkViaBZSt(ownVatId, cleaned)
      } else {
        // EU-weit via VIES
        result = await checkViaVIES(cleaned)
      }
    } catch {
      // Fallback: nur VIES
      result = await checkViaVIES(cleaned)
    }

    // Log speichern
    const r = db.prepare(`INSERT INTO vat_check_log
      (vat_id, country_code, company_name, address, is_valid, status_code, message, source, raw_response)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(
      cleaned, country,
      result.name ?? null,
      result.address ?? null,
      result.is_valid ? 1 : 0,
      (result as Record<string,unknown>).status_code as string ?? null,
      result.message,
      result.source,
      result.raw ?? null,
    )

    // Audit-Log Eintrag
    db.prepare(`INSERT INTO audit_log (action, entity_type, entity_name, details) VALUES(?,?,?,?)`).run(
      result.is_valid ? 'vat_valid' : 'vat_invalid',
      'vat',
      cleaned,
      JSON.stringify({ message: result.message, source: result.source })
    )

    return {
      ...result,
      log_id: r.lastInsertRowid,
      vat_id: cleaned,
    }
  })

  // ── Prüf-Log abrufen ────────────────────────────────────────
  ipcMain.handle('vat:getLog', (_e, limit = 100) => {
    return getDb().prepare(`
      SELECT * FROM vat_check_log ORDER BY checked_at DESC LIMIT ?
    `).all(limit)
  })

  // ── Alle bekannten USt-IDs erneut prüfen ───────────────────
  ipcMain.handle('vat:recheck', async (_e, vatIds: string[]) => {
    const results = []
    for (const id of vatIds) {
      try {
        const r = await checkViaVIES(id)
        const db = getDb()
        db.prepare(`INSERT INTO vat_check_log
          (vat_id, country_code, company_name, address, is_valid, message, source, raw_response)
          VALUES(?,?,?,?,?,?,?,?)`).run(
          id, id.slice(0,2), r.name, r.address, r.is_valid?1:0, r.message, r.source, r.raw
        )
        results.push({ vat_id: id, ...r })
      } catch (e) {
        results.push({ vat_id: id, error: (e as Error).message })
      }
    }
    return results
  })

  // ── Unique USt-IDs (aus Lieferanten) ────────────────────────
  ipcMain.handle('vat:getKnownIds', () => {
    return getDb().prepare(`
      SELECT DISTINCT tax_id, name FROM suppliers WHERE tax_id IS NOT NULL AND tax_id != ''
    `).all()
  })
}
