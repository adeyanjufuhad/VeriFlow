import {
  Activity,
  ChevronLeft,
  CircleHelp,
  CreditCard,
  Gauge,
  Lightbulb,
  SearchCheck,
  Settings,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigationGroups = [
  {
    label: 'Overview',
    items: [{ label: 'Command Center', to: '/command-center', icon: Gauge }],
  },
  {
    label: 'Business',
    items: [
      { label: 'Customers', to: '/customers', icon: UsersRound },
      { label: 'Credit Intelligence', to: '/credit-intelligence', icon: SearchCheck },
      { label: 'Transactions', to: '/transactions', icon: Activity },
    ],
  },
  {
    label: 'Risk & Insights',
    items: [
      { label: 'Fraud & Risk', to: '/fraud-risk', icon: ShieldAlert },
      { label: 'Insights', to: '/insights', icon: Lightbulb },
      { label: 'AI Command', to: '/ai-command', icon: CreditCard },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Help & Support', to: '/help', icon: CircleHelp },
    ],
  },
]

export function NavigationContent({ collapsed = false, onNavigate }) {
  return (
    <>
      <NavLink
        to="/command-center"
        className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        onClick={onNavigate}
        aria-label="VeriFlow Command Center"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#C62828] text-sm font-bold text-white">
          VF
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-[0.12em] text-white">VERIFLOW</span>
            <span className="mt-1 block text-[11px] leading-4 text-white/60">
              Business intelligence for better-informed banking decisions.
            </span>
          </span>
        )}
      </NavLink>

      <nav aria-label="Primary navigation" className="space-y-6">
        {navigationGroups.map((group) => (
          <section key={group.label}>
            {!collapsed && (
              <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                {group.label}
              </h2>
            )}
            <ul className="space-y-1">
              {group.items.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                        isActive
                          ? 'bg-white/10 font-medium text-white ring-1 ring-inset ring-white/10'
                          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                      } ${collapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </>
  )
}

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-[#151719] px-3 py-6 lg:flex ${collapsed ? 'w-[76px]' : 'w-[252px]'}`}>
      <NavigationContent collapsed={collapsed} />
      <div className="mt-auto border-t border-white/10 pt-4">
        {!collapsed && (
          <p className="px-3 text-[11px] leading-5 text-white/40">
            Illustrative workspace
            <br />
            Not connected to a live banking system
          </p>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={`mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md text-xs text-white/65 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${collapsed ? '' : 'px-3'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={16} className={collapsed ? 'rotate-180' : ''} aria-hidden="true" />
          {!collapsed && 'Collapse sidebar'}
        </button>
      </div>
    </aside>
  )
}
