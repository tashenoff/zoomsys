import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightOnRectangleIcon, Bars3Icon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import { usePricing } from '../hooks/usePricing'
import { buildCalculatorItems, buildPageItems, filterCalculatorItems, filterPages } from '../lib/navCatalog'
import { searchPriceHits } from '../lib/priceSearch'

const PRICE_HIT_LIMIT = 8

function roleLabel(role) {
  if (role === 'admin') return '👑 Администратор'
  if (role === 'manager') return '📊 Менеджер'
  return '👤 Пользователь'
}

export default function TopNavbar({ onOpenMenu, onLogout, onSelectView, onSelectCategory, onSearchPrices }) {
  const { user } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const displayName = user?.fullName || 'Пользователь'

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="md:hidden shrink-0 p-2 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Меню"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0 max-w-2xl px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-400 hover:border-gray-400 text-left"
          >
            <MagnifyingGlassIcon className="w-4 h-4 shrink-0" />
            <span className="truncate sm:hidden">Поиск…</span>
            <span className="truncate hidden sm:inline">Поиск калькуляторов и прайса…</span>
            <kbd className="hidden lg:inline ml-auto text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Ctrl+K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2 md:gap-3 min-w-0">
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-800 truncate max-w-[7rem] sm:max-w-[12rem]" title={displayName}>
                {displayName}
              </p>
              <p className="hidden md:block text-xs text-gray-500">{roleLabel(user?.role)}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Выход"
              aria-label="Выход"
              className="shrink-0 p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {searchOpen && (
        <GlobalSearchPalette
          onClose={() => setSearchOpen(false)}
          onSelectView={onSelectView}
          onSelectCategory={onSelectCategory}
          onSearchPrices={onSearchPrices}
        />
      )}
    </>
  )
}

function GlobalSearchPalette({ onClose, onSelectView, onSelectCategory, onSearchPrices }) {
  const { hasPermission } = useAuth()
  const { pricing, loading } = usePricing()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const canEditPricing = hasPermission('editPricing')

  const calculatorItems = useMemo(() => buildCalculatorItems(), [])
  const pages = useMemo(() => buildPageItems(hasPermission), [hasPermission])

  const pageResults = useMemo(() => filterPages(pages, query), [pages, query])
  const calculatorResults = useMemo(() => filterCalculatorItems(calculatorItems, query), [calculatorItems, query])
  const priceResults = useMemo(() => {
    if (!canEditPricing || !query.trim()) return { total: 0, hits: [] }
    return searchPriceHits(pricing, query, PRICE_HIT_LIMIT)
  }, [canEditPricing, pricing, query])

  const entries = useMemo(() => {
    const list = []
    for (const page of pageResults) {
      list.push({ type: 'view', id: page.id, view: page.view, icon: page.icon, label: page.label, hint: 'Страница', section: 'Страницы' })
    }
    for (const item of calculatorResults) {
      list.push({
        type: 'calculator',
        id: item.id,
        icon: item.icon,
        label: item.label,
        hint: item.group,
        payload: item.payload,
        section: 'Разделы'
      })
    }
    if (canEditPricing && query.trim()) {
      if (priceResults.total > 0) {
        list.push({
          type: 'price-all',
          id: 'price-all',
          icon: '🔍',
          label: `Все позиции прайса по запросу «${query.trim()}»`,
          hint: `Найдено: ${priceResults.total}`,
          query: query.trim(),
          section: 'Позиции прайса'
        })
      }
      for (const hit of priceResults.hits) {
        list.push({
          type: 'price',
          id: hit.id,
          icon: '💰',
          label: hit.label,
          hint: hit.hint,
          query: query.trim(),
          focusId: hit.focusId,
          section: 'Позиции прайса'
        })
      }
    }
    return list
  }, [pageResults, calculatorResults, canEditPricing, priceResults, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-result-index="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const selectEntry = (entry) => {
    if (!entry) return
    if (entry.type === 'view') onSelectView(entry.view)
    if (entry.type === 'calculator') onSelectCategory(entry.payload)
    if (entry.type === 'price' || entry.type === 'price-all') {
      onSearchPrices({ query: entry.query, focusId: entry.focusId || null })
    }
    onClose()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (!entries.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(index => Math.min(index + 1, entries.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectEntry(entries[active])
    }
  }

  let lastSection = null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[8vh] md:p-6 md:pt-[12vh]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть поиск" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Поиск"
        className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-gray-200">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск по разделам и позициям прайса (название, категория)…"
            className="flex-1 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            aria-label="Поиск по разделам и позициям прайса"
            aria-activedescendant={entries[active] ? `search-result-${active}` : undefined}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 px-1 text-xl" title="Очистить поиск">
              ✕
            </button>
          )}
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2" role="listbox" aria-label="Результаты поиска">
          {entries.length === 0 && !(canEditPricing && query.trim() && loading) && (
            <div className="text-sm text-gray-500 px-3 py-8 text-center italic">Ничего не найдено</div>
          )}

          {entries.map((entry, index) => {
            const showSection = entry.section !== lastSection
            lastSection = entry.section
            const selected = index === active
            return (
              <div key={entry.id}>
                {showSection && (
                  <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-500">{entry.section}</div>
                )}
                <button
                  id={`search-result-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-result-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => selectEntry(entry)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition text-sm flex items-center gap-3 ${
                    selected ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg shrink-0 w-6 text-center">{entry.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{entry.label}</span>
                    {entry.hint && (
                      <span className={`block text-xs truncate ${selected ? 'text-blue-100' : 'text-gray-500'}`}>{entry.hint}</span>
                    )}
                  </span>
                </button>
              </div>
            )
          })}

          {canEditPricing && query.trim() && loading && (
            <div className="px-3 py-3 text-sm text-gray-500">Загрузка прайса…</div>
          )}
          {canEditPricing && query.trim() && !loading && priceResults.total > priceResults.hits.length && (
            <div className="px-3 py-2 text-xs text-gray-400">
              Показаны первые {priceResults.hits.length} из {priceResults.total}
            </div>
          )}
          {canEditPricing && !query.trim() && (
            <div className="px-3 py-3 text-xs text-gray-400">Введите название или категорию, чтобы найти позицию прайса</div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-400 flex justify-between gap-3">
          <span>↑↓ выбор · Enter открыть</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </div>
  )
}
