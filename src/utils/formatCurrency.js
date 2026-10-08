const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
})

export default function formatCurrency(amount) {
  return nairaFormatter.format(amount)
}
