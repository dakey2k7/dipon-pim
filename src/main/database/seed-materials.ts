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
  // Always run - INSERT OR IGNORE handles duplicates per material

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

// ── Cleanup + neue Rohstoffe ─────────────────────────────────
export function seedCleanupAndNewMaterials(db: Database): void {

  // 1. Sonstige Stoffe IMMER löschen — nicht nur wenn code passt
  // Sonstige Rohstoffe IMMER löschen — alle Varianten des Namens
  const deletePatterns = [
    'Cetyl Alkohol','Destilliertes Wasser','Glycerin','Shea Butter','Xanthan'
  ]
  for (const pattern of deletePatterns) {
    try {
      const mats = db.prepare("SELECT id FROM materials WHERE name LIKE ?").all(`%${pattern}%`) as any[]
      for (const mat of mats) {
        db.prepare("DELETE FROM supplier_prices WHERE material_id=?").run(mat.id)
        db.prepare("DELETE FROM materials WHERE id=?").run(mat.id)
      }
    } catch (e) { console.log('Delete error:', e) }
  }

  // 2. Lieferanten anlegen / aktualisieren
  const ensureSupplier = (data: Record<string,unknown>): number => {
    const code = String(data.code)
    const existing = db.prepare("SELECT id FROM suppliers WHERE code=?").get(code) as any
    if (existing) {
      try {
        db.prepare(`UPDATE suppliers SET name=?,street=?,postal_code=?,city=?,country=?,
          phone=?,fax=?,email=?,iban=?,swift=?,bank_name=?,customer_number=?,tax_id=?,
          payment_terms=? WHERE code=?`).run(
          data.name,data.street,data.postal_code,data.city,data.country,
          data.phone??null,data.fax??null,data.email??null,
          data.iban??null,data.swift??null,data.bank_name??null,
          data.customer_number??null,data.tax_id??null,
          data.payment_terms??30, code
        )
      } catch {}
      return Number(existing.id)
    }
    const r = db.prepare(`INSERT INTO suppliers
      (name,code,street,postal_code,city,country,phone,fax,email,
       iban,swift,bank_name,customer_number,tax_id,payment_terms,currency,is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'EUR',1)`).run(
      data.name,code,data.street??null,data.postal_code??null,data.city??null,
      data.country??'DE',data.phone??null,data.fax??null,data.email??null,
      data.iban??null,data.swift??null,data.bank_name??null,
      data.customer_number??null,data.tax_id??null,data.payment_terms??30
    )
    return Number(r.lastInsertRowid)
  }

  const itochuId = ensureSupplier({
    name:'ITOCHU Deutschland GmbH', code:'ITOCHU',
    street:'Fritz-Vomfelde-Str. 14', postal_code:'40547', city:'Düsseldorf', country:'DE',
    phone:'+49 (211) 52900', fax:'+49 (211) 596428',
  })

  const borghiId = ensureSupplier({
    name:'Borghi SPA', code:'BORGHI',
    street:'Via Leopardi 39', postal_code:'22070', city:'Grandate', country:'IT',
    phone:'+39 031 56 45 50', fax:'+39 031 56 45 60',
    iban:'IT02M0306910910000024005166', swift:'BCITITMME72',
    bank_name:'Banca', customer_number:'005310'
  })

  const bohrmannId = ensureSupplier({
    name:'Bohrmann GmbH', code:'BOHRMANN',
    street:'Raiffeisenstr. 45', postal_code:'55270', city:'Klein-Wintersheim', country:'DE',
    email:'bestellung@boe-bohrmann.de',
    iban:'DE06510500150159059500', swift:'NASSDE55XXX',
    bank_name:'Nassauische Sparkasse',
    tax_id:'DE113832109', payment_terms:30
  })

  // 3. Kategorien sicherstellen
  const ensureCategory = (name: string): number => {
    const ex = db.prepare("SELECT id FROM categories WHERE name=?").get(name) as any
    if (ex) return Number(ex.id)
    const code = name.replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,10)
    db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES (?,?)").run(name, code)
    const row = db.prepare("SELECT id FROM categories WHERE name=?").get(name) as any
    return Number(row?.id ?? 0)
  }

  const catAdditiv = ensureCategory('EP-Additiv')
  const catAmine   = ensureCategory('EP-Amine')

  // 4. Neue Rohstoffe
  const materials = [
    { name:'Kumanox 3111F', code:'KUMANOX', catId:catAdditiv,
      container:'IBC', size:'1000 kg', price:4.30, valid:'2024-10-09', supId:itochuId },
    { name:'1,3-BAC',        code:'BAC-13',  catId:catAmine,
      container:'Stahlfass', size:'190 kg', price:6.80, valid:'2023-09-07', supId:itochuId },
    { name:'ZT-143',         code:'ZT143',   catId:catAmine,
      container:'IBC', size:'1000 kg', price:3.80, valid:null, supId:borghiId },
    { name:'ZD-123',         code:'ZD123',   catId:catAmine,
      container:'IBC', size:'1000 kg', price:2.72, valid:null, supId:borghiId },
    { name:'Isophorondiamin (IPD)', code:'IPD', catId:catAmine,
      container:'IBC', size:'900 kg', price:4.29, valid:null, supId:bohrmannId },
  ]

  for (const m of materials) {
    // Material anlegen
    db.prepare(`INSERT OR IGNORE INTO materials (name,code,category_id,unit,is_active)
      VALUES (?,?,?,'kg',1)`).run(m.name, m.code, m.catId)

    // Kategorie nachträglich setzen (falls schon vorhanden aber ohne Kategorie)
    db.prepare(`UPDATE materials SET category_id=? WHERE code=?`)
      .run(m.catId, m.code)

    const mat = db.prepare("SELECT id FROM materials WHERE code=?").get(m.code) as any
    if (!mat) { console.log('Material nicht gefunden:', m.code); continue }
    const matId = Number(mat.id)

    // Container-Felder setzen
    try { db.prepare("UPDATE materials SET container_type=?,container_size=? WHERE id=?")
            .run(m.container, m.size, matId) } catch {}
    try { db.prepare("UPDATE materials SET price_per_kg_calc=? WHERE id=?")
            .run(m.price, matId) } catch {}

    // Preis anlegen (Update wenn schon vorhanden)
    const existingPrice = db.prepare(
      "SELECT id FROM supplier_prices WHERE material_id=? AND supplier_id=?"
    ).get(matId, m.supId) as any

    if (existingPrice) {
      db.prepare("UPDATE supplier_prices SET price_per_unit=?,valid_from=? WHERE id=?")
        .run(m.price, m.valid, Number(existingPrice.id))
    } else {
      db.prepare(`INSERT INTO supplier_prices
        (material_id,supplier_id,price_per_unit,unit,currency,is_preferred,valid_from)
        VALUES (?,?,?,'kg','EUR',1,?)`).run(matId, m.supId, m.price, m.valid)
    }
  }

  console.log('✅ Seed: 5 EP-Rohstoffe + 3 Lieferanten')
}

// ── BYK + LuminaCast Seed ────────────────────────────────────
export function seedLuminaCast(db: Database): void {

  // 1. BYK-Chemie GmbH anlegen
  const bykExists = db.prepare("SELECT id FROM suppliers WHERE code='BYK'").get() as any
  if (!bykExists) {
    db.prepare(`INSERT INTO suppliers
      (name,code,street,postal_code,city,country,payment_terms,currency,is_active)
      VALUES (?,?,?,?,?,?,30,'EUR',1)`
    ).run('BYK-Chemie GmbH','BYK','Abelstr. 45','46843','Wesel','DE')
  }
  const bykId = (db.prepare("SELECT id FROM suppliers WHERE code='BYK'").get() as any)?.id

  // Kategorie Entlüfter
  db.prepare("INSERT OR IGNORE INTO categories (name,code) VALUES ('Entlüfter','ENTLUEFTER')").run()
  const entluefterId = (db.prepare("SELECT id FROM categories WHERE name='Entlüfter'").get() as any)?.id

  // 2. BYK-1748 anlegen
  db.prepare("INSERT OR IGNORE INTO materials (name,code,category_id,unit,is_active) VALUES (?,?,?,'kg',1)")
    .run('BYK-1748','BYK1748',entluefterId||null)
  const byk1748 = db.prepare("SELECT id FROM materials WHERE code='BYK1748'").get() as any
  if (byk1748) {
    try { db.prepare("UPDATE materials SET container_type=?,container_size=?,price_per_kg_calc=?,product_type=? WHERE id=?")
      .run('Kanne','25 kg',11.89,'Entlüfter',byk1748.id) } catch {}
    db.prepare("INSERT OR IGNORE INTO supplier_prices (material_id,supplier_id,price_per_unit,unit,currency,is_preferred,valid_from) VALUES (?,?,?,'kg','EUR',1,?)")
      .run(byk1748.id, bykId, 11.89, '2025-07-10')
  }

  // 3. Produktgruppe "LuminaCast" anlegen
  db.prepare("INSERT OR IGNORE INTO product_groups (name,code,color) VALUES (?,?,?)")
    .run('LuminaCast','LUMINACAST','#8b5cf6')
  const groupId = (db.prepare("SELECT id FROM product_groups WHERE code='LUMINACAST'").get() as any)?.id

  // 4. LuminaCast A anlegen (Charge 1182 kg)
  db.prepare("INSERT OR IGNORE INTO products (name,code,product_group_id,batch_size,batch_unit,overhead_factor,is_active) VALUES (?,?,?,?,?,?,1)")
    .run('LuminaCast A','LC-A',groupId,1182,'kg',1.0)
  const lcA = db.prepare("SELECT id FROM products WHERE code='LC-A'").get() as any

  if (lcA) {
    // Nur einfügen wenn noch keine Materialien vorhanden
    const existingA = (db.prepare("SELECT COUNT(*) as c FROM product_materials WHERE product_id=?").get(lcA.id) as any)?.c || 0
    if (existingA === 0) {
    const addMat = db.prepare(`INSERT OR IGNORE INTO product_materials
      (product_id,material_id,quantity,unit,waste_factor,sort_order)
      VALUES (?,?,?,?,0,?)`)

    const getMat = (code: string) =>
      (db.prepare("SELECT id FROM materials WHERE code=?").get(code) as any)?.id

    const recipeA = [
      { code:'EPI-827', qty:670, pos:1 },
      { code:'EPI-862', qty:330, pos:2 },
      { code:'HELOX-Z8',qty:150, pos:3 },
      { code:'SONGUV1', qty:10,  pos:4 },
      { code:'SONG292', qty:16,  pos:5 },
      { code:'BYK1748', qty:3,   pos:6 },
      { code:'BENZALC', qty:3,   pos:7 },
    ]
    for (const r of recipeA) {
      const matId = getMat(r.code)
      if (matId) addMat.run(lcA.id, matId, r.qty, 'kg', r.pos)
    }
    } // end if existingA===0
  }

  // 5. LuminaCast 2 CoasterCast B anlegen (Charge 100 kg = prozentual)
  db.prepare("INSERT OR IGNORE INTO products (name,code,product_group_id,batch_size,batch_unit,overhead_factor,is_active) VALUES (?,?,?,?,?,?,1)")
    .run('LuminaCast 2 CoasterCast B','LC2-B',groupId,100,'kg',1.0)
  const lcB = db.prepare("SELECT id FROM products WHERE code='LC2-B'").get() as any

  if (lcB) {
    const existingB = (db.prepare("SELECT COUNT(*) as c FROM product_materials WHERE product_id=?").get(lcB.id) as any)?.c || 0
    if (existingB === 0) {
    const addMat = db.prepare(`INSERT OR IGNORE INTO product_materials
      (product_id,material_id,quantity,unit,waste_factor,sort_order)
      VALUES (?,?,?,?,0,?)`)
    const getMat = (code: string) =>
      (db.prepare("SELECT id FROM materials WHERE code=?").get(code) as any)?.id

    const recipeB = [
      { code:'BENZALC',   qty:23,  pos:1 },
      { code:'IPD',       qty:30,  pos:2 },
      { code:'EPI-827',   qty:7,   pos:3 },
      { code:'ZT143',     qty:30,  pos:4 },
      { code:'TEA99-BRE', qty:10,  pos:5 },
    ]
    for (const r of recipeB) {
      const matId = getMat(r.code)
      if (matId) addMat.run(lcB.id, matId, r.qty, 'kg', r.pos)
    }
    } // end if existingB===0
  }

  // 6. LuminaCast 2 als 2K-Produkt anlegen
  const lcAId = (db.prepare("SELECT id FROM products WHERE code='LC-A'").get() as any)?.id
  const lcBId = (db.prepare("SELECT id FROM products WHERE code='LC2-B'").get() as any)?.id
  if (lcAId && lcBId) {
    db.prepare(`INSERT OR IGNORE INTO product_2k
      (name,code,product_group_id,component_a_id,component_a_name,
       component_b_id,component_b_name,mix_ratio_a,mix_ratio_b,mix_ratio_display,is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)`).run(
      'LuminaCast 2','LC2',groupId,
      lcAId,'LuminaCast A',
      lcBId,'LuminaCast 2 CoasterCast B',
      100,47,'100:47'
    )
  }

  console.log('✅ Seed: BYK-1748, LuminaCast A, LuminaCast 2 CoasterCast B, LuminaCast 2 (2K)')
}
