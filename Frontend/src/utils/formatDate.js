const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Africa/Lagos',
})

export default function formatDate(date) {
  return dateFormatter.format(new Date(date))
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Africa/Lagos',
})

export function formatDateTime(date) {
  return dateTimeFormatter.format(new Date(date))
}
