export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-md border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-5 py-8 text-center">
      <h3 className="text-sm font-medium text-[#171717]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#6B7280]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
