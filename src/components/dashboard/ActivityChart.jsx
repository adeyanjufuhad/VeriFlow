import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '../../utils/formatCurrency.js'
import Card from '../ui/Card.jsx'

const reportingPeriods = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-3 shadow-md">
      <p className="mb-2 text-xs font-medium text-[#171717]">{label}</p>
      <ul className="space-y-1.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-5 text-[11px]">
            <span className="text-[#6B7280]">{entry.name}</span>
            <span className="font-medium text-[#171717]">{formatCurrency(entry.value * 1000000)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-[#E5E7EB] pt-2 text-[10px] text-[#6B7280]">Illustrative records</p>
    </div>
  )
}

export default function ActivityChart({ periods, onPeriodChange, selectedPeriod }) {
  const activePeriod = selectedPeriod
  const data = periods[activePeriod] ?? periods['30d']

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Business activity overview</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#6B7280]">
            Recorded inflows alongside financing disbursements and repayments. Values are grouped by period in NGN.
          </p>
        </div>
        <div className="inline-flex self-start rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-0.5" aria-label="Chart reporting period">
          {reportingPeriods.map((period) => (
            <button
              key={period.id}
              type="button"
              aria-pressed={activePeriod === period.id}
              onClick={() => onPeriodChange(period.id)}
              className={`min-h-8 rounded px-2.5 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] ${
                activePeriod === period.id
                  ? 'bg-white text-[#8E1B1B] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#171717]'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[260px] w-full" role="img" aria-label={`${activePeriod === '7d' ? '7-day' : activePeriod === '30d' ? '30-day' : '90-day'} chart comparing inflows, financing disbursements, and repayments`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 6, bottom: 4 }}>
            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              minTickGap={18}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={43}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              tickFormatter={(value) => `₦${value}m`}
            />
            <Tooltip content={<CurrencyTooltip />} />
            <Legend
              verticalAlign="top"
              align="left"
              height={30}
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 10, color: '#4B5563' }}
            />
            <Line type="monotone" dataKey="inflows" name="Business inflows" stroke="#C62828" strokeWidth={2.2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="disbursements" name="Financing disbursements" stroke="#2563EB" strokeWidth={1.8} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="repayments" name="Repayments" stroke="#16A34A" strokeWidth={1.8} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-[#6B7280]">
        {activePeriod === '7d' ? 'Daily totals for the last 7 days.' : `Grouped totals across the last ${activePeriod === '30d' ? '30' : '90'} days.`}
      </p>
    </Card>
  )
}
