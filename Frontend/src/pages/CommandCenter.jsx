import { CalendarDays, Info } from 'lucide-react'
import { useState } from 'react'
import {
  getActivityForPeriod,
  getDashboardRiskAlerts,
  getDashboardSummary,
  getIllustrativeInsight,
  getPortfolioHealth,
  getRecentTransactions,
} from '../services/dashboard.service.js'
import ActivityChart from '../components/dashboard/ActivityChart.jsx'
import AIInsightCard from '../components/dashboard/AIInsightCard.jsx'
import PortfolioHealth from '../components/dashboard/PortfolioHealth.jsx'
import RecentTransactions from '../components/dashboard/RecentTransactions.jsx'
import RiskAlerts from '../components/dashboard/RiskAlerts.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'

export default function CommandCenter() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const summary = getDashboardSummary()
  const metrics = [
    {
      label: 'Verified business inflows',
      value: summary.verifiedInflows,
      format: 'currency',
      icon: 'inflows',
      description: 'Incoming business activity recorded in the selected reporting period.',
      period: summary.reportingPeriod,
    },
    {
      label: 'Active financing exposure',
      value: summary.activeFinancingExposure,
      format: 'currency',
      icon: 'exposure',
      description: 'Outstanding financing principal across the illustrative portfolio.',
      period: 'Current illustrative snapshot',
    },
    {
      label: 'Repayment performance',
      value: summary.repaymentPerformance,
      format: 'percentage',
      icon: 'repayment',
      description: `${summary.receivedRepayments} of ${summary.scheduledRepayments} scheduled repayments received.`,
      period: summary.reportingPeriod,
    },
    {
      label: 'Open risk alerts',
      value: summary.openRiskAlerts,
      format: 'number',
      icon: 'alerts',
      description: 'Review prompts awaiting assessment or resolution; not confirmed fraud.',
      period: 'Current illustrative snapshot',
    },
  ]

  return (
    <main className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="info">Illustrative sample data</Badge>
          <span className="hidden text-[11px] text-[#6B7280] sm:inline">
            No live bank or payment system is connected
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] text-[#6B7280]">
          <CalendarDays size={14} aria-hidden="true" />
          <span>Summary period: {summary.reportingPeriod}</span>
        </div>
      </div>

      <section aria-label="Portfolio summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(290px,0.85fr)]">
        <ActivityChart
          periods={{
            '7d': getActivityForPeriod('7d'),
            '30d': getActivityForPeriod('30d'),
            '90d': getActivityForPeriod('90d'),
          }}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
        <PortfolioHealth categories={getPortfolioHealth()} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <RiskAlerts
          alerts={getDashboardRiskAlerts()}
          totalOpen={summary.openRiskAlerts}
        />
        <AIInsightCard insight={getIllustrativeInsight()} />
      </section>

      <RecentTransactions transactions={getRecentTransactions()} />

      <p className="flex items-start gap-2 text-[10px] leading-4 text-[#6B7280]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        All data on this page is illustrative and intended for interface demonstration. It does not represent a live banking portfolio, customer record, credit assessment, or fraud determination.
      </p>
    </main>
  )
}
