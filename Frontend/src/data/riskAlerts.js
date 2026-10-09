// Review prompts are illustrative indicators, not confirmed fraud findings.
export const riskAlerts = [
  {
    id: 'alert-2401',
    title: 'Repayment received later than scheduled',
    business: 'Green Basket Foods',
    transactionId: 'txn-20261008-002',
    priority: 'High',
    status: 'Review required',
    nextAction: 'Review repayment timing',
  },
  {
    id: 'alert-2402',
    title: 'Inflow differs from recent transaction pattern',
    business: 'Kola Hardware Supply',
    transactionId: 'txn-20261008-001',
    priority: 'Medium',
    status: 'Unusual activity detected',
    nextAction: 'Compare source records',
  },
  {
    id: 'alert-2403',
    title: 'Submitted verification evidence needs review',
    business: 'Musa Electronics',
    transactionId: 'txn-20261007-001',
    priority: 'Medium',
    status: 'Awaiting review',
    nextAction: 'Review submitted evidence',
  },
  {
    id: 'alert-2404',
    title: 'Business inflows declined across reporting periods',
    business: 'Green Basket Foods',
    transactionId: 'txn-20261008-002',
    priority: 'Low',
    status: 'Review required',
    nextAction: 'Review recent activity',
  },
]
