import pricingData from '../data/pricing.json' with { type: 'json' }
import { getDisplayCategories, isWideFormatGroupEnabled } from './catalog.mjs'

// Разделы, которые сайдбар открывает внутри калькуляторов.
// Глобальный поиск использует те же payload, что и клики по подпунктам меню.

export const UV_SECTIONS = [
  { id: 'pens', name: 'Ручки', icon: '🖊️' },
  { id: 'cards', name: 'Флеш-карты, пластиковые карты', icon: '💳' },
  { id: 'promotional', name: 'Промо-продукция', icon: '🎁' },
  { id: 'notebooks', name: 'Блокноты (логотип)', icon: '📔' },
  { id: 'notebooks-image', name: 'Блокноты (изображение)', icon: '📓' },
  { id: 'materials', name: 'На материалах', icon: '🎨' }
]

export const WIDE_GROUPS = [
  { id: 'phaeton', name: 'Phaeton UD-3208P', icon: '🖨️' },
  { id: 'mimaki', name: 'MIMAKI SWJ-320 S4', icon: '🖨️' },
  { id: 'roland', name: 'Roland VS-640 + плоттер', icon: '✂️' }
].filter(group => isWideFormatGroupEnabled(group.id))

export const TEXTILE_CATEGORIES = [
  { id: 'sublimation', name: 'Сублимация', icon: '🖨️' },
  { id: 'direct', name: 'Прямая печать', icon: '🖨️' },
  { id: 'mesh', name: 'Сетки', icon: '🧵' },
  { id: 'service', name: 'Услуги', icon: '🧰' }
]

export const FLAG_CATEGORIES = [
  { id: 'flags-size', name: 'Флаги и знамена (по размеру)', icon: '🚩' },
  { id: 'desk-flags', name: 'Настольные флаги', icon: '🚩' },
  { id: 'auto-flags', name: 'Автомобильные флаги', icon: '🚗' },
  { id: 'ribbons', name: 'Наградные ленты', icon: '🎗️' },
  { id: 'scarves', name: 'Шарфы', icon: '🧣' },
  { id: 'other', name: 'Вымпелы, шевроны и другое', icon: '🧨' }
]

export const PLOTTER_MATERIALS = [
  { id: 'Цветная самоклеящаяся плёнка', name: 'Цветная плёнка', icon: '🎨' },
  { id: 'Металлизированная самоклеящаяся плёнка', name: 'Металлизированная плёнка', icon: '✨' }
]

export const CNC_TYPES = [
  { id: 'milling', name: 'Резка', icon: '🪚' },
  { id: 'engrave', name: 'Гравировка', icon: '🖋️' }
]

export const SPECIALIST_GROUPS = [
  { id: 'mount', name: 'Монтаж и выезд', icon: '🪜' },
  { id: 'work', name: 'Работа специалистов', icon: '🔧' },
  { id: 'transport', name: 'Транспорт', icon: '🚚' },
  { id: 'agp', name: 'АГП', icon: '🏗️' }
]

export const EVENT_GROUPS = [
  { id: 'mobile', name: 'Мобильные конструкции', icon: '🖼️' },
  { id: 'rent', name: 'Аренда для мероприятий', icon: '🎤' }
]

const ICONS = {
  'business-cards': '💼',
  printing: '📄',
  multipage: '📚',
  'uv-printing': '🖨️',
  'coat-of-arms': '🛡️',
  'flags-rk': '🚩',
  flagpoles: '🎏',
  signs: '🪧',
  stands: '📰',
  'president-portrait': '🖼️',
  'wide-format': '🖼️',
  'plotter-cutting': '✂️',
  'cnc-laser': '🪚',
  'advertising-stands': '🪧',
  'flags-products': '🚩',
  textile: '🧵',
  'garment-printing': '👕',
  embroidery: '🧵',
  'additional-services': '🧩',
  'event-services': '🎪',
  specialists: '🔧'
}

function pushSection(items, parent, section, payload) {
  items.push({
    id: `${parent.slug || parent.id}:${section.id}`,
    label: section.name,
    group: parent.name,
    description: '',
    icon: section.icon || '📋',
    payload
  })
}

function appendNestedSections(items, category) {
  if (category.slug === 'wide-format') {
    for (const group of WIDE_GROUPS) {
      pushSection(items, category, group, { ...category, wideGroup: group.id })
    }
  }
  if (category.slug === 'textile') {
    for (const section of TEXTILE_CATEGORIES) {
      pushSection(items, category, section, { ...category, textileCategory: section.id })
    }
  }
  if (category.slug === 'flags-products') {
    for (const section of FLAG_CATEGORIES) {
      pushSection(items, category, section, { ...category, flagsCategory: section.id })
    }
  }
  if (category.slug === 'plotter-cutting') {
    for (const material of PLOTTER_MATERIALS) {
      pushSection(items, category, material, { ...category, plotterMaterial: material.id })
    }
  }
  if (category.slug === 'cnc-laser') {
    for (const type of CNC_TYPES) {
      pushSection(items, category, type, { ...category, cncType: type.id })
    }
  }
  if (category.slug === 'event-services') {
    for (const group of EVENT_GROUPS) {
      pushSection(items, category, group, { ...category, eventCategory: group.id })
    }
  }
}

export function buildCalculatorItems(categories = getDisplayCategories(pricingData.categories)) {
  const items = []

  for (const category of categories) {
    if (category.subcategories) {
      for (const sub of category.subcategories) {
        items.push({
          id: `cat:${sub.id}`,
          label: sub.name,
          group: category.name,
          description: sub.description || '',
          icon: ICONS[sub.slug] || '📋',
          payload: sub
        })
        if (sub.slug === 'uv-printing') {
          for (const section of UV_SECTIONS) {
            pushSection(items, { ...sub, description: sub.description }, section, { ...sub, uvSection: section.id })
          }
        }
      }
      continue
    }

    items.push({
      id: `cat:${category.id}`,
      label: category.name,
      group: 'Разделы',
      description: category.description || '',
      icon: ICONS[category.slug] || category.icon || '🧾',
      payload: category
    })
    appendNestedSections(items, category)
  }

  const specialists = {
    id: 'specialists',
    name: 'Работа специалистов и техники',
    slug: 'specialists',
    description: 'Монтаж, техника, транспорт, АГП'
  }
  items.push({
    id: 'cat:specialists',
    label: specialists.name,
    group: 'Разделы',
    description: specialists.description,
    icon: '🔧',
    payload: specialists
  })
  for (const group of SPECIALIST_GROUPS) {
    pushSection(items, specialists, group, { ...specialists, specialistsGroup: group.id })
  }

  return items
}

export function buildPageItems(hasPermission) {
  const pages = [
    { id: 'view:home', view: 'home', label: 'Главная', icon: '🏠', keywords: 'главная дашборд' }
  ]
  if (hasPermission?.('viewOrders')) {
    pages.push({ id: 'view:orders', view: 'orders', label: 'Заказы', icon: '📋', keywords: 'заказы' })
  }
  if (hasPermission?.('manageUsers')) {
    pages.push({ id: 'view:users', view: 'users', label: 'Пользователи', icon: '👥', keywords: 'пользователи' })
  }
  if (hasPermission?.('editPricing')) {
    pages.push({ id: 'view:pricing', view: 'pricing', label: 'Прайсы', icon: '💰', keywords: 'прайсы цены' })
  }
  return pages
}

function tokensOf(query) {
  return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function haystackIncludes(haystack, tokens) {
  const hay = haystack.toLowerCase()
  return tokens.every(token => hay.includes(token))
}

export function filterPages(pages, query) {
  const tokens = tokensOf(query)
  if (!tokens.length) return pages
  return pages.filter(page => haystackIncludes(`${page.label} ${page.keywords || ''}`, tokens))
}

export function filterCalculatorItems(items, query) {
  const tokens = tokensOf(query)
  if (!tokens.length) return items
  const list = items.filter(item => haystackIncludes(`${item.label} ${item.group} ${item.description || ''}`, tokens))
  return [...list].sort((a, b) => {
    if (tokens.length) {
      const aStarts = a.label.toLowerCase().startsWith(tokens[0]) ? 0 : 1
      const bStarts = b.label.toLowerCase().startsWith(tokens[0]) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
    }
    return a.label.localeCompare(b.label, 'ru')
  })
}
