import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header.jsx'
import MobileSidebar from './MobileSidebar.jsx'
import Sidebar from './Sidebar.jsx'

const pageDetails = {
  '/command-center': [
    'Command Center',
    'Review verified business activity, financing exposure, repayment performance, and emerging risk indicators.',
  ],
  '/customers': ['Customers', 'Business records for authorized review'],
  '/credit-intelligence': ['Credit Intelligence', 'Illustrative financing and repayment information'],
  '/transactions': ['Transactions', 'Recorded business activity for review'],
  '/fraud-risk': ['Fraud & Risk', 'Unusual activity indicators requiring review'],
  '/insights': ['Insights', 'Illustrative portfolio observations'],
  '/ai-command': ['AI Command', 'AI-assisted review tools'],
  '/settings': ['Settings', 'Workspace preferences'],
  '/help': ['Help & Support', 'Guidance for using VeriFlow'],
}

export default function DashboardLayout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const closeMobileNavigation = useCallback(() => setMobileNavigationOpen(false), [])
  const openMobileNavigation = useCallback(() => setMobileNavigationOpen(true), [])
  const page = pageDetails[location.pathname] ?? [
    location.pathname.startsWith('/customers/') ? 'Customer Profile' :
      location.pathname.startsWith('/transactions/') ? 'Transaction Details' :
        location.pathname.startsWith('/credit-intelligence/') ? 'Credit Analysis' :
          location.pathname.startsWith('/fraud-risk/') ? 'Risk Investigation' : 'VeriFlow',
    'Illustrative workspace',
  ]

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#171717]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-[#8E1B1B] focus:shadow-md"
      >
        Skip to main content
      </a>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <MobileSidebar
        open={mobileNavigationOpen}
        onClose={closeMobileNavigation}
      />
      <div className={`min-h-screen transition-[margin] duration-200 ${sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[252px]'}`}>
        <Header
          title={page[0]}
          description={page[1]}
          onOpenNavigation={openMobileNavigation}
        />
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <div id="main-content" tabIndex={-1}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
