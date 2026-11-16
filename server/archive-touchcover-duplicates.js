const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual: equal } = require('node:util')

const MIGRATION_ID = 'archive-touchcover-duplicates-v1'
const AUDIT_TABLE = 'touchcover_duplicate_audit'
const SOURCE = path.join(__dirname, 'price-corrections-2026.json')
const sourceText = fs.readFileSync(SOURCE, 'utf8')
const corrections = JSON.parse(sourceText).updates

// Explicit reviewed inventory, not an ID range or a name-only deduplication rule.
const INVENTORY = Object.freeze([
  [21, 38, 'Таккавер', '1+0', 20],
  [22, 39, 'Таккавер', '1+1', 21],
  [23, 40, 'Таккавер', '4+0', 22],
  [24, 41, 'Таккавер', '4+4', 23],
  [25, 42, 'Таккавер с УФ печатью без лака', '1+0', 24],
  [26, 43, 'Таккавер с УФ печатью без лака', '1+1', 25],
  [27, 44, 'Таккавер с УФ печатью без лака', '4+0', 26],
  [28, 45, 'Таккавер с УФ печатью без лака', '4+4', 27],
  [29, 46, 'Таккавер с УФ печатью и с лаком', '1+0', 28],
  [30, 47, 'Таккавер с УФ печатью и с лаком', '1+1', 29],
  [31, 48, 'Таккавер с УФ печатью и с лаком', '4+0', 30],
  [32, 49, 'Таккавер с УФ печатью и с лаком', '4+4', 31]
].map(([legacyId, currentId, name, colorType, sortOrder]) =>
  Object.freeze({ legacyId, currentId, name, colorType, sortOrder })))

// Same narrow normalization as src/lib/catalog.mjs; color_type stays separate.
const normalize = name => String(name || '').trim().replace(/^Тачкавер/i, 'Таккавер')
const identity = (row, pair) => normalize(row.name) === pair.name && row.color_type === pair.colorType

/** Pure: no connections, mutations, dotenv, clock reads, or audit writes. */
function planMigration(rows, { mode = 'apply', audit = [], updates = corrections, exactPrices = null } = {}) {
  if (!['apply', 'rollback'].includes(mode)) throw Error('Invalid migration mode')
  const changes = [], skipped = []
  const skip = (pair, reason) => skipped.push({ legacyId: pair.legacyId, currentId: pair.currentId, reason })
  for (const pair of INVENTORY) {
    const legacy = rows.filter(row => row.id === pair.legacyId)
    const current = rows.filter(row => row.id === pair.currentId)
    const records = audit.filter(row => row.migration_id === MIGRATION_ID
      && (row.legacy_id === pair.legacyId || row.current_id === pair.currentId))
    if (records.length) {
      const a = records[0]
      if (records.length !== 1 || a.legacy_id !== pair.legacyId || a.current_id !== pair.currentId
        || a.legacy_original?.id !== pair.legacyId || a.current_original?.id !== pair.currentId
        || !identity(a.legacy_original, pair) || !identity(a.current_original, pair)
        || a.legacy_original.is_active !== true || a.current_original.is_active !== true
        || !equal(a.expected_archived, { ...a.legacy_original, is_active: false })) {
        skip(pair, 'invalid-or-ambiguous-audit'); continue
      }
      if (a.rolled_back_at != null) { skip(pair, 'already-rolled-back; reapply-disabled'); continue }
      if (a.catalog_rows_exact === false || legacy.length !== 1 || current.length !== 1
        || !equal(legacy[0], a.expected_archived) || !equal(current[0], a.current_original)) {
        skip(pair, 'audited-full-row-changed'); continue
      }
      if (mode === 'rollback') changes.push({ ...pair })
      else skip(pair, 'already-applied')
      continue
    }
    if (mode === 'rollback') { skip(pair, 'no-audit'); continue }
    const matches = updates.filter(c => c.table === 'business_cards_pricing'
      && c.name === pair.name && c.colorType === pair.colorType)
    if (matches.length !== 1) { skip(pair, 'missing-or-ambiguous-correction'); continue }
    const correction = matches[0]
    const group = rows.filter(row => identity(row, pair))
    const oldExact = group.filter(row => equal(row.prices, correction.before)
      && (exactPrices === null || exactPrices.get(row.id)?.before === true))
    const newExact = group.filter(row => equal(row.prices, correction.after)
      && (exactPrices === null || exactPrices.get(row.id)?.after === true))
    if (oldExact.length !== 1 || newExact.length !== 1) {
      skip(pair, oldExact.length > 1 || newExact.length > 1
        ? 'ambiguous-legacy-or-current-price-match' : 'legacy-or-current-prices-modified-or-missing'); continue
    }
    if (legacy.length !== 1 || current.length !== 1
      || oldExact[0] !== legacy[0] || newExact[0] !== current[0]) {
      skip(pair, 'reviewed-ids-or-identity-mismatch'); continue
    }
    if (group.length !== 2) { skip(pair, 'additional-ambiguous-row'); continue }
    const old = legacy[0], now = current[0]
    if (old.is_active !== true || now.is_active !== true) { skip(pair, 'inactive-or-invalid-status'); continue }
    if (old.sort_order !== 0 || now.sort_order !== pair.sortOrder) { skip(pair, 'sort-order-mismatch'); continue }
    // Invalid or sub-millisecond-equal dates fail closed rather than guessing.
    const older = typeof old.created_at === 'string' && typeof now.created_at === 'string'
      && Date.parse(old.created_at) < Date.parse(now.created_at)
    if (!older) { skip(pair, 'legacy-not-provably-older'); continue }
    changes.push({ ...pair })
  }
  const known = new Set(INVENTORY.flatMap(p => [p.legacyId, p.currentId]))
  for (const row of rows) if (/^Таккавер/.test(normalize(row.name)) && !known.has(row.id)) {
    skipped.push({ id: row.id, reason: 'unknown-id; never-archive' })
  }
  for (const a of audit) if (a.migration_id === MIGRATION_ID
    && !INVENTORY.some(p => p.legacyId === a.legacy_id && p.currentId === a.current_id)) {
    skipped.push({ legacyId: a.legacy_id, currentId: a.current_id, reason: 'unknown-audit-pair' })
  }
  return { mode, changes, skipped }
}

const quote = name => '"' + name.replaceAll('"', '""') + '"'
const table = name => `public.${quote(name)}`
const hash = expression => `encode(sha256(convert_to((${expression})::text, 'UTF8')), 'hex')`

async function tables(client) {
  const { rows } = await client.query(`SELECT c.relname AS name, c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f') ORDER BY c.relname`)
  if (rows.some(row => row.kind === 'f')) throw Error('Cannot verify foreign public tables')
  return rows.map(row => row.name)
}

// Full JSON SHA-256 multiset, including duplicate rows and tables without IDs.
// ONLY avoids double counting inherited/partitioned rows; every physical table is listed.
async function snapshot(client, names, ids = [], active = false) {
  const result = new Map()
  for (const name of names) {
    const replace = name === 'business_cards_pricing' && ids.length
    const expression = replace
      ? "CASE WHEN t.id=ANY($1::int[]) THEN to_jsonb(t)||jsonb_build_object('is_active',$2::boolean) ELSE to_jsonb(t) END"
      : 'to_jsonb(t)'
    const { rows } = await client.query(`SELECT ${hash(expression)} AS hash, count(*)::text AS count
      FROM ONLY ${table(name)} t GROUP BY 1 ORDER BY 1`, replace ? [ids, active] : [])
    result.set(name, new Map(rows.map(row => [row.hash, BigInt(row.count)])))
  }
  return result
}

function adjust(counts, key, delta) {
  const count = (counts.get(key) || 0n) + delta
  if (count < 0n) throw Error('Audit hash preimage missing')
  if (count) counts.set(key, count)
  else counts.delete(key)
}

async function createAudit(client) {
  await client.query(`CREATE TABLE ${table(AUDIT_TABLE)} (
    migration_id text NOT NULL, legacy_id integer NOT NULL, current_id integer NOT NULL,
    legacy_original jsonb NOT NULL, current_original jsonb NOT NULL, expected_archived jsonb NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT transaction_timestamp(), rolled_back_at timestamptz,
    PRIMARY KEY (migration_id, legacy_id), UNIQUE (migration_id, current_id),
    CHECK (legacy_id <> current_id),
    CHECK (legacy_original->'is_active' = 'true'::jsonb),
    CHECK (expected_archived = legacy_original || '{"is_active":false}'::jsonb)
  )`)
}

async function writePair(client, pair, mode, rawRows, auditRows) {
  const params = [MIGRATION_ID, pair.legacyId, pair.currentId]
  let previousHash
  let auditResult
  if (mode === 'apply') {
    const old = rawRows.get(pair.legacyId), current = rawRows.get(pair.currentId)
    // Keep original JSON in PostgreSQL: never round-trip numeric/timestamp fields through JS.
    auditResult = await client.query(`INSERT INTO ${table(AUDIT_TABLE)} AS a
      (migration_id,legacy_id,current_id,legacy_original,current_original,expected_archived)
      SELECT $1,l.id,c.id,to_jsonb(l),to_jsonb(c),to_jsonb(l)||'{"is_active":false}'::jsonb
      FROM ONLY public.business_cards_pricing l, ONLY public.business_cards_pricing c
      WHERE l.id=$2 AND c.id=$3 AND to_jsonb(l)=$4::jsonb AND to_jsonb(c)=$5::jsonb
      RETURNING ${hash('to_jsonb(a)')} AS hash,
        to_jsonb(a)=jsonb_build_object('migration_id',$1::text,'legacy_id',$2::int,'current_id',$3::int,
          'legacy_original',$4::jsonb,'current_original',$5::jsonb,
          'expected_archived',$4::jsonb||'{"is_active":false}'::jsonb,
          'applied_at',transaction_timestamp(),'rolled_back_at',NULL) AS exact`, [...params, old, current])
    if (auditResult.rowCount !== 1 || auditResult.rows[0].exact !== true) throw Error('Audit full-row guard failed')
  }
  const response = await client.query(`UPDATE ONLY public.business_cards_pricing AS l
    SET is_active=$4::boolean FROM ${table(AUDIT_TABLE)} a, ONLY public.business_cards_pricing c
    WHERE a.migration_id=$1 AND a.legacy_id=$2 AND a.current_id=$3 AND a.rolled_back_at IS NULL
      AND l.id=a.legacy_id AND c.id=a.current_id AND to_jsonb(c)=a.current_original
      AND to_jsonb(l)=${mode === 'apply' ? 'a.legacy_original' : 'a.expected_archived'}
    RETURNING l.id`, [...params, mode === 'rollback'])
  if (response.rowCount !== 1) throw Error(`Full-row guard failed for ${pair.legacyId}`)
  if (mode === 'rollback') {
    const original = auditRows.find(row => row.value.legacy_id === pair.legacyId)
    previousHash = original.hash
    auditResult = await client.query(`UPDATE ${table(AUDIT_TABLE)} AS a
      SET rolled_back_at=transaction_timestamp()
      WHERE migration_id=$1 AND legacy_id=$2 AND current_id=$3 AND to_jsonb(a)=$4::jsonb
      RETURNING ${hash('to_jsonb(a)')} AS hash,
        to_jsonb(a)=($4::jsonb||jsonb_build_object('rolled_back_at',transaction_timestamp())) AS exact`,
    [...params, original.raw])
  }
  if (auditResult.rowCount !== 1 || auditResult.rows[0].exact !== true) throw Error('Audit full-row guard failed')
  return { previousHash, nextHash: auditResult.rows[0].hash }
}

/** Pool injection is for focused offline transaction tests. Never called on import. */
async function runMigration(pool, { mode = 'apply', dryRun = true } = {}) {
  if (!['apply', 'rollback'].includes(mode)) throw Error('Invalid migration mode')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='10s'")
    await client.query('SET LOCAL row_security=off')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:archive-touchcover-duplicates-v1'))")
    const beforeTables = await tables(client)
    if (!beforeTables.includes('business_cards_pricing')) throw Error('Missing public.business_cards_pricing')
    // Block writers for a coherent cross-table assertion; leave triggers enabled.
    await client.query(`LOCK TABLE ${beforeTables.map(name => `ONLY ${table(name)}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`)
    // SQL also compares prices: JS numbers can round an edited JSONB numeric value.
    const priceMatch = side => `EXISTS (SELECT 1 FROM jsonb_array_elements($1::jsonb->'updates') c
      WHERE c->>'table'='business_cards_pricing'
        AND c->>'name'=regexp_replace(btrim(t.name),'^Тачкавер','Таккавер','i')
        AND c->>'colorType'=t.color_type AND c->'${side}'=t.prices)`
    const raw = (await client.query(`SELECT to_jsonb(t)::text AS raw,
      ${priceMatch('before')} AS before, ${priceMatch('after')} AS after
      FROM ONLY public.business_cards_pricing t`, [sourceText])).rows
    const rows = raw.map(row => JSON.parse(row.raw))
    const rawRows = new Map(raw.map((row, i) => [rows[i].id, row.raw]))
    const auditRows = beforeTables.includes(AUDIT_TABLE)
      ? (await client.query(`SELECT to_jsonb(a)::text AS raw, ${hash('to_jsonb(a)')} AS hash,
          EXISTS (SELECT 1 FROM ONLY public.business_cards_pricing l, ONLY public.business_cards_pricing c
            WHERE l.id=a.legacy_id AND c.id=a.current_id
              AND to_jsonb(l)=a.expected_archived AND to_jsonb(c)=a.current_original) AS rows_exact
          FROM ${table(AUDIT_TABLE)} a WHERE migration_id=$1`, [MIGRATION_ID])).rows
        .map(row => ({ ...row, value: JSON.parse(row.raw) })) : []
    const exactPrices = new Map(raw.map((row, i) => [rows[i].id, { before: row.before, after: row.after }]))
    const plan = planMigration(rows, { mode, exactPrices, audit: auditRows.map(row =>
      ({ ...row.value, catalog_rows_exact: row.rows_exact })) })
    const expected = await snapshot(client, beforeTables, dryRun ? [] : plan.changes.map(p => p.legacyId), mode === 'rollback')
    const afterTables = [...beforeTables]
    if (!dryRun && plan.changes.length) {
      if (!expected.has(AUDIT_TABLE)) {
        if (mode === 'rollback') throw Error('Missing rollback audit')
        await createAudit(client)
        expected.set(AUDIT_TABLE, new Map())
        afterTables.push(AUDIT_TABLE)
        afterTables.sort()
      }
      for (const pair of plan.changes) {
        const { previousHash, nextHash } = await writePair(client, pair, mode, rawRows, auditRows)
        const counts = expected.get(AUDIT_TABLE)
        if (previousHash) adjust(counts, previousHash, -1n)
        adjust(counts, nextHash, 1n)
      }
    }
    // Deferred constraint triggers must run before the final hash assertion, not at COMMIT.
    await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    if (fs.readFileSync(SOURCE, 'utf8') !== sourceText) throw Error('Correction source changed during migration')
    if (!equal(await tables(client), afterTables)) throw Error('Public table inventory changed')
    const actual = await snapshot(client, afterTables)
    for (const name of afterTables) if (!equal(actual.get(name), expected.get(name))) {
      throw Error(`Unexpected full-row JSON hash change in public.${name}; rolling back`)
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
    return { migrationId: MIGRATION_ID, dryRun, ...plan, verifiedTables: afterTables.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

function parseArgs(args) {
  if (args.some(arg => !['--apply', '--rollback', '--dry-run', '--help'].includes(arg))) throw Error('Unknown argument')
  if (args.includes('--apply') && (args.includes('--rollback') || args.includes('--dry-run'))) {
    throw Error('--apply cannot be combined with --rollback or --dry-run')
  }
  return { mode: args.includes('--rollback') ? 'rollback' : 'apply',
    dryRun: args.includes('--dry-run') || (!args.includes('--apply') && !args.includes('--rollback')) }
}

module.exports = { MIGRATION_ID, AUDIT_TABLE, INVENTORY, planMigration, runMigration, parseArgs }

if (require.main === module) {
  let pool
  Promise.resolve().then(async () => {
    const options = parseArgs(process.argv.slice(2))
    if (process.argv.includes('--help')) {
      console.log('node server/archive-touchcover-duplicates.js [--dry-run | --apply | --rollback [--dry-run]]')
      return
    }
    require('dotenv').config()
    if (!process.env.DATABASE_URL) throw Error('DATABASE_URL не задан')
    const { Pool } = require('pg')
    pool = new Pool({ connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
    console.log(JSON.stringify(await runMigration(pool, options), null, 2))
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
    .finally(() => pool?.end())
}
