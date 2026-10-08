const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export default function formatDate(date) {
  return dateFormatter.format(new Date(date))
}
