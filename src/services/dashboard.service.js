import {
  activityByPeriod,
  dashboardSummary,
  portfolioHealth,
} from '../data/dashboard.js'
import { illustrativeInsight, sampleNotifications } from '../data/insights.js'
import { riskAlerts } from '../data/riskAlerts.js'
import { transactions } from '../data/transactions.js'
import { formatCurrency } from '../utils/formatCurrency.js'

export function getDashboardSummary() {
  return dashboardSummary
}

export function getActivityForPeriod(period) {
  return activityByPeriod[period] ?? activityByPeriod['30d']
}

export function getPortfolioHealth() {
  return portfolioHealth
}

export function getRecentTransactions(limit = 6) {
  return transactions.slice(0, limit)
}

export function getDashboardRiskAlerts(limit = 4) {
  return riskAlerts.slice(0, limit)
}

export function getIllustrativeInsight() {
  return {
    ...illustrativeInsight,
    evidence: `The illustrative sample records ${formatCurrency(dashboardSummary.verifiedInflows)} in verified inflows over the last 30 days, compared with ${formatCurrency(dashboardSummary.previousPeriodVerifiedInflows)} in the preceding 30-day period. Review source transactions and repayment performance before drawing conclusions.`,
  }
}

export function getSampleNotifications() {
  return sampleNotifications
}
