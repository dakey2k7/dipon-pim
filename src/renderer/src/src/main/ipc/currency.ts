import { ipcMain, net } from 'electron'
import { getDb }        from '../database/setup'

// Frankfurter.app – kostenlos, kein API-Key, ECB-Daten
const BASE_URL = 'https://api.frankfurter.app'

const SUPPORTED_CURRENCIES = [
  {code:'EUR',name:'Euro',                symbol:'€',  flag:'🇪🇺',country:'Europäische Union'},
  {code:'USD',name:'US-Dollar',           symbol:'$',  flag:'🇺🇸',country:'USA'},
  {code:'GBP',name:'Brit. Pfund',         symbol:'£',  flag:'🇬🇧',country:'Großbritannien'},
  {code:'CHF',name:'Schweizer Franken',   symbol:'Fr.',flag:'🇨🇭',country:'Schweiz'},
  {code:'PLN',name:'Polnischer Złoty',    symbol:'zł', flag:'🇵🇱',country:'Polen'},
  {code:'SEK',name:'Schwedische Krone',   symbol:'kr', flag:'🇸🇪',country:'Schweden'},
  {code:'NOK',name:'Norwegische Krone',   symbol:'kr', flag:'🇳🇴',country:'Norwegen'},
  {code:'DKK',name:'Dänische Krone',      symbol:'kr', flag:'🇩🇰',country:'Dänemark'},
  {code:'CZK',name:'Tschech. Krone',      symbol:'Kč', flag:'🇨🇿',country:'Tschechien'},
  {code:'HUF',name:'Ungar. Forint',       symbol:'Ft', flag:'🇭🇺',country:'Ungarn'},
  {code:'RON',name:'Rumän. Leu',          symbol:'lei',flag:'🇷🇴',country:'Rumänien'},
  {code:'BGN',name:'Bulgar. Lew',         symbol:'лв', flag:'🇧🇬',country:'Bulgarien'},
  {code:'JPY',name:'Japanischer Yen',     symbol:'¥',  flag:'🇯🇵',country:'Japan'},
  {code:'CNY',name:'Chinesischer Yuan',   symbol:'¥',  flag:'🇨🇳',country:'China'},
  {code:'CAD',name:'Kanadischer Dollar',  symbol:'C$', flag:'🇨🇦',country:'Kanada'},
  {code:'AUD',name:'Australischer Dollar',symbol:'A$', flag:'🇦🇺',country:'Australien'},
  {code:'HKD',name:'Hongkong-Dollar',     symbol:'HK$',flag:'🇭🇰',country:'Hongkong'},
  {code:'SGD',name:'Singapur-Dollar',     symbol:'S$', flag:'🇸🇬',country:'Singapur'},
  {code:'INR',name:'Indische Rupie',      symbol:'₹',  flag:'🇮🇳',country:'Indien'},
  {code:'KRW',name:'Südkorean. Won',      symbol:'₩',  flag:'🇰🇷',country:'Südkorea'},
  {code:'TRY',name:'Türkische Lira',      symbol:'₺',  flag:'🇹🇷',country:'Türkei'},
  {code:'ZAR',name:'Südafrikan. Rand',    symbol:'R',  flag:'🇿🇦',country:'Südafrika'},
  {code:'BRL',name:'Brazilian. Real',     symbol:'R$', flag:'🇧🇷',country:'Brasilien'},
  {code:'MXN',name:'Mexikanischer Peso',  symbol:'$',  flag:'🇲🇽',country:'Mexiko'},
  {code:'AED',name:'Dirham (VAE)',         symbol:'د.إ',flag:'🇦🇪',country:'Ver. Arab. Emirate'},
  {code:'SAR',name:'Saudi Riyal',          symbol:'﷼', flag:'🇸🇦',country:'Saudi-Arabien'},
  {code:'TWD',name:'Taiwan-Dollar',        symbol:'NT$',flag:'🇹🇼',country:'Taiwan'},
  {code:'THB',name:'Thail. Baht',          symbol:'฿', flag:'🇹🇭',country:'Thailand'},
  {code:'MYR',name:'Malays. Ringgit',      symbol:'RM', flag:'🇲🇾',country:'Malaysia'},
  {code:'VND',name:'Vietnames. Dong',      symbol:'₫', flag:'🇻🇳',country:'Vietnam'},
]

async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = net.request(url)
    let body = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => body += chunk.toString())
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error('JSON parse error')) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

export function registerCurrencyHandlers(): void {

  ipcMain.handle('currency:getSupportedList', () => SUPPORTED_CURRENCIES)

  // Aktuelle Kurse laden und cachen
  ipcMain.handle('currency:fetchRates', async (_e, base = 'EUR') => {
    const db = getDb()
    try {
      const data = await fetchJson(`${BASE_URL}/latest?from=${base}`) as {
        rates: Record<string,number>; date: string
      }
      const now = new Date().toISOString()

      // In DB cachen
      const upsert = db.prepare(`INSERT INTO currency_rates (base, target, rate, fetched_at)
        VALUES(?,?,?,?) ON CONFLICT(base,target) DO UPDATE SET rate=excluded.rate, fetched_at=excluded.fetched_at`)

      for (const [target, rate] of Object.entries(data.rates)) {
        upsert.run(base, target, rate, now)
      }

      return {
        base,
        rates: data.rates,
        fetched_at: now,
        source_date: data.date,
      }
    } catch (err) {
      // Fallback: gecachte Kurse aus DB
      const cached = db.prepare(
        'SELECT * FROM currency_rates WHERE base=? ORDER BY target ASC'
      ).all(base) as Array<{ target:string; rate:number; fetched_at:string }>

      if (!cached.length) throw new Error('Keine Kurse verfügbar (offline?)')

      const rates: Record<string,number> = {}
      for (const r of cached) rates[r.target] = r.rate

      return { base, rates, fetched_at: cached[0]?.fetched_at, cached: true }
    }
  })

  // Historische Kurse für Chart
  ipcMain.handle('currency:fetchHistory', async (_e, base: string, target: string, days: number) => {
    const db = getDb()

    const endDate   = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    const start = startDate.toISOString().slice(0,10)
    const end   = endDate.toISOString().slice(0,10)

    try {
      const data = await fetchJson(
        `${BASE_URL}/${start}..${end}?from=${base}&to=${target}`
      ) as { rates: Record<string, Record<string,number>> }

      const rows = Object.entries(data.rates).map(([date, r]) => ({
        date,
        rate: r[target] ?? null,
      })).filter(r => r.rate != null)

      // In Historie cachen
      const ins = db.prepare(`INSERT OR IGNORE INTO currency_history (base,target,rate,date)
        VALUES(?,?,?,?)`)
      for (const row of rows) ins.run(base, target, row.rate, row.date)

      return { base, target, history: rows, start, end }
    } catch {
      // Aus DB-Cache
      const cached = db.prepare(`SELECT date, rate FROM currency_history
        WHERE base=? AND target=? AND date BETWEEN ? AND ?
        ORDER BY date ASC`).all(base, target, start, end)
      return { base, target, history: cached, start, end, cached: true }
    }
  })

  // Konvertieren
  ipcMain.handle('currency:convert', (_e, amount: number, from: string, to: string) => {
    const db = getDb()
    if (from === to) return { result: amount, rate: 1 }

    const row = db.prepare(
      'SELECT rate FROM currency_rates WHERE base=? AND target=?'
    ).get(from, to) as { rate: number }|undefined

    if (!row) throw new Error(`Kurs ${from}→${to} nicht gecacht. Bitte zuerst aktualisieren.`)
    return { result: amount * row.rate, rate: row.rate, from, to }
  })

  ipcMain.handle('currency:getCached', (_e, base = 'EUR') => {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM currency_rates WHERE base=? ORDER BY target').all(base) as
      Array<{ target:string; rate:number; fetched_at:string }>
    return { base, rates: rows }
  })
}
