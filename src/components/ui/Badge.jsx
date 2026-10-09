const toneClasses = {
  success: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]',
  warning: 'border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]',
  danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
  neutral: 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]',
  info: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
}

export default function Badge({ children, tone = 'neutral', className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium leading-4 ${toneClasses[tone] ?? toneClasses.neutral} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
