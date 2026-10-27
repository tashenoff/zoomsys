import { catalogConfig, getEnabledWideFormatMaterials } from './catalog.mjs'

const PRINTING_CATEGORY_LABELS = {
  flyers: 'Флаера, листовки, афиши',
  booklets: 'Буклеты',
  certificates: 'Дипломы, грамоты, сертификаты',
  notebooks: 'Многостраничная продукция — Блокноты',
  folders: 'Папки',
  'paper-bags': 'Бумажные пакеты',
  'digital-printing': 'Цифровая печать',
  'paper-density': 'Печать разной плотности'
}

const UV_CATEGORY_LABELS = {
  pens: 'Ручки',
  cards: ['Карты / визитки', 'Флеш-карты, пластиковые карты'],
  promotional: 'Промо-продукция',
  notebooks: ['Блокноты / ежедневники', 'Блокноты (логотип)'],
  'notebooks-image': 'Блокноты (изображение)',
  materials: 'На материалах',
  other: 'Прочие материалы'
}

const WIDE_FORMAT_CATEGORY_LABELS = {
  phaeton: 'Phaeton UD-3208P',
  mimaki: 'MIMAKI SWJ-320 S4',
  roland: 'Roland VS-640 + плоттер',
  other: 'Прочее'
}

const TEXTILE_CATEGORY_LABELS = {
  sublimation: 'Сублимация',
  direct: 'Прямая печать',
  mesh: 'Сетки',
  service: 'Услуги'
}

const FLAGS_CATEGORY_LABELS = {
  'flags-size': ['Флаги/знамена', 'Флаги и знамена (по размеру)'],
  'desk-flags': ['Настольные', 'Настольные флаги'],
  'auto-flags': ['Автофлаги', 'Автомобильные флаги'],
  ribbons: ['Ленты', 'Наградные ленты'],
  scarves: 'Шарфы',
  other: ['Другое', 'Вымпелы, шевроны и другое']
}

const EVENT_CATEGORY_LABELS = {
  mobile: 'Мобильные конструкции',
  rent: 'Аренда',
  specialists: 'Специалисты/техника'
}

const CNC_CATEGORY_LABELS = {
  'cnc-cut': 'Резка',
  'cnc-engrave': 'Гравировка',
  milling: 'Резка',
  engrave: 'Гравировка'
}

const STATE_SYMBOL_LABELS = {
  'coat-of-arms': 'Герб',
  'flags-rk': 'Флаги РК',
  flagpoles: 'Флагштоки',
  signs: catalogConfig.displayNames.signs,
  stands: 'Стенды',
  'president-portrait': 'Портрет президента'
}

const SOURCES = [
  { key: 'businessCards', title: '💼 Визитки', plainTitle: 'Визитки', get: (pricing) => pricing.businessCards },
  { key: 'printing', title: '📄 Полиграфия', plainTitle: 'Полиграфия', get: (pricing) => pricing.printing, labels: PRINTING_CATEGORY_LABELS },
  { key: 'uvPrinting', title: '🖨️ УФ печать', plainTitle: 'УФ печать', get: (pricing) => pricing.uvPrinting, labels: UV_CATEGORY_LABELS },
  {
    key: 'wideFormat',
    title: '🖼️ Широкоформат',
    plainTitle: 'Широкоформат',
    get: (pricing) => getEnabledWideFormatMaterials(pricing.wideFormat),
    labels: WIDE_FORMAT_CATEGORY_LABELS
  },
  { key: 'stateSymbols', title: '🇰🇿 Государственная символика', plainTitle: 'Государственная символика', get: (pricing) => pricing.stateSymbols, labels: STATE_SYMBOL_LABELS },
  { key: 'textile', title: '🧵 Текстиль', plainTitle: 'Текстиль', get: (pricing) => pricing.textile, labels: TEXTILE_CATEGORY_LABELS },
  { key: 'flagsProducts', title: '🚩 Готовая продукция', plainTitle: 'Готовая продукция', get: (pricing) => pricing.flagsProducts, labels: FLAGS_CATEGORY_LABELS },
  { key: 'advertisingStands', title: '🪧 Рекламные стенды', plainTitle: 'Рекламные стенды', get: (pricing) => pricing.advertisingStands },
  { key: 'cncLaser', title: '🪚 Фрезер/лазер', plainTitle: 'Фрезер/лазер', get: (pricing) => pricing.cncLaser, labels: CNC_CATEGORY_LABELS },
  { key: 'plotterCutting', title: '✂️ Плоттерная резка', plainTitle: 'Плоттерная резка', get: (pricing) => pricing.plotterCutting },
  { key: 'eventServices', title: '🎤 Мероприятия', plainTitle: 'Мероприятия', get: (pricing) => pricing.eventServices, labels: EVENT_CATEGORY_LABELS },
  { key: 'garmentPrinting', title: `👕 ${catalogConfig.displayNames['garment-printing']}`, plainTitle: catalogConfig.displayNames['garment-printing'], get: (pricing) => pricing.garmentPrinting },
  { key: 'embroidery', title: '🧵 Вышивка', plainTitle: 'Вышивка', get: (pricing) => pricing.embroidery },
  { key: 'additionalOperations', title: '⚙️ Доп. операции', plainTitle: 'Доп. операции', get: operationsOf },
  { key: 'additionalServices', title: '➕ Доп. услуги', plainTitle: 'Доп. услуги', get: (pricing) => pricing.additionalServices }
]

function operationsOf(pricing) {
  const ops = pricing?.additionalOperations
  if (!ops) return []
  return Array.isArray(ops) ? ops : Object.values(ops)
}

function asLabelList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function tokensOf(query) {
  return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function itemHaystack(item, labels) {
  const categoryLabels = [
    ...asLabelList(labels?.[item?.category]),
    ...asLabelList(labels?.[item?.type])
  ]
  return [
    item?.name,
    item?.colorType,
    item?.category,
    item?.option,
    item?.description,
    item?.unit,
    item?.material,
    item?.operation,
    item?.type,
    item?.notes,
    item?.note,
    item?.priceText,
    ...categoryLabels
  ].map(value => String(value ?? '').toLowerCase()).join(' ')
}

function itemMatches(item, tokens, labels) {
  const hay = itemHaystack(item, labels)
  return tokens.every(token => hay.includes(token))
}

export function collectPriceMatches(pricing, query) {
  const tokens = tokensOf(query)
  if (!tokens.length || !pricing) return { groups: [], total: 0 }

  const groups = []
  for (const source of SOURCES) {
    const items = (source.get(pricing) || []).filter(item => itemMatches(item, tokens, source.labels))
    if (items.length) {
      groups.push({
        key: source.key,
        title: source.title,
        plainTitle: source.plainTitle,
        items
      })
    }
  }

  const total = groups.reduce((sum, group) => sum + group.items.length, 0)
  return { groups, total }
}

function hitLabel(key, item) {
  if (key === 'plotterCutting') return item.material || item.operation || 'Плоттерная резка'
  return item.name || item.material || item.operation || 'Без названия'
}

function hitDetail(key, item, labels) {
  if (key === 'plotterCutting') return item.operation || ''
  const fromCategory = asLabelList(labels?.[item?.category])[0] || asLabelList(labels?.[item?.type])[0]
  return fromCategory || item?.colorType || item?.option || item?.material || ''
}

export function searchPriceHits(pricing, query, limit = 8) {
  const { groups, total } = collectPriceMatches(pricing, query)
  const hits = []
  for (const group of groups) {
    const source = SOURCES.find(item => item.key === group.key)
    for (const item of group.items) {
      const detail = hitDetail(group.key, item, source?.labels)
      hits.push({
        id: `${group.key}:${item.id}`,
        focusId: item.id,
        tab: group.key,
        label: hitLabel(group.key, item),
        hint: [group.plainTitle, detail].filter(Boolean).join(' · ')
      })
    }
  }
  hits.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  return { total, hits: hits.slice(0, limit) }
}
