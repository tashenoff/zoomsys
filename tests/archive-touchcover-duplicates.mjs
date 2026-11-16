import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import net from 'node:net'

const require = createRequire(import.meta.url)
const { INVENTORY, MIGRATION_ID, AUDIT_TABLE, planMigration, runMigration, parseArgs } =
  require('../server/archive-touchcover-duplicates.js')
const updates = JSON.parse(readFileSync(new URL('../server/price-corrections-2026.json', import.meta.url))).updates
const clone = value => structuredClone(value)
function fixture() {
  return INVENTORY.flatMap(p => {
    const c = updates.find(c => c.name === p.name && c.colorType === p.colorType)
    const common = { color_type: p.colorType, is_active: true, notes: 'preserve me',
      updated_at: '2026-10-01T10:00:00.123456', future_column: { arbitrary: ['keep', 0, null] } }
    return [
      { ...clone(common), id: p.legacyId, name: p.name.replace(/^Таккавер/, 'Тачкавер'),
        prices: clone(c.before), sort_order: 0, created_at: '2025-01-01T00:00:00' },
      { ...clone(common), id: p.currentId, name: p.name,
        prices: clone(c.after), sort_order: p.sortOrder, created_at: '2026-01-01T00:00:00' }
    ]
  })
}
function audited(rows = fixture()) {
  return INVENTORY.map(p => {
    const old = rows.find(r => r.id === p.legacyId), current = rows.find(r => r.id === p.currentId)
    return { migration_id: MIGRATION_ID, legacy_id: old.id, current_id: current.id,
      legacy_original: clone(old), current_original: clone(current),
      expected_archived: { ...clone(old), is_active: false },
      applied_at: '2026-11-16T00:00:00Z', rolled_back_at: null }
  })
}

test('explicit reviewed inventory, full exact prices, normalization and pure inputs', () => {
  const rows = fixture(), before = clone(rows), source = clone(updates)
  const plan = planMigration(rows)
  assert.deepEqual(plan.changes.map(p => [p.legacyId, p.currentId]), [
    [21, 38], [22, 39], [23, 40], [24, 41], [25, 42], [26, 43],
    [27, 44], [28, 45], [29, 46], [30, 47], [31, 48], [32, 49]
  ])
  assert.equal(plan.skipped.length, 0)
  assert.deepEqual(rows, before)
  rows[0].name = '  тАчКаВер  '
  assert.equal(planMigration(rows).changes.length, 12)
  assert.deepEqual(before, fixture())
  assert.deepEqual(updates, source)
  const frozen = fixture().map(r => Object.freeze({ ...r, prices: Object.freeze(r.prices) }))
  assert.equal(planMigration(Object.freeze(frozen)).changes.length, 12)
})

for (const [label, mutate] of [
  ['legacy price edited', r => { r[0].prices.from500 = 999 }],
  ['current price edited', r => { r[1].prices.from500 = 999 }],
  ['extra price key', r => { r[0].prices.extra = 0 }],
  ['missing price key', r => { delete r[1].prices.upTo49 }],
  ['price type changed', r => { r[0].prices.upTo49 = '130' }],
  ['current inactive', r => { r[1].is_active = false }],
  ['legacy inactive without audit', r => { r[0].is_active = false }],
  ['legacy sort changed', r => { r[0].sort_order = 1 }],
  ['current sort outside inventory', r => { r[1].sort_order = 31 }],
  ['legacy newer', r => { r[0].created_at = '2027-01-01' }],
  ['equal dates', r => { r[0].created_at = r[1].created_at }],
  ['null date', r => { r[0].created_at = null }],
  ['invalid date', r => { r[0].created_at = 'bad' }],
  ['unknown exact current id', r => { r[1].id = 500 }],
  ['unknown exact legacy id', r => { r[0].id = 501 }],
  ['duplicate exact legacy', r => { r.push({ ...clone(r[0]), id: 502 }) }],
  ['duplicate exact current', r => { r.push({ ...clone(r[1]), id: 503 }) }],
  ['extra modified candidate', r => { r.push({ ...clone(r[0]), id: 504, prices: { custom: 1 } }) }],
  ['modified name', r => { r[0].name += ' с лаком' }]
]) test(`skip safely: ${label}`, () => {
  const rows = fixture(); mutate(rows)
  const before = clone(rows), plan = planMigration(rows)
  assert.equal(plan.changes.length, 11)
  assert.ok(plan.skipped.some(s => s.legacyId === 21 && s.reason))
  assert.deepEqual(rows, before)
})

test('4+0 and 4+4 never match each other, even with the exact other prices', () => {
  const rows = fixture()
  rows.find(r => r.id === 40).color_type = '4+4'
  assert.ok(!planMigration(rows).changes.some(p => p.legacyId === 23 || p.legacyId === 24))
  rows.find(r => r.id === 40).color_type = '4+0'
  rows.find(r => r.id === 40).prices = clone(rows.find(r => r.id === 41).prices)
  assert.ok(!planMigration(rows).changes.some(p => p.legacyId === 23))
  assert.ok(planMigration(rows).changes.some(p => p.legacyId === 24))
})

test('missing/duplicate corrections, unrelated rows and unknown IDs cannot authorize archiving', () => {
  const rows = fixture()
  assert.equal(planMigration(rows, { updates: [] }).changes.length, 0)
  assert.equal(planMigration(rows, { updates: [...updates, updates.find(c => c.name === 'Таккавер' && c.colorType === '1+0')] }).changes.length, 11)
  assert.equal(planMigration([{ id: 900, name: 'unrelated' }]).changes.length, 0)
  assert.ok(planMigration([{ ...rows[0], id: 900 }]).skipped.some(s => s.id === 900 && s.reason.includes('unknown-id')))
})

test('exact SQL price checks override rounded JS values', () => {
  const rows = fixture()
  const exactPrices = new Map(rows.map(r => [r.id, { before: r.sort_order === 0, after: r.sort_order !== 0 }]))
  exactPrices.get(21).before = false
  assert.equal(planMigration(rows, { exactPrices }).changes.length, 11)
  exactPrices.get(21).before = true
  exactPrices.get(38).after = false
  assert.equal(planMigration(rows, { exactPrices }).changes.length, 11)
})

test('audit makes apply idempotent; guarded rollback restores only audited pairs', () => {
  const rows = fixture(), audit = audited(rows)
  for (const p of INVENTORY) rows.find(r => r.id === p.legacyId).is_active = false
  const before = clone({ rows, audit })
  assert.equal(planMigration(rows, { audit }).changes.length, 0)
  assert.ok(planMigration(rows, { audit }).skipped.every(s => s.reason === 'already-applied'))
  assert.equal(planMigration(rows, { audit, mode: 'rollback' }).changes.length, 12)
  assert.deepEqual({ rows, audit }, before)
  assert.equal(planMigration(rows, { mode: 'rollback' }).changes.length, 0)
  audit[0].rolled_back_at = '2026-11-17T00:00:00Z'
  assert.equal(planMigration(rows, { audit, mode: 'rollback' }).changes.length, 11)
  assert.equal(planMigration(fixture(), { audit }).changes.length, 0)
})

for (const [label, mutate] of [
  ['legacy notes', (r, a) => { r[0].notes = 'edited' }],
  ['legacy timestamp', (r, a) => { r[0].updated_at += 'Z' }],
  ['current price', (r, a) => { r[1].prices.from500 = 9 }],
  ['current timestamp', (r, a) => { r[1].updated_at += 'Z' }],
  ['missing current', r => { r.splice(1, 1) }],
  ['bad expected row', (r, a) => { a[0].expected_archived.notes = 'tampered' }],
  ['cross-color audit', (r, a) => { a[0].current_original.color_type = '4+4' }],
  ['duplicate audit', (r, a) => { a.push(clone(a[0])) }],
  ['exact SQL full-row mismatch', (r, a) => { a[0].catalog_rows_exact = false }]
]) test(`rollback full-row guard: ${label}`, () => {
  const rows = fixture(), audit = audited(rows)
  for (const p of INVENTORY) rows.find(r => r.id === p.legacyId).is_active = false
  mutate(rows, audit)
  const plan = planMigration(rows, { audit, mode: 'rollback' })
  assert.equal(plan.changes.length, 11)
  assert.ok(!plan.changes.some(p => p.legacyId === 21))
})

test('CLI defaults dry-run; writes require an explicit exclusive mode', () => {
  assert.deepEqual(parseArgs([]), { mode: 'apply', dryRun: true })
  assert.deepEqual(parseArgs(['--apply']), { mode: 'apply', dryRun: false })
  assert.deepEqual(parseArgs(['--rollback']), { mode: 'rollback', dryRun: false })
  assert.deepEqual(parseArgs(['--rollback', '--dry-run']), { mode: 'rollback', dryRun: true })
  for (const args of [['--apply', '--rollback'], ['--apply', '--dry-run'], ['--oops']]) assert.throws(() => parseArgs(args))
})

// Scripted pg boundary: these tests verify transaction protocol and failure paths,
// not SQL execution. The opt-in real-engine test below verifies SQL separately.
function scriptedPool({ failure = null, snapshotMismatch = false, foreign = false } = {}) {
  const calls = []
  let snapshots = 0, released = false
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (failure && sql.includes(failure)) throw Error('injected query failure')
      if (sql.includes('FROM pg_class')) return { rows: [
        { name: 'business_cards_pricing', kind: 'r' }, { name: 'history', kind: foreign ? 'f' : 'r' }
      ] }
      if (sql.includes('AS raw') && sql.includes('FROM ONLY public.business_cards_pricing t')) {
        return { rows: fixture().map(r => ({ raw: JSON.stringify(r), before: r.sort_order === 0, after: r.sort_order !== 0 })) }
      }
      if (sql.includes('GROUP BY 1')) {
        snapshots++
        return { rows: [{ hash: snapshotMismatch && snapshots === 4 ? 'changed' : 'original', count: '24' }] }
      }
      if (sql.startsWith('INSERT INTO')) return { rowCount: 1, rows: [{ hash: 'audit-row', exact: true }] }
      if (sql.startsWith('UPDATE ONLY')) return { rowCount: 0, rows: [] }
      if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SET CONSTRAINTS|LOCK TABLE|CREATE TABLE|SELECT pg_advisory)/.test(sql)) return { rows: [] }
      throw Error('Unexpected scripted query: ' + sql)
    },
    release() { released = true }
  }
  return { pool: { connect: async () => client }, calls, isReleased: () => released }
}

test('runner default dry-run locks before reading, verifies all tables, rolls back and releases', async () => {
  const pg = scriptedPool()
  const result = await runMigration(pg.pool)
  assert.equal(result.dryRun, true)
  assert.equal(result.changes.length, 12)
  assert.equal(result.verifiedTables, 2)
  const queries = pg.calls.map(c => c.sql)
  assert.ok(queries.findIndex(s => s.startsWith('LOCK TABLE')) < queries.findIndex(s => s.includes('AS raw')))
  assert.ok(queries.some(s => s.includes('pg_advisory_xact_lock')))
  assert.ok(queries.some(s => s === 'SET LOCAL row_security=off'))
  assert.ok(queries.some(s => s === 'SET CONSTRAINTS ALL IMMEDIATE'))
  assert.equal(queries.at(-1), 'ROLLBACK')
  assert.ok(!queries.some(s => /^(CREATE|INSERT|UPDATE|DELETE|COMMIT)/.test(s)))
  assert.ok(pg.isReleased())
})

for (const [name, options, pattern] of [
  ['lock failure', { failure: 'LOCK TABLE' }, /injected/],
  ['unexpected history hash', { snapshotMismatch: true }, /public.history/],
  ['foreign public table', { foreign: true }, /foreign public tables/]
]) test(`runner aborts safely: ${name}`, async () => {
  const pg = scriptedPool(options)
  await assert.rejects(runMigration(pg.pool), pattern)
  assert.equal(pg.calls.at(-1).sql, 'ROLLBACK')
  assert.ok(!pg.calls.some(c => c.sql === 'COMMIT'))
  assert.ok(pg.isReleased())
})

test('full-row update guard failure rolls back the audit and never commits', async () => {
  const pg = scriptedPool()
  await assert.rejects(runMigration(pg.pool, { dryRun: false }), /Full-row guard failed/)
  assert.ok(pg.calls.some(c => c.sql.startsWith('CREATE TABLE')))
  assert.ok(pg.calls.some(c => c.sql.startsWith('INSERT INTO')))
  assert.equal(pg.calls.at(-1).sql, 'ROLLBACK')
  assert.ok(!pg.calls.some(c => c.sql === 'COMMIT'))
  assert.ok(pg.isReleased())
})

// Opt-in engine tests bootstrap a NEW disposable cluster, never use DATABASE_URL,
// and connect exclusively to its loopback port. No existing database is touched.
const pgBin = process.env.TOUCHCOVER_TEST_PG_BIN
test('isolated PostgreSQL: transactions, audit, hash assertions, idempotency and rollback',
  { skip: !pgBin, timeout: 120000 }, async t => {
    const { Pool } = require('pg')
    const directory = mkdtempSync(path.join(tmpdir(), 'touchcover-pg-isolated-'))
    const executable = name => path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''))
    const command = (name, args) => {
      const result = spawnSync(executable(name), args, { encoding: 'utf8', windowsHide: true, timeout: 30000 })
      assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout)
    }
    let started = false, pool
    try {
      command('initdb', ['-D', directory, '-A', 'trust', '-U', 'touchcover_test', '--no-locale', '-E', 'UTF8'])
      const listener = net.createServer()
      await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
      const port = listener.address().port
      await new Promise(resolve => listener.close(resolve))
      command('pg_ctl', ['-D', directory, '-l', path.join(directory, 'test.log'),
        '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start'])
      started = true
      pool = new Pool({ host: '127.0.0.1', port, user: 'touchcover_test', database: 'postgres', ssl: false })
      const identity = (await pool.query("SELECT current_setting('data_directory') AS directory")).rows[0].directory
      const normalizePath = p => path.resolve(p).replaceAll('\\', '/').toLowerCase()
      assert.equal(normalizePath(identity), normalizePath(directory))
      const dump = async () => (await pool.query('SELECT to_jsonb(t)::text AS raw FROM business_cards_pricing t ORDER BY id')).rows
      async function reset() {
        await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
        await pool.query(`CREATE TABLE business_cards_pricing (
          id integer PRIMARY KEY, name text, color_type text, prices jsonb, is_active boolean,
          sort_order integer, created_at timestamp, updated_at timestamp, notes text, future_column jsonb,
          huge numeric DEFAULT 9007199254740993.123456789)`)
        for (const row of fixture()) await pool.query(`INSERT INTO business_cards_pricing
          (id,name,color_type,prices,is_active,sort_order,created_at,updated_at,notes,future_column)
          SELECT id,name,color_type,prices,is_active,sort_order,created_at,updated_at,notes,future_column
          FROM jsonb_populate_record(NULL::business_cards_pricing,$1::jsonb)`, [JSON.stringify(row)])
        await pool.query(`CREATE TABLE order_items (product_id integer REFERENCES business_cards_pricing(id), snapshot jsonb);
          INSERT INTO order_items VALUES (21,'{"price":130,"name":"historical"}'), (41,'{"price":300}');
          CREATE TABLE history_without_id (value jsonb);
          INSERT INTO history_without_id VALUES ('{"same":true}'), ('{"same":true}')`)
      }
      const hasAudit = async () => (await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [AUDIT_TABLE])).rows[0].present
      const auditDump = async () => (await pool.query(`SELECT to_jsonb(a)::text AS raw FROM ${AUDIT_TABLE} a ORDER BY legacy_id`)).rows

      await t.test('dry-run has no DDL/audit; apply and rollback preserve every other field and history', async () => {
        await reset()
        const original = await dump()
        assert.equal((await runMigration(pool)).changes.length, 12)
        assert.equal(await hasAudit(), false)
        assert.deepEqual(await dump(), original)
        const result = await runMigration(pool, { dryRun: false })
        assert.equal(result.changes.length, 12)
        assert.equal(result.verifiedTables, 4)
        const archived = await dump(), audit = await auditDump()
        assert.equal(audit.length, 12)
        const mismatch = await pool.query(`SELECT count(*)::int AS count FROM ${AUDIT_TABLE} a
          JOIN business_cards_pricing l ON l.id=a.legacy_id JOIN business_cards_pricing c ON c.id=a.current_id
          WHERE to_jsonb(l)<>a.expected_archived OR to_jsonb(c)<>a.current_original
            OR (to_jsonb(l)-'is_active')<>(a.legacy_original-'is_active')`)
        assert.equal(mismatch.rows[0].count, 0)
        assert.match(audit[0].raw, /9007199254740993\.123456789/)
        assert.match(audit[0].raw, /10:00:00\.123456/)
        assert.equal((await runMigration(pool, { dryRun: false })).changes.length, 0)
        assert.deepEqual(await dump(), archived)
        assert.deepEqual(await auditDump(), audit)
        assert.equal((await runMigration(pool, { mode: 'rollback', dryRun: true })).changes.length, 12)
        assert.deepEqual(await dump(), archived)
        assert.deepEqual(await auditDump(), audit)
        assert.equal((await runMigration(pool, { mode: 'rollback', dryRun: false })).changes.length, 12)
        assert.deepEqual(await dump(), original)
        const restoredAudit = await auditDump()
        assert.equal((await runMigration(pool, { mode: 'rollback', dryRun: false })).changes.length, 0)
        assert.equal((await runMigration(pool, { dryRun: false })).changes.length, 0)
        assert.deepEqual(await auditDump(), restoredAudit)
        assert.equal((await pool.query('SELECT count(*)::int AS count FROM order_items')).rows[0].count, 2)
      })

      await t.test('rollback skips edited full rows, including numeric changes JS cannot distinguish', async () => {
        await reset(); await runMigration(pool, { dryRun: false })
        await pool.query('UPDATE business_cards_pricing SET huge=9007199254740993.123456788 WHERE id=38')
        // SQL full-row equality is authoritative even when JS loses numeric precision.
        const precise = await runMigration(pool, { mode: 'rollback', dryRun: false })
        assert.equal(precise.changes.length, 11)
        assert.ok(precise.skipped.some(p => p.legacyId === 21 && p.reason === 'audited-full-row-changed'))
        await pool.query('UPDATE business_cards_pricing SET huge=9007199254740993.123456789, notes=\'edited\' WHERE id=38')
        const result = await runMigration(pool, { mode: 'rollback', dryRun: false })
        assert.equal(result.changes.length, 0)
        assert.ok(result.skipped.some(p => p.legacyId === 21 && p.reason === 'audited-full-row-changed'))
        assert.equal((await pool.query('SELECT is_active FROM business_cards_pricing WHERE id=21')).rows[0].is_active, false)
      })

      await t.test('apply skips a full JSONB price edit that JS would round away', async () => {
        await reset()
        await pool.query(`UPDATE business_cards_pricing SET prices=jsonb_set(prices,'{upTo49}','130.000000000000000001') WHERE id=21`)
        const result = await runMigration(pool, { dryRun: false })
        assert.equal(result.changes.length, 11)
        assert.ok(result.skipped.some(p => p.legacyId === 21))
        assert.equal((await pool.query('SELECT is_active FROM business_cards_pricing WHERE id=21')).rows[0].is_active, true)
        assert.equal((await auditDump()).length, 11)
      })

      await t.test('timestamp trigger aborts and rolls back audit creation and every archive', async () => {
        await reset(); const original = await dump()
        await pool.query(`CREATE FUNCTION stamp() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
          CREATE TRIGGER stamp BEFORE UPDATE ON business_cards_pricing FOR EACH ROW EXECUTE FUNCTION stamp()`)
        await assert.rejects(runMigration(pool, { dryRun: false }), /Unexpected full-row JSON hash change/)
        assert.deepEqual(await dump(), original)
        assert.equal(await hasAudit(), false)
      })

      await t.test('cross-table history side effects abort the complete transaction', async () => {
        await reset(); const original = await dump()
        await pool.query(`CREATE FUNCTION history_edit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN UPDATE history_without_id SET value='{"changed":true}'; RETURN NEW; END $$;
          CREATE TRIGGER history_edit AFTER UPDATE ON business_cards_pricing FOR EACH ROW EXECUTE FUNCTION history_edit()`)
        await assert.rejects(runMigration(pool, { dryRun: false }), /public.history_without_id/)
        assert.deepEqual(await dump(), original)
        assert.equal(await hasAudit(), false)
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM history_without_id WHERE value=\'{"same":true}\'')).rows[0].n, 2)
      })

      await t.test('deferred trigger side effects run before the final hash assertion', async () => {
        await reset(); const original = await dump()
        await pool.query(`CREATE FUNCTION deferred_history_edit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN UPDATE history_without_id SET value='{"deferred":true}'; RETURN NEW; END $$;
          CREATE CONSTRAINT TRIGGER deferred_history_edit AFTER UPDATE ON business_cards_pricing
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION deferred_history_edit()`)
        await assert.rejects(runMigration(pool, { dryRun: false }), /public.history_without_id/)
        assert.deepEqual(await dump(), original)
        assert.equal(await hasAudit(), false)
      })

      await t.test('advisory lock serializes concurrent apply; second apply changes nothing', async () => {
        await reset()
        const results = await Promise.all([runMigration(pool, { dryRun: false }), runMigration(pool, { dryRun: false })])
        assert.deepEqual(results.map(r => r.changes.length).sort((a, b) => a - b), [0, 12])
        assert.equal((await auditDump()).length, 12)
      })
    } finally {
      await pool?.end()
      if (started) command('pg_ctl', ['-D', directory, '-m', 'immediate', '-w', 'stop'])
      const resolved = path.resolve(directory)
      assert.equal(path.dirname(resolved), path.resolve(tmpdir()))
      assert.ok(path.basename(resolved).startsWith('touchcover-pg-isolated-'))
      rmSync(resolved, { recursive: true, force: true })
    }
  })
