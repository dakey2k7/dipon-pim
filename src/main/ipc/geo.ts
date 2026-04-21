/**
 * geo.ts — IPC-Handler für Länder, MwSt, Versand, Payment
 */
import { ipcMain } from 'electron'
import { getDb }   from '../database/setup'

export function registerGeoHandlers() {
  const db = getDb()

  // ── Länder ────────────────────────────────────────────────
  ipcMain.handle('geo:countries:list', (_e, filter?: { region?: string; eu_only?: boolean }) => {
    let sql = `SELECT c.*,
        (SELECT vr.vat_standard FROM vat_rates vr
         WHERE vr.country_id=c.id AND vr.valid_to IS NULL
         ORDER BY vr.valid_from DESC LIMIT 1) AS vat_current
      FROM countries c WHERE 1=1`
    const args: unknown[] = []
    if (filter?.eu_only) { sql += ` AND c.is_eu=1` }
    if (filter?.region)  { sql += ` AND c.region=?`; args.push(filter.region) }
    sql += ` ORDER BY c.sort_order, c.name_de`
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('geo:countries:update', (_e, iso2: string, d: any) => {
    db.prepare(`UPDATE countries SET name_de=?,name_en=?,region=?,is_eu=?,
      eu_since=?,vat_required=? WHERE iso2=?`)
      .run(d.name_de, d.name_en, d.region, d.is_eu?1:0, d.eu_since||null, d.vat_required?1:0, iso2)
    return db.prepare(`SELECT * FROM countries WHERE iso2=?`).get(iso2)
  })

  // ── MwSt-Historien ────────────────────────────────────────
  ipcMain.handle('geo:vat:history', (_e, country_iso2: string) =>
    db.prepare(`
      SELECT vr.*, c.name_de, c.flag_emoji
      FROM vat_rates vr
      JOIN countries c ON c.id=vr.country_id
      WHERE c.iso2=? ORDER BY vr.valid_from DESC
    `).all(country_iso2)
  )

  ipcMain.handle('geo:vat:all-current', () =>
    db.prepare(`
      SELECT c.iso2, c.name_de, c.flag_emoji, c.region, c.eu_since,
        vr.vat_standard, vr.vat_reduced_1, vr.vat_reduced_2, vr.valid_from
      FROM countries c
      JOIN vat_rates vr ON vr.id = (
        SELECT id FROM vat_rates WHERE country_id=c.id
        AND (valid_to IS NULL OR valid_to >= date('now'))
        ORDER BY valid_from DESC LIMIT 1
      )
      WHERE c.is_eu=1 OR c.is_eea=1 OR c.iso2 IN ('CH','GB')
      ORDER BY c.sort_order, c.name_de
    `).all()
  )

  ipcMain.handle('geo:vat:save', (_e, d: {
    country_iso2: string; vat_standard: number; vat_reduced_1?: number
    vat_reduced_2?: number; valid_from: string; notes?: string
  }) => {
    const country = db.prepare(`SELECT id FROM countries WHERE iso2=?`).get(d.country_iso2) as any
    if (!country) throw new Error('Land nicht gefunden')
    // Vorherigen Eintrag schließen
    db.prepare(`UPDATE vat_rates SET valid_to=? WHERE country_id=? AND valid_to IS NULL`)
      .run(d.valid_from, country.id)
    // Neuen eintragen
    const r = db.prepare(`INSERT INTO vat_rates
      (country_id,vat_standard,vat_reduced_1,vat_reduced_2,valid_from,source,notes)
      VALUES (?,?,?,?,?,?,?)`).run(
      country.id, d.vat_standard, d.vat_reduced_1||null, d.vat_reduced_2||null,
      d.valid_from, 'manual', d.notes||null
    )
    return db.prepare(`SELECT * FROM vat_rates WHERE id=?`).get(r.lastInsertRowid)
  })

  // ── Shipping Carrier ──────────────────────────────────────
  ipcMain.handle('shipping:carriers:list', () =>
    db.prepare(`SELECT sc.*,
      (SELECT COUNT(*) FROM shipping_zones sz WHERE sz.carrier_id=sc.id) AS zone_count
      FROM shipping_carriers sc WHERE sc.is_active=1 ORDER BY sc.sort_order, sc.name`).all()
  )
  ipcMain.handle('shipping:carriers:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE shipping_carriers SET name=?,code=?,color=?,is_active=? WHERE id=?`)
        .run(d.name, String(d.code||'').toUpperCase(), d.color||'#3b82f6', d.is_active??1, d.id)
    } else {
      const r = db.prepare(`INSERT INTO shipping_carriers (name,code,color) VALUES (?,?,?)`)
        .run(d.name, String(d.code||d.name).toUpperCase().replace(/\s/g,'').slice(0,12), d.color||'#3b82f6')
      return db.prepare(`SELECT * FROM shipping_carriers WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM shipping_carriers WHERE id=?`).get(d.id)
  })

  // ── Shipping Zones ────────────────────────────────────────
  ipcMain.handle('shipping:zones:list', (_e, carrier_id: number) =>
    db.prepare(`SELECT sz.*,
      (SELECT COUNT(*) FROM shipping_zone_countries szc WHERE szc.zone_id=sz.id) AS country_count,
      (SELECT COUNT(*) FROM shipping_tiers st WHERE st.zone_id=sz.id) AS tier_count
      FROM shipping_zones sz WHERE sz.carrier_id=? ORDER BY sz.sort_order, sz.name`).all(carrier_id)
  )
  ipcMain.handle('shipping:zones:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE shipping_zones SET code=?,name=?,description=? WHERE id=?`)
        .run(d.code, d.name, d.description||null, d.id)
    } else {
      const maxOrd = (db.prepare(`SELECT MAX(sort_order) AS m FROM shipping_zones WHERE carrier_id=?`).get(d.carrier_id) as any)?.m ?? 0
      const r = db.prepare(`INSERT INTO shipping_zones (carrier_id,code,name,description,sort_order) VALUES (?,?,?,?,?)`)
        .run(d.carrier_id, d.code, d.name, d.description||null, maxOrd+10)
      return db.prepare(`SELECT * FROM shipping_zones WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM shipping_zones WHERE id=?`).get(d.id)
  })
  ipcMain.handle('shipping:zones:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM shipping_zones WHERE id=?`).run(id)
    return { ok: true }
  })

  // Zone-Länder verwalten
  ipcMain.handle('shipping:zones:countries:list', (_e, zone_id: number) =>
    db.prepare(`SELECT c.* FROM shipping_zone_countries szc
      JOIN countries c ON c.id=szc.country_id
      WHERE szc.zone_id=? ORDER BY c.sort_order, c.name_de`).all(zone_id)
  )
  ipcMain.handle('shipping:zones:countries:set', (_e, zone_id: number, country_iso2s: string[]) => {
    const del = db.prepare(`DELETE FROM shipping_zone_countries WHERE zone_id=?`)
    const ins = db.prepare(`INSERT OR IGNORE INTO shipping_zone_countries (zone_id,country_id)
      SELECT ?,id FROM countries WHERE iso2=?`)
    db.transaction(() => {
      del.run(zone_id)
      for (const iso2 of country_iso2s) ins.run(zone_id, iso2)
    })()
    return { ok: true }
  })

  // ── Shipping Tiers (Gewichtsstufen) ───────────────────────
  ipcMain.handle('shipping:tiers:list', (_e, zone_id: number) =>
    db.prepare(`SELECT * FROM shipping_tiers WHERE zone_id=? ORDER BY weight_from_g`).all(zone_id)
  )
  ipcMain.handle('shipping:tiers:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE shipping_tiers SET weight_from_g=?,weight_to_g=?,price_eur=?,
        price_extra_per_kg=?,min_charge=?,notes=? WHERE id=?`)
        .run(d.weight_from_g, d.weight_to_g, d.price_eur, d.price_extra_per_kg||0, d.min_charge||0, d.notes||null, d.id)
    } else {
      const r = db.prepare(`INSERT INTO shipping_tiers
        (zone_id,weight_from_g,weight_to_g,price_eur,price_extra_per_kg,min_charge,valid_from,notes)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(d.zone_id, d.weight_from_g||0, d.weight_to_g, d.price_eur,
          d.price_extra_per_kg||0, d.min_charge||0, d.valid_from||new Date().toISOString().slice(0,10), d.notes||null)
      return db.prepare(`SELECT * FROM shipping_tiers WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM shipping_tiers WHERE id=?`).get(d.id)
  })
  ipcMain.handle('shipping:tiers:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM shipping_tiers WHERE id=?`).run(id)
    return { ok: true }
  })

  // Versandkosten berechnen
  ipcMain.handle('shipping:calculate', (_e, d: {
    carrier_id: number; country_iso2: string; weight_g: number
  }) => {
    const zone = db.prepare(`
      SELECT sz.id FROM shipping_zones sz
      JOIN shipping_zone_countries szc ON szc.zone_id=sz.id
      JOIN countries c ON c.id=szc.country_id
      WHERE sz.carrier_id=? AND c.iso2=? LIMIT 1
    `).get(d.carrier_id, d.country_iso2) as any
    if (!zone) return { error: 'Keine Zone für dieses Land', price_eur: null }
    const tier = db.prepare(`
      SELECT * FROM shipping_tiers
      WHERE zone_id=? AND weight_from_g<=? AND weight_to_g>=?
      ORDER BY weight_from_g DESC LIMIT 1
    `).get(zone.id, d.weight_g, d.weight_g) as any
    if (!tier) return { error: 'Kein Tarif für dieses Gewicht', price_eur: null }
    return { zone_id: zone.id, price_eur: tier.price_eur, tier }
  })

  // ── Payment Providers ─────────────────────────────────────
  ipcMain.handle('payment:providers:list', () =>
    db.prepare(`SELECT pp.*,
      (SELECT COUNT(*) FROM payment_fee_tiers pft WHERE pft.provider_id=pp.id) AS method_count
      FROM payment_providers pp WHERE pp.is_active=1 ORDER BY pp.sort_order, pp.name`).all()
  )
  ipcMain.handle('payment:providers:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE payment_providers SET name=?,code=?,color=?,website=?,is_active=? WHERE id=?`)
        .run(d.name, d.code, d.color, d.website||null, d.is_active??1, d.id)
    } else {
      const r = db.prepare(`INSERT INTO payment_providers (name,code,color,website) VALUES (?,?,?,?)`)
        .run(d.name, String(d.code||d.name).toUpperCase().replace(/\s/g,'').slice(0,10), d.color||'#3b82f6', d.website||null)
      return db.prepare(`SELECT * FROM payment_providers WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM payment_providers WHERE id=?`).get(d.id)
  })

  ipcMain.handle('payment:fees:list', (_e, provider_id: number) =>
    db.prepare(`SELECT * FROM payment_fee_tiers WHERE provider_id=? ORDER BY valid_from DESC, method_code`).all(provider_id)
  )
  ipcMain.handle('payment:fees:save', (_e, d: any) => {
    if (d.id) {
      db.prepare(`UPDATE payment_fee_tiers SET method_code=?,method_label=?,fee_fixed_eur=?,
        fee_pct=?,min_fee_eur=?,max_fee_eur=?,valid_from=?,valid_to=?,notes=? WHERE id=?`)
        .run(d.method_code, d.method_label||null, d.fee_fixed_eur||0, d.fee_pct||0,
          d.min_fee_eur||0, d.max_fee_eur||null, d.valid_from, d.valid_to||null, d.notes||null, d.id)
    } else {
      const r = db.prepare(`INSERT INTO payment_fee_tiers
        (provider_id,method_code,method_label,fee_fixed_eur,fee_pct,min_fee_eur,max_fee_eur,valid_from,notes)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(d.provider_id, d.method_code||'default', d.method_label||null,
          d.fee_fixed_eur||0, d.fee_pct||0, d.min_fee_eur||0, d.max_fee_eur||null,
          d.valid_from||new Date().toISOString().slice(0,10), d.notes||null)
      return db.prepare(`SELECT * FROM payment_fee_tiers WHERE id=?`).get(r.lastInsertRowid)
    }
    return db.prepare(`SELECT * FROM payment_fee_tiers WHERE id=?`).get(d.id)
  })
  ipcMain.handle('payment:fees:delete', (_e, id: number) => {
    db.prepare(`DELETE FROM payment_fee_tiers WHERE id=?`).run(id)
    return { ok: true }
  })
  ipcMain.handle('payment:fees:delete-provider', (_e, id: number) => {
    db.prepare(`UPDATE payment_providers SET is_active=0 WHERE id=?`).run(id)
    return { ok: true }
  })
}
