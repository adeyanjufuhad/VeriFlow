import { ArrowRight, Clock3, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge.jsx'
import Card from '../ui/Card.jsx'
import EmptyState from '../ui/EmptyState.jsx'

function priorityTone(priority) {
  if (priority === 'High') return 'danger'
  if (priority === 'Medium') return 'warning'
  return 'neutral'
}

export default function RiskAlerts({ alerts, totalOpen }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Risk alerts</h2>
          <p className="mt-1 text-[11px] text-[#6B7280]">Items requiring an authorized reviewer’s attention</p>
        </div>
        <Badge tone="warning">{totalOpen} open</Badge>
      </div>
      {alerts.length === 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <EmptyState title="No open review items" description="New illustrative review prompts will appear here when available." />
        </div>
      ) : (
        <ul className="divide-y divide-[#F3F4F6]">
          {alerts.map((alert) => (
            <li key={alert.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-[#FFF7ED] text-[#D97706]">
                  <ShieldAlert size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-medium text-[#171717]">{alert.title}</h3>
                    <Badge tone={priorityTone(alert.priority)}>{alert.priority} priority</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6B7280]">{alert.business}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#6B7280]">
                    <span className="inline-flex items-center gap-1"><Clock3 size={12} aria-hidden="true" />{alert.status}</span>
                    <Link to={`/transactions/${alert.transactionId}`} className="inline-flex items-center gap-1 font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
                      {alert.nextAction}<ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3 sm:px-5">
        <p className="text-[10px] text-[#6B7280]">Showing {alerts.length} of {totalOpen} illustrative open alerts</p>
        <Link to="/fraud-risk" className="shrink-0 text-[10px] font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
          Review alerts
        </Link>
      </div>
    </Card>
  )
}
