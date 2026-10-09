import Card from '../ui/Card.jsx'

export default function PortfolioHealth({ categories }) {
  const totalBusinesses = categories.reduce((total, category) => total + category.count, 0)

  return (
    <Card className="p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-[#171717]">Portfolio health</h2>
        <p className="mt-1 text-[11px] text-[#6B7280]">Illustrative review groupings · {totalBusinesses} businesses</p>
      </div>
      <ul className="mt-5 space-y-4">
        {categories.map((category) => (
          <li key={category.category}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="text-xs font-medium text-[#171717]">{category.category}</span>
                <span className="text-[10px] text-[#6B7280]">{category.count}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-[#171717]">{category.percentage.toFixed(1)}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]"
              role="img"
              aria-label={`${category.category}: ${category.percentage.toFixed(1)} percent`}
            >
              <div className="h-full rounded-full" style={{ width: `${category.percentage}%`, backgroundColor: category.color }} />
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-[#6B7280]">{category.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-[#F3F4F6] pt-3 text-[10px] leading-4 text-[#6B7280]">
        These sample groupings support review only; they are not an approved credit or risk model.
      </p>
    </Card>
  )
}
