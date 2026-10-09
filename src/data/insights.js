// Example AI-assisted observation; no AI model is connected to this workspace.
export const illustrativeInsight = {
  title: 'Verified inflows increased across the illustrative retail sample.',
  evidence:
    'The sample shows higher recorded inflows over the most recent reporting period. Review the underlying transaction records alongside repayment performance before drawing conclusions.',
  transactionIds: ['txn-20261009-001', 'txn-20261007-002'],
  label: 'Illustrative AI-assisted observation',
}

export const sampleNotifications = [
  {
    id: 'notification-1',
    title: 'Repayment timing requires review',
    detail: 'Green Basket Foods · Alert VF-2401',
    to: '/fraud-risk/alert-2401',
  },
  {
    id: 'notification-2',
    title: 'Transaction evidence is under review',
    detail: 'Musa Electronics · VF-20261007-001',
    to: '/transactions/txn-20261007-001',
  },
  {
    id: 'notification-3',
    title: 'Illustrative portfolio insight updated',
    detail: 'Review the evidence before taking action',
    to: '/insights',
  },
]
