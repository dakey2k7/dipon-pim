/**
 * DIPON Rohstoff-Seed – ultra-robust
 * Nur garantierte Basis-Spalten, alles andere per dynamischem UPDATE
 */
import type { Database } from 'better-sqlite3'

const MATERIALS = [
  {name:'Triethanolamin rein (99%)',     code:'TEA99-BRE', cas:'102-71-6',   unit:'kg', supplier:'Brenntag',          density:'1,1230 g/ml', container_type:'IBC Container', container_size:'1000 L',      base_price:163.50, base_qty:100, base_unit:'kg', energy:8.95, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:1.724,  type:'Beschleuniger EP',           deposit:192,  deposit_note:'pro IBC', wgk:'WGK1', valid:'2026-04-14', sub_de:'2,2\',2\'\'-Nitrilotriethanol'},
  {name:'Triethanolamin rein (99%)',     code:'TEA99-REI', cas:'102-71-6',   unit:'kg', supplier:'Reininghaus Chemie', density:'1,1230 g/ml', container_type:'IBC Container', container_size:'1000 L',      base_price:192.00, base_qty:100, base_unit:'kg', energy:3.20, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:1.952,  type:'Beschleuniger EP',           deposit:192,  deposit_note:'pro IBC', wgk:'WGK1', valid:'2026-04-14', sub_de:'2,2\',2\'\'-Nitrilotriethanol'},
  {name:'SONGSORB CS 292 LQ',           code:'SONG292',   cas:null,         unit:'kg', supplier:'Biesterfeld Chemie', density:null,           container_type:'Stahlfass',     container_size:'200 kg',      base_price:12.25,  base_qty:1,   base_unit:'kg', energy:0,    energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:12.25,  type:'UV-Absorber (UVA)',          deposit:0,    deposit_note:null,      wgk:'-',    valid:'2026-04-14', sub_de:null},
  {name:'SONGSORB CS UV1 LQ',           code:'SONGUV1',   cas:null,         unit:'kg', supplier:'Biesterfeld Chemie', density:null,           container_type:'Kanne',         container_size:'25 kg',       base_price:18.27,  base_qty:1,   base_unit:'kg', energy:0,    energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:18.27,  type:'Lichtstabilisator (n-HALS)', deposit:0,    deposit_note:null,      wgk:'-',    valid:'2026-04-14', sub_de:null},
  {name:'Xylol',                        code:'XYLOL',     cas:null,         unit:'kg', supplier:'Brenntag',          density:'0,87 g/cm³',  container_type:'Stahlfass (1A1)',container_size:'216,5 L à 175 kg',base_price:0, base_qty:1,   base_unit:'kg', energy:6.90, energy_unit:'100 kg', adr:14.50, adr_unit:'100 kg', price_kg:0.214,  type:'Lösungsmittel',              deposit:25,   deposit_note:'pro Fass',wgk:'WGK3', valid:'2026-04-14', sub_de:'Dimethylbenzol'},
  {name:'Methylethylketon',             code:'MEK',       cas:'78-93-3',    unit:'kg', supplier:'Brenntag',          density:'0,804-0,807 g/cm³',container_type:'Stahlfass (1A1)',container_size:'216,5 l à 155 kg',base_price:247.50,base_qty:100,base_unit:'kg',energy:6.90,energy_unit:'100 kg',adr:14.50,adr_unit:'100 kg',price_kg:2.689,type:'Lösungsmittel',deposit:25,deposit_note:'pro Fass',wgk:'WGK1',valid:'2026-03-05',sub_de:'Butanon'},
  {name:'Novares L100',                 code:'NOV-L100',  cas:null,         unit:'kg', supplier:'Brenntag',          density:null,           container_type:'IBC Container', container_size:'1000 L',      base_price:610.00, base_qty:100, base_unit:'kg', energy:8.95, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:6.190,  type:'Lösungsmittel EP',           deposit:192,  deposit_note:'pro IBC', wgk:'-',    valid:'2026-04-14', sub_de:null},
  {name:'Ruetasolv DI',                 code:'RUET-DI',   cas:null,         unit:'kg', supplier:'Brenntag',          density:null,           container_type:'IBC Container', container_size:'950 kg',      base_price:765.00, base_qty:100, base_unit:'kg', energy:8.95, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:7.740,  type:'Lösungsmittel EP',           deposit:192,  deposit_note:'pro IBC', wgk:'-',    valid:'2026-04-14', sub_de:null},
  {name:'Dipropylenglykol',             code:'DPG',       cas:'25265-71-8', unit:'kg', supplier:'Brenntag',          density:'1,0210 g/ml',  container_type:'IBC Container', container_size:'1000 L',      base_price:217.00, base_qty:100, base_unit:'kg', energy:8.95, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:2.260,  type:'Lösungsmittel EP',           deposit:192,  deposit_note:'pro IBC', wgk:'WGK1', valid:'2026-04-01', sub_de:'Dipropylenglycol'},
  {name:'Benzylalkohol',                code:'BENZALC',   cas:'100-51-6',   unit:'kg', supplier:'Brenntag',          density:'1,0450 g/ml',  container_type:'IBC Container', container_size:'1000 L',      base_price:224.30, base_qty:100, base_unit:'kg', energy:8.95, energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:2.332,  type:'Lösungsmittel EP',           deposit:192,  deposit_note:'pro IBC', wgk:'WGK2', valid:'2026-03-20', sub_de:'Phenylmethanol'},
  {name:'Isopropanol',                  code:'IPA',       cas:'67-63-0',    unit:'kg', supplier:'Brenntag',          density:null,           container_type:'Stahlfass (1A1)',container_size:'216,5 l à 155 kg',base_price:0,base_qty:1,base_unit:'kg',energy:6.90,energy_unit:'100 kg',adr:14.50,adr_unit:'100 kg',price_kg:0.214,type:'Lösungsmittel',deposit:25,deposit_note:'pro Fass',wgk:'WGK1',valid:'2026-02-02',sub_de:'2-Propanol'},
  {name:'Epikote 827',                  code:'EPI-827',   cas:'25068-38-6', unit:'kg', supplier:'Westlake Epoxy BV', density:null,           container_type:'IBC',           container_size:'1000 L',      base_price:2670.00,base_qty:1000,base_unit:'kg',energy:0,   energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:2.670,  type:'Epoxidharz (A) – Bisphenol A',deposit:0,   deposit_note:null,      wgk:'WGK2', valid:'2026-04-01', sub_de:'Bisphenol-A-Diglycidylether'},
  {name:'Epikote 862',                  code:'EPI-862',   cas:'9003-36-5',  unit:'kg', supplier:'Westlake Epoxy BV', density:null,           container_type:'IBC',           container_size:'1000 L',      base_price:3830.00,base_qty:1000,base_unit:'kg',energy:0,   energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:3.830,  type:'Epoxidharz (A) – Bisphenol F',deposit:0,   deposit_note:null,      wgk:'WGK2', valid:'2026-04-01', sub_de:'Bisphenol-F-Diglycidylether'},
  {name:'Heloxy Z8 Modifier',           code:'HELOX-Z8',  cas:'68609-97-2', unit:'kg', supplier:'Westlake Epoxy BV', density:null,           container_type:'IBC',           container_size:'1000 L',      base_price:4130.00,base_qty:1000,base_unit:'kg',energy:0,   energy_unit:'100 kg', adr:0,     adr_unit:'100 kg', price_kg:4.130,  type:'Reaktivverdünner C12-C14',   deposit:0,   deposit_note:null,      wgk:'-',    valid:'2026-04-01', sub_de:'C12-C14-Glycidylether'},
]

export function seedMaterials(db: Database): number {
  const existing = db.prepare("SELECT id FROM materials WHERE code='EPI-827'").get()
  if (existing) return 0

  // Kategorie
  db.prepare(`INSERT OR IGNORE INTO categories (name,code) VALUES ('Rohstoffe','ROHST')`).run()
  const catId = (db.prepare(`SELECT id FROM categories WHERE code='ROHST'`).get() as any)?.id ?? null

  // Lieferanten
  const getSupplier = (name: string) => {
    const ex = db.prepare('SELECT id FROM suppliers WHERE name=?').get(name) as any
    if (ex) return ex.id
    return (db.prepare(`INSERT INTO suppliers (name,code,is_active) VALUES (?,?,1)`)
      .run(name, name.replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,10))).lastInsertRowid
  }

  let count = 0
  for (const m of MATERIALS) {
    try {
      // Step 1: Minimal INSERT
      db.prepare(`INSERT OR IGNORE INTO materials (name,code,category_id,unit,cas_number,is_active) VALUES (?,?,?,?,?,1)`)
        .run(m.name, m.code, catId, m.unit, m.cas ?? null)

      const row = db.prepare('SELECT id FROM materials WHERE code=?').get(m.code) as any
      if (!row) continue
      const id = row.id
      const sid = getSupplier(m.supplier)

      // Step 2: UPDATE neue Felder einzeln (jede Spalte separat → kein Fehler wenn fehlt)
      const trySet = (col: string, val: unknown) => {
        try { db.prepare(`UPDATE materials SET ${col}=? WHERE id=?`).run(val, id) } catch {}
      }

      trySet('substance_name_de',     m.sub_de ?? null)
      trySet('density',               m.density ?? null)
      trySet('container_type',        m.container_type ?? null)
      trySet('container_size',        m.container_size ?? null)
      trySet('base_price',            m.base_price)
      trySet('base_quantity',         m.base_qty)
      trySet('base_unit',             m.base_unit)
      trySet('surcharge_energy',      m.energy)
      trySet('surcharge_energy_unit', m.energy_unit)
      trySet('surcharge_adr',         m.adr)
      trySet('surcharge_adr_unit',    m.adr_unit)
      trySet('price_per_kg_calc',     m.price_kg)
      trySet('product_type',          m.type ?? null)
      trySet('supplier_id',           sid)
      trySet('deposit_amount',        m.deposit)
      trySet('deposit_note',          m.deposit_note ?? null)
      trySet('wgk',                   m.wgk)
      trySet('valid_from',            m.valid ?? null)
      trySet('ghs_symbols',           '[]')

      count++
    } catch (e) {
      console.error(`Seed ${m.code}:`, (e as Error).message)
    }
  }
  console.log(`✅ Seed: ${count}/14 Rohstoffe`)
  return count
}
