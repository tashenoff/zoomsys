// Run only as part of an explicitly authorized schema migration/seed.
async function ensureOperationPriceStatus(client) {
  await client.query('ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS price_status TEXT')
  await client.query(`UPDATE additional_operations SET price_status = CASE WHEN name = ANY($1::text[]) THEN 'provisional' ELSE 'approved' END WHERE price_status IS NULL`, [[
    'Листовая печать без бумаги','Ланьярд с карабином (без нанесения)','Обрезка листовая за заказ','Лакировка листовая','Скругление углов','Отверстие круглое','Фальцовка (сгиб)'
  ]])
  await client.query("ALTER TABLE additional_operations ALTER COLUMN price_status SET DEFAULT 'approved'")
  await client.query("ALTER TABLE additional_operations ALTER COLUMN price_status SET NOT NULL")
}
module.exports = { ensureOperationPriceStatus }
