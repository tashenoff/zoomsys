import { buildCalculatorItems } from './navCatalog.js'
import { getEnabledWideFormatMaterials, isBadgeProduct, getStateSymbolName } from './catalog.mjs'

const PRINTING_SECTIONS = {
  flyers: 'Флаера, листовки, афиши', booklets: 'Буклеты',
  certificates: 'Дипломы, грамоты, сертификаты, пригласительные', folders: 'Папки',
  'paper-bags': 'Бумажные пакеты', 'digital-printing': 'Цифровая печать',
  'paper-density': 'Печать на бумаге разной плотности'
}

function objectValue(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return null }
}

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е')

export function buildCalculatorSearchItems(pricing) {
  const calculators = buildCalculatorItems()
  const items = calculators.map(item => ({ ...item, kind: 'calculator',
    aliases: item.payload.slug === 'multipage' ? 'журнал журналы' : '',
    unavailableReason: item.payload.slug === 'multipage' ? 'Калькулятор этого раздела пока не подключён' : '',
    payload: { ...item.payload, searchKey: item.id }
  }))
  const root = slug => calculators.find(item => item.payload.slug === slug && item.id.startsWith('cat:'))?.payload
  const add = (source, item, parent, navigation, group, aliases = '') => {
    if (!parent || item.id == null || !item.name) return
    const id = `material:${source}:${item.category || ''}:${item.id}`
    items.push({ id, kind: 'material', label: source === 'flagsProducts' ? item.name.replace(/^Флаг:\s*/, '') : item.name,
      group, aliases, icon: '🔎', payload: { ...parent, catalogSource: source, catalogItemId: String(item.id), ...navigation, searchKey: id } })
  }
  const variant = (source, item, parent, navigation, group, choice, label) => add(source,
    { ...item, id: `${item.id}:${choice.kind}:${choice.value || choice.productId || ''}:${choice.variantId || ''}`, name: `${item.name} · ${label}` },
    parent, { ...navigation, catalogItemId: String(item.id), catalogVariant: choice }, group)

  for (const [category, label] of Object.entries(PRINTING_SECTIONS)) {
    if (!root('printing') || !pricing?.printing?.some(item => item.category === category && item.specification?.section !== 'multipage')) continue
    const id = `printing-section:${category}`
    items.push({ id, kind: 'calculator', label, group: 'Листовая полиграфия', icon: '📄',
      payload: { ...root('printing'), printingCategory: category, searchKey: id } })
  }
  for (const item of pricing?.printing || []) {
    if (!PRINTING_SECTIONS[item.category] || item.specification?.section === 'multipage') continue
    if (/^фольгирование$/i.test(item.name || '')) continue
    add('printing', item, root('printing'), { printingCategory: item.category, printingProductId: String(item.id) },
      `Листовая полиграфия · ${PRINTING_SECTIONS[item.category]}`)
    for (const color of item.colorTypes || []) variant('printing', item, root('printing'),
      { printingCategory: item.category, printingProductId: String(item.id) }, 'Листовая полиграфия · цветность',
      { kind: 'printing-color', value: color.type }, color.type)
  }
  for (const item of pricing?.flagsProducts || []) {
    if (/^прошивка/i.test(item.name || '')) continue
    const section = calculators.find(entry => entry.payload.slug === 'flags-products' && entry.payload.flagsCategory === item.category)
    add('flagsProducts', item, root('flags-products'), { flagsCategory: item.category, flagsItemId: String(item.id) },
      `Готовые изделия · ${section?.label || 'Флаговая продукция'}`, /флаг.*сетка/i.test(item.name) ? 'флажная сетка' : '')
    const prices = objectValue(item.prices)
    const sizes = prices && typeof prices === 'object' ? Object.keys(prices) : []
    for (const size of sizes.filter(value => /^\d+(?:[.,]\d+)?\*\d/.test(value))) variant('flagsProducts', item, root('flags-products'),
      { flagsCategory: item.category, flagsItemId: String(item.id) }, `Готовые изделия · ${section?.label || 'Флаговая продукция'}`,
      { kind: 'flag-size', value: size }, `${size.replace('*', '×')} м`)
  }
  for (const item of pricing?.textile || []) {
    if (item.category === 'service') continue
    add('textile', item, root('textile'), { textileCategory: item.category, textileMaterialId: String(item.id) },
      'Расчёт печати на материале · размеры и тираж', /polytex/i.test(item.name) ? 'политекс' : '')
  }
  for (const item of getEnabledWideFormatMaterials(pricing?.wideFormat)) {
    const section = calculators.find(entry => entry.payload.slug === 'wide-format' && entry.payload.wideGroup === item.category)
    add('wideFormat', item, root('wide-format'), { wideGroup: item.category, wideMaterialId: String(item.id) },
      `Широкоформатная печать · ${section?.label || item.category}`)
  }
  for (const item of pricing?.uvPrinting || []) {
    const section = calculators.find(entry => entry.payload.slug === 'uv-printing' && entry.payload.uvSection === item.category)
    const navigation = { uvSection: item.category }
    const group = `УФ печать · ${section?.label || item.category}`
    add('uvPrinting', item, root('uv-printing'), navigation, group)
    for (const side of item.sides || []) variant('uvPrinting', item, root('uv-printing'), navigation, group,
      { kind: 'uv-side', value: side.type }, side.type)
    for (const material of item.materials || []) variant('uvPrinting', item, root('uv-printing'), navigation, group,
      { kind: 'uv-material', value: material.name }, material.name)
  }
  for (const item of pricing?.businessCards || []) {
    for (const cardType of isBadgeProduct(item) ? ['badges'] : ['business-cards', 'discount-cards']) {
      add('businessCards', { ...item, category: cardType, name: [item.name, item.colorType].filter(Boolean).join(' · ') },
        root('business-cards'), { cardType }, cardType === 'badges' ? 'Бейджи' : cardType === 'discount-cards' ? 'Дисконтные карты' : 'Визитки')
    }
  }
  for (const item of pricing?.stateSymbols || []) {
    if (item.name?.includes('Объемный герб')) continue
    add('stateSymbols', { ...item, name: [getStateSymbolName(item), item.option].filter(Boolean).join(' · ') }, root(item.category), {},
      `Государственная символика · ${root(item.category)?.name || item.category}`)
  }
  for (const item of pricing?.advertisingStands || []) {
    add('advertisingStands', item, root('advertising-stands'), {}, 'Рекламные стенды')
    const labels = { pvx3: 'ПВХ 3 мм', pvx5: 'ПВХ 5 мм', pvx8: 'ПВХ 8 мм' }
    const thicknesses = item.thicknesses?.length ? item.thicknesses
      : Object.keys(objectValue(item.prices) || {}).filter(id => labels[id]).map(id => ({ id, label: labels[id] }))
    for (const thickness of thicknesses) variant('advertisingStands', item, root('advertising-stands'), {}, 'Рекламные стенды',
      { kind: 'stand-thickness', value: thickness.id }, thickness.label)
  }
  const thicknessLabels = { t01_15: '1–1.5 мм', t02_4: '2–4 мм', t05_7: '5–7 мм', t08_10: '8–10 мм', t11_15: '11–15 мм', t16_20: '16–20 мм' }
  for (const item of pricing?.cncLaser || []) {
    const navigation = { cncType: item.category === 'cnc-cut' ? 'milling' : 'engrave' }
    add('cncLaser', item, root('cnc-laser'), navigation, 'Фрезерный и лазерный станок')
    for (const [id, label] of Object.entries(thicknessLabels)) if (item.prices?.[id] != null) variant('cncLaser', item, root('cnc-laser'),
      navigation, 'Фрезерная резка · толщина', { kind: 'cnc-thickness', value: id }, label)
  }
  for (const item of pricing?.plotterCutting || []) add('plotterCutting', { ...item, name: [item.material, item.operation].filter(Boolean).join(' · ') },
    root('plotter-cutting'), { plotterMaterial: item.material }, 'Плоттерная резка · материал и операция')
  const printLabels = { mimaki: 'Mimaki баннер', roland: 'Roland фронтлит', none: 'Без печати' }
  for (const item of pricing?.eventServices || []) {
    const parent = root(item.category === 'specialists' ? 'specialists' : 'event-services')
    const navigation = item.category === 'specialists' ? { specialistsGroup: item.subtype } : { eventCategory: item.category }
    const group = item.category === 'specialists' ? 'Работа специалистов и техники' : 'Мероприятия'
    add('eventServices', item, parent, navigation, group)
    for (const option of Object.keys(item.printOptions || {})) variant('eventServices', item, parent, navigation, group,
      { kind: 'event-print', value: option }, printLabels[option] || option)
  }
  for (const item of pricing?.garmentPrinting || []) {
    add('garmentPrinting', item, root('garment-printing'), {}, 'Брендирование продукции')
    for (const product of item.productOptions || []) {
      variant('garmentPrinting', item, root('garment-printing'), {}, 'Брендирование продукции · изделие',
        { kind: 'garment-product', productId: product.id }, product.name)
      for (const choice of product.variants || []) variant('garmentPrinting', item, root('garment-printing'), {}, 'Брендирование продукции · вариант',
        { kind: 'garment-variant', productId: product.id, variantId: choice.id }, `${product.name} · ${choice.name}`)
    }
  }
  for (const item of pricing?.embroidery || []) add('embroidery', item, root('embroidery'), {}, 'Вышивка')
  for (const item of pricing?.additionalServices || []) add('additionalServices', item, root('additional-services'), {}, `Дополнительные услуги · ${item.category || ''}`)
  return items
}

export function searchCalculatorItems(items, query) {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return items.filter(item => item.kind === 'calculator')
  return items.filter(item => {
    const haystack = normalize(`${item.label} ${item.group} ${item.description || ''} ${item.aliases || ''}`)
    return tokens.every(token => haystack.includes(token))
  }).sort((a, b) => {
    const starts = item => normalize(item.label).startsWith(tokens[0]) ? 0 : 1
    return starts(a) - starts(b) || (a.kind === 'calculator' ? 0 : 1) - (b.kind === 'calculator' ? 0 : 1)
      || a.label.localeCompare(b.label, 'ru') || a.group.localeCompare(b.group, 'ru')
  })
}
