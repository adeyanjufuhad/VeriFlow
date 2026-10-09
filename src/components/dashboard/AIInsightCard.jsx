import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card.jsx'

export default function AIInsightCard({ insight }) {
  return (
    <Card className="border-[#E9CACA] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-[#FCE8E8] text-[#8E1B1B]">
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">AI-assisted insight</h2>
          <p className="text-[10px] text-[#8E1B1B]">{insight.label}</p>
        </div>
      </div>
      <p className="mt-4 text-xs font-medium leading-5 text-[#171717]">{insight.title}</p>
      <p className="mt-2 text-[11px] leading-[1.65] text-[#4B5563]">{insight.evidence}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#F3F4F6] pt-3">
        <span className="text-[10px] font-medium text-[#4B5563]">Supporting records:</span>
        {insight.transactionIds.map((transactionId, index) => (
          <Link
            key={transactionId}
            to={`/transactions/${transactionId}`}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8E1B1B] hover:text-[#C62828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]"
          >
            {insight.transactionReferences[index]} <ArrowRight size={11} aria-hidden="true" />
          </Link>
        ))}
        <Link to="/transactions" className="text-[10px] text-[#6B7280] hover:text-[#8E1B1B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828]">
          View transactions
        </Link>
      </div>
      <p className="mt-2 text-[10px] text-[#6B7280]">Reviewer judgment is required; this is not a credit decision.</p>
    </Card>
  )
}
