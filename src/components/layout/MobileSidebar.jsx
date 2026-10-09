import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavigationContent } from './Sidebar.jsx'

export default function MobileSidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className="relative flex h-full w-[min(84vw,300px)] flex-col overflow-y-auto bg-[#151719] px-3 py-6 shadow-xl"
      >
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-md text-white/75 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close navigation"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <NavigationContent
          onNavigate={onClose}
        />
      </aside>
    </div>,
    document.body,
  )
}
