// Illustrative activity aggregates. Values are in NGN and are not live bank data.
const activityLastSevenDays = [
  { label: 'Oct 03', inflows: 3.0, disbursements: 0.4, repayments: 0.35 },
  { label: 'Oct 04', inflows: 3.2, disbursements: 0.2, repayments: 0.42 },
  { label: 'Oct 05', inflows: 3.1, disbursements: 0.35, repayments: 0.39 },
  { label: 'Oct 06', inflows: 3.7, disbursements: 0.15, repayments: 0.48 },
  { label: 'Oct 07', inflows: 3.5, disbursements: 0.4, repayments: 0.45 },
  { label: 'Oct 08', inflows: 3.2, disbursements: 0.25, repayments: 0.45 },
  { label: 'Oct 09', inflows: 4.6, disbursements: 0.25, repayments: 0.56 },
]

const activityLastThirtyDays = [
  { label: 'Sep 12–18', inflows: 18.4, disbursements: 2.0, repayments: 2.3 },
  { label: 'Sep 19–25', inflows: 20.1, disbursements: 2.2, repayments: 2.5 },
  { label: 'Sep 26–Oct 02', inflows: 21.8, disbursements: 2.0, repayments: 2.6 },
  { label: 'Oct 03–09', inflows: 24.3, disbursements: 2.0, repayments: 3.1 },
]

export const activityByPeriod = {
  '7d': activityLastSevenDays,
  '30d': activityLastThirtyDays,
  '90d': [
    { label: 'Jul 12–18', inflows: 12.6, disbursements: 1.2, repayments: 1.5 },
    { label: 'Jul 19–25', inflows: 13.4, disbursements: 1.5, repayments: 1.6 },
    { label: 'Jul 26–Aug 01', inflows: 14.1, disbursements: 1.7, repayments: 1.7 },
    { label: 'Aug 02–08', inflows: 15.2, disbursements: 1.6, repayments: 1.9 },
    { label: 'Aug 09–15', inflows: 15.8, disbursements: 1.8, repayments: 2.0 },
    { label: 'Aug 16–22', inflows: 16.1, disbursements: 2.0, repayments: 2.0 },
    { label: 'Aug 23–29', inflows: 16.9, disbursements: 1.7, repayments: 2.1 },
    { label: 'Aug 30–Sep 05', inflows: 17.3, disbursements: 1.9, repayments: 2.2 },
    { label: 'Sep 06–12', inflows: 18.0, disbursements: 2.1, repayments: 2.2 },
    ...activityLastThirtyDays,
  ],
}

export const portfolioHealth = [
  {
    category: 'Healthy',
    count: 82,
    percentage: 68.3,
    description: 'Consistent recorded activity and scheduled repayments received.',
    color: '#16A34A',
  },
  {
    category: 'Watch',
    count: 28,
    percentage: 23.3,
    description: 'Activity or repayment patterns have become less consistent.',
    color: '#D97706',
  },
  {
    category: 'At Risk',
    count: 10,
    percentage: 8.3,
    description: 'Review indicators suggest closer assessment may be appropriate.',
    color: '#C62828',
  },
]

export const dashboardSummary = {
  reportingPeriod: 'Last 30 days',
  verifiedInflows: 84600000,
  activeFinancingExposure: 24800000,
  repaymentPerformance: 94.7,
  receivedRepayments: 36,
  scheduledRepayments: 38,
  openRiskAlerts: 12,
}
