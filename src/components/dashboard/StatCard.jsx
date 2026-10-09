import { ArrowDownToLine, CircleDollarSign, ShieldAlert, WalletCards } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency.js'
import Card from '../ui/Card.jsx'

const iconMap = {
  inflows: ArrowDownToLine,
  exposure: WalletCards,
  repayment: CircleDollarSign,
  alerts: ShieldAlert,
}

export default function StatCard({ metric }) {
  const Icon = iconMap[metric.icon] ?? CircleDollarSign
  const formattedValue = metric.format === 'currency'
    ? formatCurrency(metric.value, { maximumFractionDigits: 1, notation: 'compact' })
    : metric.format === 'percentage'
      ? `${metric.value.toFixed(1)}%`
      : metric.value.toLocaleString('en-NG')

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#6B7280]">{metric.label}</p>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-[#171717] sm:text-2xl">
            {formattedValue}
          </p>
        </div>
        <span className={`grid size-9 shrink-0 place-items-center rounded-md ${metric.icon === 'alerts' ? 'bg-[#FFF7ED] text-[#D97706]' : 'bg-[#FCE8E8] text-[#C62828]'}`}>
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 min-h-9 text-[11px] leading-[1.55] text-[#6B7280]">{metric.description}</p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3">
        <span className="text-[10px] text-[#6B7280]">{metric.period}</span>
        {metric.note && <span className="text-right text-[10px] font-medium text-[#4B5563]">{metric.note}</span>}
      </div>
    </Card>
  )
}
