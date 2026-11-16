# Touchcover duplicate archive v1

Standalone script; not wired into seeds, normal migrations, or startup. Run from
the repository root using the existing `pg`/`dotenv` dependencies. Set
`DATABASE_URL` explicitly to the intended **local/staging** database;
`DATABASE_SSL=true` follows the server's existing SSL convention. These commands
are operator instructions; no existing database needs to be contacted for unit tests.

```powershell
node --test tests/archive-touchcover-duplicates.mjs
node server/archive-touchcover-duplicates.js                 # dry-run, no audit writes/DDL
node server/archive-touchcover-duplicates.js --apply         # explicit archive
node server/archive-touchcover-duplicates.js --rollback --dry-run
node server/archive-touchcover-duplicates.js --rollback      # explicit guarded restore
```

Review the JSON `changes` and `skipped` reasons before applying. Only the 12
explicitly listed pairs 21→38 through 32→49 qualify. Each needs a unique exact
`before`/`after` price object from `price-corrections-2026.json`, the narrow
Тачкавер→Таккавер normalization, identical `color_type`, active rows, an older
legacy `created_at`, legacy sort 0 and its reviewed current sort 20–31.
Extra/unknown/modified/ambiguous candidates are skipped. 4+0 and 4+4 stay distinct.
Invalid or indistinguishable sub-millisecond dates fail closed.

Apply changes **only legacy `is_active` to false**. Prices, names, timestamps
(including `updated_at`), IDs, orders and history are preserved; no rows are
deleted or references redirected. `public.touchcover_duplicate_audit` is a durable
alias inventory keyed by migration ID `archive-touchcover-duplicates-v1` and
legacy/current IDs. It stores both full original rows and the full expected
archived row as JSONB, plus apply/rollback timestamps. Original JSON stays inside
PostgreSQL to preserve timestamp/numeric precision. Audit is created only when
an apply has qualifying changes; dry-run always rolls its transaction back.

One transaction and an advisory lock serialize this script. All existing public
tables are write-locked for full-row JSON SHA-256 multiset checks (including
tables without IDs and duplicate rows). Run during a quiet window: locks can
block application writes and fail after a 10-second lock timeout. The role needs
full visibility/read and lock privileges on all public tables, update permission
on the catalog and audit, and public schema create permission for first apply.
RLS cannot silently hide rows; foreign public tables are rejected. Triggers stay
enabled; deferred constraint triggers are flushed before the final verification.
Any unexpected field/history/audit change, table inventory change or
correction-file change aborts the entire transaction. Audit hash differences are
restricted to exactly validated inserts or rollback timestamp updates.

Repeated apply performs no writes. Rollback requires **both** catalog rows to
equal the audited full rows; edited pairs are skipped using SQL equality even
for changes lost to JS numeric precision. A final guard failure aborts the whole
transaction. Rollback restores only legacy `is_active` and marks its audit entry
rolled back. Audit remains durable; repeated rollback and reapply after rollback
do nothing. A new migration ID/code review is required for another lifecycle.

For SQL/trigger/concurrency verification using an installed PostgreSQL, the focused
test can bootstrap and remove a **new isolated temporary cluster** on a random
loopback port. It never reads `DATABASE_URL` or connects to an existing cluster:

```powershell
$env:TOUCHCOVER_TEST_PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
node --test tests/archive-touchcover-duplicates.mjs
Remove-Item Env:\TOUCHCOVER_TEST_PG_BIN
```
