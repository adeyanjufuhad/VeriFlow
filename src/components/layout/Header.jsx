import { Bell, ChevronDown, Menu, Search, Settings, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSampleNotifications } from '../../services/dashboard.service.js'
import { searchIllustrativeRecords } from '../../services/search.service.js'

function Panel({ children, className = '' }) {
  return (
    <div className={`absolute right-0 top-[calc(100%+10px)] z-40 w-[min(90vw,360px)] rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-lg ${className}`}>
      {children}
    </div>
  )
}

export default function Header({ title, description, onOpenNavigation }) {
  const [query, setQuery] = useState('')
  const [activePanel, setActivePanel] = useState(null)
  const searchResults = useMemo(() => searchIllustrativeRecords(query), [query])
  const notifications = getSampleNotifications()
  const searchOpen = query.trim().length > 0 && activePanel === 'search'

  return (
    <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
      <div className="flex min-h-[76px] flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-0 lg:gap-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenNavigation}
          className="grid size-9 shrink-0 place-items-center rounded-md text-[#6B7280] hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-[-0.02em] text-[#171717] sm:text-lg">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-xl truncate text-xs text-[#6B7280] sm:block">
            {description}
          </p>
        </div>

        <div className="relative order-3 w-full basis-full sm:order-none sm:ml-auto sm:max-w-[290px] sm:basis-auto">
          <label className="sr-only" htmlFor="global-search">Search illustrative records</label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 transition focus-within:border-[#C62828] focus-within:ring-2 focus-within:ring-[#C62828]/15">
            <Search size={15} className="shrink-0 text-[#6B7280]" aria-hidden="true" />
            <input
              id="global-search"
              type="search"
              value={query}
              onFocus={() => setActivePanel('search')}
              onChange={(event) => {
                setQuery(event.target.value)
                setActivePanel('search')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActivePanel(null)
              }}
              aria-expanded={searchOpen}
              aria-controls="global-search-results"
              placeholder="Search businesses or references"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#171717] outline-none placeholder:text-[#9CA3AF]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActivePanel(null)
                }}
                aria-label="Clear search"
                className="grid size-6 place-items-center rounded text-[#6B7280] hover:bg-[#E5E7EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {searchOpen && (
            <Panel className="left-0 right-auto">
              <div id="global-search-results" aria-live="polite">
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  Illustrative records
                </p>
                {searchResults.length ? (
                  <ul className="max-h-72 overflow-y-auto">
                    {searchResults.map((result) => (
                      <li key={result.id}>
                        <Link
                          to={result.to}
                          onClick={() => {
                            setQuery('')
                            setActivePanel(null)
                          }}
                          className="block rounded-md px-3 py-2.5 hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
                        >
                          <span className="block truncate text-xs font-medium text-[#171717]">{result.title}</span>
                          <span className="mt-1 block truncate text-[11px] text-[#6B7280]">{result.detail}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-3 text-xs text-[#6B7280]">No matching sample records found.</p>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="relative order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none sm:ml-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'notifications' ? null : 'notifications')}
              className="relative grid size-9 place-items-center rounded-md text-[#6B7280] hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
              aria-label="Notifications, 3 illustrative items"
              aria-expanded={activePanel === 'notifications'}
            >
              <Bell size={17} aria-hidden="true" />
              <span className="absolute right-[7px] top-[7px] size-2 rounded-full bg-[#C62828]" />
            </button>
            {activePanel === 'notifications' && (
              <Panel>
                <div className="flex items-center justify-between px-3 py-2">
                  <h2 className="text-xs font-semibold text-[#171717]">Notifications</h2>
                  <span className="text-[10px] text-[#6B7280]">Illustrative</span>
                </div>
                <ul>
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <Link
                        to={notification.to}
                        onClick={() => setActivePanel(null)}
                        className="block rounded-md px-3 py-2.5 hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
                      >
                        <span className="block text-xs font-medium text-[#171717]">{notification.title}</span>
                        <span className="mt-1 block text-[11px] text-[#6B7280]">{notification.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'profile' ? null : 'profile')}
              className="flex min-h-9 items-center gap-2 rounded-md px-1.5 text-left hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
              aria-expanded={activePanel === 'profile'}
              aria-label="Open reviewer profile menu"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#FCE8E8] text-[11px] font-semibold text-[#8E1B1B]">PR</span>
              <span className="hidden text-xs font-medium text-[#171717] xl:block">Portfolio reviewer</span>
              <ChevronDown size={14} className="hidden text-[#6B7280] xl:block" aria-hidden="true" />
            </button>
            {activePanel === 'profile' && (
              <Panel className="w-56">
                <p className="px-3 py-2 text-xs font-medium text-[#171717]">Portfolio reviewer</p>
                <p className="px-3 pb-2 text-[11px] text-[#6B7280]">Illustrative workspace</p>
                <Link
                  to="/settings"
                  onClick={() => setActivePanel(null)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-[#374151] hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
                >
                  <Settings size={14} aria-hidden="true" />
                  Workspace settings
                </Link>
                <Link
                  to="/help"
                  onClick={() => setActivePanel(null)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-[#374151] hover:bg-[#F6F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
                >
                  <UserRound size={14} aria-hidden="true" />
                  Help &amp; support
                </Link>
              </Panel>
            )}
          </div>
        </div>
      </div>
      <p className="border-t border-[#F3F4F6] px-4 py-2 text-[10px] text-[#6B7280] sm:hidden">
        {description}
      </p>
    </header>
  )
}
