import { Navigate, Route, Routes } from 'react-router-dom'
import AICommand from '../pages/AICommand.jsx'
import CommandCenter from '../pages/CommandCenter.jsx'
import CreditAnalysis from '../pages/CreditAnalysis.jsx'
import CreditIntelligence from '../pages/CreditIntelligence.jsx'
import CustomerProfile from '../pages/CustomerProfile.jsx'
import Customers from '../pages/Customers.jsx'
import FraudRisk from '../pages/FraudRisk.jsx'
import HelpSupport from '../pages/HelpSupport.jsx'
import Insights from '../pages/Insights.jsx'
import NotFound from '../pages/NotFound.jsx'
import RiskInvestigation from '../pages/RiskInvestigation.jsx'
import Settings from '../pages/Settings.jsx'
import TransactionDetails from '../pages/TransactionDetails.jsx'
import Transactions from '../pages/Transactions.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/command-center" replace />} />
      <Route path="/command-center" element={<CommandCenter />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/customers/:customerId" element={<CustomerProfile />} />
      <Route path="/credit-intelligence" element={<CreditIntelligence />} />
      <Route path="/credit-intelligence/:customerId" element={<CreditAnalysis />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/transactions/:transactionId" element={<TransactionDetails />} />
      <Route path="/fraud-risk" element={<FraudRisk />} />
      <Route path="/fraud-risk/:alertId" element={<RiskInvestigation />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="/ai-command" element={<AICommand />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/help" element={<HelpSupport />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
