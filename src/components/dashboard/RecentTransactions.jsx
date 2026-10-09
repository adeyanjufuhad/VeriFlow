import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDate.js'
import Badge from '../ui/Badge.jsx'
import Card from '../ui/Card.jsx'
import EmptyState from '../ui/EmptyState.jsx'

function verificationTone(status) {
  if (status === 'Verified') return 'success'
  if (status === 'Under review') return 'warning'
  return 'neutral'
}

function riskTone(indicator) {
  if (indicator === 'None noted') return 'neutral'
  if (indicator === 'Received late') return 'warning'
  return 'danger'
}

export default function RecentTransactions({ transactions: records }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Recent transactions</h2>
          <p className="mt-1 text-[11px] text-[#6B7280]">Illustrative business records · most recent first</p>
        </div>
        <Link to="/transactions" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
          View all <ExternalLink size={12} aria-hidden="true" />
        </Link>
      </div>
      {records.length === 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <EmptyState title="No transactions to display" description="There are no illustrative transaction records available." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[870px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[#E5E7EB] bg-[#FAFAFA] text-[10px] font-medium text-[#6B7280]">
                <th className="px-4 py-2.5 font-medium sm:px-5">Transaction reference</th>
                <th className="px-3 py-2.5 font-medium">Business</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Date &amp; time</th>
                <th className="px-3 py-2.5 font-medium">Verification</th>
                <th className="px-3 py-2.5 font-medium">Risk indicator</th>
              </tr>
            </thead>
            <tbody>
              {records.map((transaction) => (
                <tr key={transaction.id} className="border-b border-[#F3F4F6] text-[11px] last:border-b-0 hover:bg-[#FAFAFA]">
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                    <Link to={`/transactions/${transaction.id}`} className="font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]" aria-label={`View transaction ${transaction.reference}`}>
                      {transaction.reference}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 font-medium text-[#374151]">{transaction.business}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#4B5563]">{transaction.type}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums ${transaction.amount < 0 ? 'text-[#4B5563]' : 'text-[#171717]'}`}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#6B7280]">{formatDateTime(transaction.occurredAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Badge tone={verificationTone(transaction.verificationStatus)}>{transaction.verificationStatus}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Badge tone={riskTone(transaction.riskIndicator)}>{transaction.riskIndicator}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4 py-3 text-[10px] text-[#6B7280] sm:px-5">
        Sample rows only. A risk indicator is a review prompt, not a confirmed fraud finding.
      </p>
    </Card>
  )
}
