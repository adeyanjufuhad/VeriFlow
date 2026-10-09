import { transactions } from '../data/transactions.js'

export function getTransactions() {
  return transactions
}

export function getTransactionById(transactionId) {
  return transactions.find((transaction) => transaction.id === transactionId)
}
