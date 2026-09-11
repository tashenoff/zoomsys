require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// SSL только если явно указано (для managed DB типа Heroku, Supabase)
const useSSL = process.env.DATABASE_SSL === 'true'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

async function seed() {
  console.log('🌱 Загружаем начальные данные...')
  
  try {
    // Загружаем данные из pricing.json (лежит в папке server)
    const pricingPath = path.join(__dirname, 'pricing.json')
    const pricingData = JSON.parse(fs.readFileSync(pricingPath, 'utf8'))

    // Settings
    await pool.query('INSERT INTO pricing_settings (id, urgent_surcharge) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
      [pricingData.settings.urgentSurcharge])
    console.log('✅ Настройки загружены')

    // Business Cards
    for (let i = 0; i < pricingData.businessCards.length; i++) {
      const item = pricingData.businessCards[i]
      await pool.query(
        'INSERT INTO business_cards_pricing (name, color_type, prices, sort_order) VALUES ($1, $2, $3, $4)',
        [item.name, item.colorType, JSON.stringify(item.prices), i]
      )
    }
    console.log(`✅ Визитки: ${pricingData.businessCards.length} позиций`)

    // Printing - структура с colorTypes массивом
    if (pricingData.printing) {
      let printCount = 0
      for (let i = 0; i < pricingData.printing.length; i++) {
        const item = pricingData.printing[i]
        // Полиграфия имеет вложенную структуру colorTypes
        if (item.colorTypes) {
          for (const ct of item.colorTypes) {
            await pool.query(
              'INSERT INTO printing_pricing (category, name, color_type, prices, sort_order) VALUES ($1, $2, $3, $4, $5)',
              [item.category, item.name, ct.type, JSON.stringify(ct.prices), printCount++]
            )
          }
        } else if (item.prices) {
          // Или простая структура как у визиток
          await pool.query(
            'INSERT INTO printing_pricing (category, name, color_type, prices, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [item.category, item.name, item.colorType, JSON.stringify(item.prices), printCount++]
          )
        }
      }
      console.log(`✅ Полиграфия: ${printCount} позиций`)
    }

    // UV Printing
    if (pricingData.uvPrinting) {
      for (let i = 0; i < pricingData.uvPrinting.length; i++) {
        const item = pricingData.uvPrinting[i]
        await pool.query(
          'INSERT INTO uv_printing_pricing (category, name, description, sides, materials, price_type, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [item.category, item.name, item.description, JSON.stringify(item.sides), JSON.stringify(item.materials), item.priceType, i]
        )
      }
      console.log(`✅ УФ печать: ${pricingData.uvPrinting.length} позиций`)
    }

    // Wide Format
    if (pricingData.wideFormat) {
      for (let i = 0; i < pricingData.wideFormat.length; i++) {
        const item = pricingData.wideFormat[i]
        await pool.query(
          'INSERT INTO wide_format_pricing (name, price_per_sqm, sort_order) VALUES ($1, $2, $3)',
          [item.name, item.pricePerSqm, i]
        )
      }
      console.log(`✅ Широкоформат: ${pricingData.wideFormat.length} позиций`)
    }

    // State Symbols
    if (pricingData.stateSymbols) {
      for (let i = 0; i < pricingData.stateSymbols.length; i++) {
        const item = pricingData.stateSymbols[i]
        await pool.query(
          'INSERT INTO state_symbols_pricing (category, name, option, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
          [item.category, item.name, item.option || null, item.price, i]
        )
      }
      console.log(`✅ Гос. символика: ${pricingData.stateSymbols.length} позиций`)
    }

    // Additional Services
    if (pricingData.additionalServices) {
      for (let i = 0; i < pricingData.additionalServices.length; i++) {
        const item = pricingData.additionalServices[i]
        await pool.query(
          'INSERT INTO additional_services (name, price, unit, description, applicable_to, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
          [item.name, item.price, item.unit, item.description, JSON.stringify(item.applicableTo || ['all']), i]
        )
      }
      console.log(`✅ Доп. услуги: ${pricingData.additionalServices.length} позиций`)
    }

    // Additional Operations (ламинация, фольгирование, скругление углов и т.д.)
    if (pricingData.additionalOperations) {
      const operations = Object.entries(pricingData.additionalOperations)
      for (let i = 0; i < operations.length; i++) {
        const [key, item] = operations[i]
        await pool.query(
          `INSERT INTO additional_operations 
           (name, operation_type, applicable_to, options, price, unit, description, default_quantity, sort_order) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            item.name, 
            item.type || null, 
            JSON.stringify(item.applicableTo || ['all']),
            item.options ? JSON.stringify(item.options) : null,
            item.price || null,
            item.unit || null,
            item.description || null,
            item.defaultQuantity || null,
            i
          ]
        )
      }
      console.log(`✅ Доп. операции: ${operations.length} позиций`)
    }

    // Reorder Options
    if (pricingData.reorderOptions) {
      for (let i = 0; i < pricingData.reorderOptions.length; i++) {
        const item = pricingData.reorderOptions[i]
        await pool.query(
          'INSERT INTO reorder_options (name, discount_percent, sort_order) VALUES ($1, $2, $3)',
          [item.name || item.label, item.discountPercent || 0, i]
        )
      }
      console.log(`✅ Опции перезаказа: ${pricingData.reorderOptions.length} позиций`)
    }

    console.log('\n✨ Все данные загружены успешно!')
  } catch (error) {
    console.error('❌ Ошибка:', error)
    process.exit(1)
  } finally { await pool.end() }
}

seed()
