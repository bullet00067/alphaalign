import React, { useMemo, useCallback } from 'react'
import { TrendingUp, AlertCircle, Loader2, Save, Plus } from 'lucide-react'

// Hooks
import { useAccountManager } from '../hooks/useAccountManager'
import { usePortfolioState } from '../hooks/usePortfolioState'
import { useRebalanceApi } from '../hooks/useRebalanceApi'
import { useWizard } from '../hooks/useWizard'

// Components
import AccountSwitcher from './AccountSwitcher'
import AllocationProgress from './AllocationProgress'
import CashInputs from './CashInputs'
import StrategySelector from './StrategySelector'
import WizardPanel from './WizardPanel'
import AssetCategoryCard from './AssetCategoryCard'
import SimulationReport from './SimulationReport'
import HistoryView from './HistoryView'

// =====================================================
// AllocationDashboard
// Main orchestration container. This component ONLY
// composes hooks and renders sub-components.
// No business logic lives here.
// =====================================================
export default function AllocationDashboard() {
  // --- Account management ---
  const portfolio = usePortfolioState('default') // will be re-init on switch

  const handleAccountSwitch = useCallback((accountId: string) => {
    portfolio.switchTo(accountId)
    api.clearReport()
    api.clearError()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const accountManager = useAccountManager(handleAccountSwitch)

  // --- Portfolio state (bound to current account) ---
  const {
    allocations, depositCash, setDepositCash,
    freeCash, setFreeCash, momentumMode, setMomentumMode,
    addCategory, removeCategory, updateCategoryName,
    updateAllocationPct, addAsset, removeAsset, updateAsset,
    moveAsset, restoreAllocations,
  } = portfolio

  // --- API interactions ---
  const api = useRebalanceApi(
    accountManager.currentAccountId,
    allocations,
    depositCash,
    freeCash,
    momentumMode,
    restoreAllocations
  )

  // --- Wizard ---
  const wizard = useWizard(portfolio.setAllocations)

  // --- Derived state ---
  const totalAllocation = useMemo(
    () => allocations.reduce((sum, item) => sum + (item.target_pct || 0), 0),
    [allocations]
  )
  const isPerfect = totalAllocation === 100

  const categoryOptions = useMemo(
    () => allocations.map(c => ({ id: c.id, name: c.category })),
    [allocations]
  )

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-6 md:p-12 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="text-blue-400" /> AlphaAlign
            </h1>
            <p className="text-slate-400 mt-2 text-sm md:text-base">
              互動式資產再平衡與監控平台
            </p>
          </div>
        </div>

        {/* Account Switcher */}
        <AccountSwitcher
          accounts={accountManager.accounts}
          currentAccountId={accountManager.currentAccountId}
          onSwitch={accountManager.switchAccount}
          onCreate={accountManager.createAccount}
          onRename={accountManager.renameAccount}
          onDelete={accountManager.deleteAccount}
        />

        {/* Smart Wizard */}
        <WizardPanel
          isOpen={wizard.isOpen}
          onToggle={() => wizard.setIsOpen(!wizard.isOpen)}
          wizardText={wizard.wizardText}
          onTextChange={wizard.setWizardText}
          isLoading={wizard.isLoading}
          isSuccess={wizard.isSuccess}
          onSubmit={wizard.handleSubmit}
          onClear={wizard.handleClear}
        />

        {/* Allocation Progress */}
        <AllocationProgress totalAllocation={totalAllocation} />

        {/* Cash Inputs */}
        <CashInputs
          depositCash={depositCash}
          freeCash={freeCash}
          onDepositCashChange={setDepositCash}
          onFreeCashChange={setFreeCash}
        />

        {/* Strategy Toggle */}
        <StrategySelector momentumMode={momentumMode} onChange={setMomentumMode} />

        {/* Asset Category Cards */}
        <div className="grid grid-cols-1 gap-6">
          {allocations.map(item => (
            <AssetCategoryCard
              key={item.id}
              item={item}
              categories={categoryOptions}
              updateCategoryName={updateCategoryName}
              updateAllocationPct={updateAllocationPct}
              removeCategory={id => { removeCategory(id); api.clearReport() }}
              updateAsset={updateAsset}
              removeAsset={(cid, idx) => { removeAsset(cid, idx); api.clearReport() }}
              addAsset={addAsset}
              onMoveAsset={(src, idx, tgt) => { moveAsset(src, idx, tgt); api.clearReport() }}
            />
          ))}

          <button
            onClick={addCategory}
            className="w-full border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-colors bg-slate-800/20 hover:bg-slate-800/40"
          >
            <Plus size={24} />
            <span className="font-medium">新增資產類別 (Add Category)</span>
          </button>
        </div>

        {/* Error */}
        {api.error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{api.error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700/50">
          <button
            disabled={!isPerfect || api.isLoading}
            onClick={api.handleSimulate}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              !isPerfect || api.isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg'
            }`}
          >
            {api.isLoading ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
            {api.isLoading ? '正在獲取即時報價...' : '僅單次試算 (Simulate Only)'}
          </button>

          <button
            disabled={!isPerfect || api.isLoading}
            onClick={api.handleSaveAndRebalance}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              !isPerfect || api.isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {api.isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {api.isLoading ? '正在進行儲存並計算...' : '更新配置並產出報告 (Save & Rebalance)'}
          </button>
        </div>

        {/* Simulation Report */}
        <SimulationReport reportData={api.reportData} />

        {/* History */}
        <HistoryView
          historyData={api.historyData}
          onRestore={api.handleRestore}
          onDelete={api.handleDeleteHistory}
        />

      </div>
    </div>
  )
}
