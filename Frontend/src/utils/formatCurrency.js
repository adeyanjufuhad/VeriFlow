export function formatCurrency(amount, options = {}) {
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
    ...options,
  })

  return formatter.format(amount)
}

export default formatCurrency
