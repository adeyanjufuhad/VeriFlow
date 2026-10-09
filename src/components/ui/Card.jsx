export default function Card({ children, className = '', ...props }) {
  return (
    <section
      className={`rounded-lg border border-[#E5E7EB] bg-white ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}
