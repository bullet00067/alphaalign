import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import {
  RebalanceRequest,
  RebalanceResult,
  HistoryRecord,
  CategoryAllocation,
} from '../types/rebalance'

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
}

/** Build the API payload from UI state */
function buildPayload(
  accountId: string,
  allocations: CategoryAllocation[],
  depositCash: number,
  freeCash: number,
  momentumMode: boolean
): RebalanceRequest {
  return {
    account_id: accountId,
    deposit_cash: depositCash,
    current_free_cash: freeCash,
    momentum_mode: momentumMode,
    allocations: allocations.map(cat => ({
      category: cat.category,
      target_pct: cat.target_pct / 100.0,
      assets: cat.assets.map(a => ({
        ticker: a.ticker.toUpperCase().trim(),
        current_shares: Number(a.shares) || 0,
        average_cost: Number(a.average_cost) || 0,
      })),
    })),
  }
}

/** Validate all tickers are non-empty. Returns error message or null. */
function validateTickers(allocations: CategoryAllocation[]): string | null {
  for (const cat of allocations) {
    for (const asset of cat.assets) {
      if (!asset.ticker.trim()) {
        return `請填寫「${cat.category}」中所有標的的代號 (Ticker)`
      }
    }
  }
  return null
}

// =====================================================
// useRebalanceApi
// Encapsulates all API calls and related loading/error
// state. Pure function — does NOT touch localStorage.
// =====================================================
export function useRebalanceApi(
  accountId: string,
  allocations: CategoryAllocation[],
  depositCash: number,
  freeCash: number,
  momentumMode: boolean,
  onRestore: (snapshot: HistoryRecord['snapshot']) => void
) {
  const [reportData, setReportData] = useState<RebalanceResult | null>(null)
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async (accId?: string) => {
    const id = accId ?? accountId
    try {
      const response = await axios.get<HistoryRecord[]>(
        `${getApiUrl()}/api/rebalance/history?account_id=${id}`
      )
      setHistoryData(response.data)
    } catch (err) {
      console.error('無法取得歷史紀錄:', err)
    }
  }, [accountId])

  // Refresh history when accountId changes
  useEffect(() => {
    fetchHistory(accountId)
  }, [accountId, fetchHistory])

  const handleSimulate = useCallback(async () => {
    const validationError = validateTickers(allocations)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsLoading(true)
    setError(null)
    setReportData(null)
    try {
      const payload = buildPayload(accountId, allocations, depositCash, freeCash, momentumMode)
      const response = await axios.post<RebalanceResult>(
        `${getApiUrl()}/api/rebalance/calculate`,
        payload
      )
      setReportData(response.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? '無法連線至伺服器或發生未知錯誤')
      }
    } finally {
      setIsLoading(false)
    }
  }, [accountId, allocations, depositCash, freeCash, momentumMode])

  const handleSaveAndRebalance = useCallback(async () => {
    const validationError = validateTickers(allocations)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsLoading(true)
    setError(null)
    setReportData(null)
    try {
      const payload = buildPayload(accountId, allocations, depositCash, freeCash, momentumMode)
      const response = await axios.post<{ status: string; data: RebalanceResult }>(
        `${getApiUrl()}/api/rebalance/save`,
        payload
      )
      setReportData(response.data.data)
      fetchHistory()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? '無法連線至伺服器或發生未知錯誤')
      }
    } finally {
      setIsLoading(false)
    }
  }, [accountId, allocations, depositCash, freeCash, momentumMode, fetchHistory])

  const handleDeleteHistory = useCallback(async (recordId: string) => {
    if (!window.confirm('確定要刪除此筆歷史紀錄嗎？此動作將無法復原。')) return
    try {
      await axios.delete(`${getApiUrl()}/api/rebalance/history/${recordId}`)
      fetchHistory(accountId)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        window.alert('刪除失敗：' + (err.response?.data?.detail ?? err.message))
      }
    }
  }, [accountId, fetchHistory])

  const handleRestore = useCallback((snapshot: HistoryRecord['snapshot']) => {
    onRestore(snapshot)
    setReportData(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onRestore])

  const clearReport = useCallback(() => setReportData(null), [])
  const clearError = useCallback(() => setError(null), [])

  return {
    reportData,
    historyData,
    isLoading,
    error,
    handleSimulate,
    handleSaveAndRebalance,
    fetchHistory,
    handleDeleteHistory,
    handleRestore,
    clearReport,
    clearError,
  }
}
