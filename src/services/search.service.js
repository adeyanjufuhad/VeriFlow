import { customers } from '../data/customers.js'
import { transactions } from '../data/transactions.js'

export function searchIllustrativeRecords(query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const customerMatches = customers
    .filter((customer) =>
      `${customer.name} ${customer.sector} ${customer.location} ${customer.id}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .map((customer) => ({
      id: customer.id,
      title: customer.name,
      detail: `${customer.sector} · ${customer.location}`,
      to: `/customers/${customer.id}`,
    }))

  const transactionMatches = transactions
    .filter((transaction) =>
      `${transaction.reference} ${transaction.business} ${transaction.type} ${transaction.id}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .map((transaction) => ({
      id: transaction.id,
      title: transaction.reference,
      detail: `${transaction.business} · ${transaction.type}`,
      to: `/transactions/${transaction.id}`,
    }))

  return [...customerMatches, ...transactionMatches].slice(0, 6)
}
