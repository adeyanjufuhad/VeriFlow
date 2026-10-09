import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getTransactionById } from '../services/transactions.service.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDate.js'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'

function getVerificationTone(status) {
  if (status === 'Verified') return 'success'
  if (status === 'Under review') return 'warning'
  return 'neutral'
}

export default function TransactionDetails() {
  const { transactionId } = useParams()
  const transaction = getTransactionById(transactionId)

  if (!transaction) {
    return (
      <main className="space-y-4">
        <Link to="/transactions" className="inline-flex items-center gap-2 text-xs font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
          <ArrowLeft size={14} aria-hidden="true" /> Back to transactions
        </Link>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[#171717]">Transaction not found</h2>
          <p className="mt-2 text-xs text-[#6B7280]">No illustrative transaction record matches this reference.</p>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <Link to="/command-center" className="inline-flex items-center gap-2 text-xs font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
        <ArrowLeft size={14} aria-hidden="true" /> Back to Command Center
      </Link>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E7EB] p-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">Illustrative transaction</p>
            <h2 className="mt-1 text-base font-semibold text-[#171717]">{transaction.reference}</h2>
          </div>
          <Badge tone={getVerificationTone(transaction.verificationStatus)}>{transaction.verificationStatus}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-px bg-[#E5E7EB] sm:grid-cols-2">
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Business</dt>
            <dd className="mt-1 text-xs font-medium text-[#171717]">{transaction.business}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Transaction type</dt>
            <dd className="mt-1 text-xs font-medium text-[#171717]">{transaction.type}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Amount</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-[#171717]">{formatCurrency(transaction.amount)}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Date &amp; time</dt>
            <dd className="mt-1 text-xs font-medium text-[#171717]">{formatDateTime(transaction.occurredAt)} WAT</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Risk indicator</dt>
            <dd className="mt-1 text-xs font-medium text-[#171717]">{transaction.riskIndicator}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-[10px] text-[#6B7280]">Business record</dt>
            <dd className="mt-1">
              <Link to={`/customers/${transaction.customerId}`} className="inline-flex items-center gap-1 text-xs font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
                View business record <ExternalLink size={12} aria-hidden="true" />
              </Link>
            </dd>
          </div>
        </dl>
        <p className="border-t border-[#E5E7EB] bg-[#FAFAFA] px-5 py-3 text-[10px] leading-4 text-[#6B7280]">
          Sample transaction details only. A risk indicator calls for review and does not establish fraud or a credit decision.
        </p>
      </Card>
    </main>
  )
}
