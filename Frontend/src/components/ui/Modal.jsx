export default function Modal({ children, open = false, ...props }) {
  if (!open) return null

  return <dialog open {...props}>{children}</dialog>
}
