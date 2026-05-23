import { useState, useEffect, useCallback, useRef } from 'react'
import { CategoryAllocation, AssetItem } from '../types/rebalance'

// =====================================================
// Default portfolio configuration
// =====================================================
const INITIAL_ALLOCATIONS: CategoryAllocation[] = [
  {
    id: '1',
    category: '市值型股票',
    target_pct: 60,
    assets: [
      { ticker: 'QQQM', shares: 50, average_cost: 0 },
      { ticker: '0050.TW', shares: 0, average_cost: 0 },
    ],
  },
  {
    id: '2',
    category: '高股息型',
    target_pct: 20,
    assets: [{ ticker: 'QYLD', shares: 100, average_cost: 0 }],
  },
  {
    id: '3',
    category: '美國公債',
    target_pct: 15,
    assets: [{ ticker: 'TLT', shares: 30, average_cost: 0 }],
  },
  { id: '4', category: '現金', target_pct: 5, assets: [] },
]

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadAllocations(accountId: string): CategoryAllocation[] {
  // Try account-specific key first, then fallback to legacy key
  return (
    loadFromStorage(`alphaalign_allocations_${accountId}`, null) ??
    loadFromStorage('alphaalign_allocations', null) ??
    INITIAL_ALLOCATIONS
  )
}

function loadNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? Number(raw) : 0
  } catch {
    return 0
  }
}

// =====================================================
// usePortfolioState
// Manages allocations, cash values, and rebalancing
// strategy mode. Persists to localStorage per account.
// =====================================================
export function usePortfolioState(currentAccountId: string) {
  const isSwitchingRef = useRef(false)

  const [allocations, setAllocations] = useState<CategoryAllocation[]>(() =>
    loadAllocations(currentAccountId)
  )
  const [depositCash, setDepositCash] = useState<number>(() =>
    loadNumber(`alphaalign_deposit_cash_${currentAccountId}`) ||
    loadNumber('alphaalign_deposit_cash')
  )
  const [freeCash, setFreeCash] = useState<number>(() =>
    loadNumber(`alphaalign_free_cash_${currentAccountId}`) ||
    loadNumber('alphaalign_free_cash')
  )
  const [momentumMode, setMomentumMode] = useState(false)

  // Switch accounts: save current, load new
  const switchTo = useCallback((accountId: string) => {
    isSwitchingRef.current = true
    // Save current
    localStorage.setItem(`alphaalign_allocations_${currentAccountId}`, JSON.stringify(allocations))
    localStorage.setItem(`alphaalign_deposit_cash_${currentAccountId}`, depositCash.toString())
    localStorage.setItem(`alphaalign_free_cash_${currentAccountId}`, freeCash.toString())
    // Load new
    setAllocations(loadAllocations(accountId))
    setDepositCash(loadNumber(`alphaalign_deposit_cash_${accountId}`))
    setFreeCash(loadNumber(`alphaalign_free_cash_${accountId}`))
    setMomentumMode(false)
  }, [allocations, depositCash, freeCash, currentAccountId])

  // Persist allocations on change
  useEffect(() => {
    if (isSwitchingRef.current) {
      isSwitchingRef.current = false
      return
    }
    localStorage.setItem(`alphaalign_allocations_${currentAccountId}`, JSON.stringify(allocations))
  }, [allocations, currentAccountId])

  useEffect(() => {
    if (isSwitchingRef.current) return
    localStorage.setItem(`alphaalign_deposit_cash_${currentAccountId}`, depositCash.toString())
  }, [depositCash, currentAccountId])

  useEffect(() => {
    if (isSwitchingRef.current) return
    localStorage.setItem(`alphaalign_free_cash_${currentAccountId}`, freeCash.toString())
  }, [freeCash, currentAccountId])

  // --- Category mutations ---
  const addCategory = useCallback(() => {
    setAllocations(prev => [
      ...prev,
      { id: Date.now().toString(), category: '新資產類別', target_pct: 0, assets: [] },
    ])
  }, [])

  const removeCategory = useCallback((id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id))
  }, [])

  const updateCategoryName = useCallback((id: string, newName: string) => {
    setAllocations(prev => prev.map(a => (a.id === id ? { ...a, category: newName } : a)))
  }, [])

  const updateAllocationPct = useCallback((id: string, newPct: number | string) => {
    const validPct = Math.max(0, Math.min(100, Number(newPct) || 0))
    setAllocations(prev => prev.map(a => (a.id === id ? { ...a, target_pct: validPct } : a)))
  }, [])

  // --- Asset mutations ---
  const addAsset = useCallback((categoryId: string) => {
    setAllocations(prev =>
      prev.map(a =>
        a.id === categoryId
          ? { ...a, assets: [...a.assets, { ticker: '', shares: 0, average_cost: 0 }] }
          : a
      )
    )
  }, [])

  const removeAsset = useCallback((categoryId: string, assetIndex: number) => {
    setAllocations(prev =>
      prev.map(a => {
        if (a.id !== categoryId) return a
        const newAssets = [...a.assets]
        newAssets.splice(assetIndex, 1)
        return { ...a, assets: newAssets }
      })
    )
  }, [])

  const updateAsset = useCallback(
    (categoryId: string, assetIndex: number, field: keyof AssetItem, value: string | number) => {
      setAllocations(prev =>
        prev.map(a => {
          if (a.id !== categoryId) return a
          const newAssets = [...a.assets]
          newAssets[assetIndex] = { ...newAssets[assetIndex], [field]: value }
          return { ...a, assets: newAssets }
        })
      )
    },
    []
  )

  const moveAsset = useCallback((sourceCategoryId: string, sourceAssetIndex: number, targetCategoryId: string) => {
    if (sourceCategoryId === targetCategoryId) return
    setAllocations(prev => {
      const sourceCat = prev.find(c => c.id === sourceCategoryId)
      if (!sourceCat) return prev
      const assetToMove = sourceCat.assets[sourceAssetIndex]
      if (!assetToMove) return prev
      return prev.map(cat => {
        if (cat.id === sourceCategoryId) {
          return { ...cat, assets: cat.assets.filter((_, i) => i !== sourceAssetIndex) }
        }
        if (cat.id === targetCategoryId) {
          return { ...cat, assets: [...cat.assets, assetToMove] }
        }
        return cat
      })
    })
  }, [])

  const restoreAllocations = useCallback((snapshot: {
    allocations?: { category: string; target_pct: number; assets: { ticker: string; current_shares: number; average_cost?: number }[] }[]
    deposit_cash?: number
    current_free_cash?: number
  }) => {
    if (!snapshot) return
    if (snapshot.allocations) {
      const restored = snapshot.allocations.map((cat, idx) => ({
        id: (idx + 1).toString(),
        category: cat.category,
        target_pct: Math.round(cat.target_pct * 100),
        assets: cat.assets.map(a => ({
          ticker: a.ticker,
          shares: a.current_shares,
          average_cost: a.average_cost ?? 0,
        })),
      }))
      setAllocations(restored)
    }
    if (snapshot.deposit_cash !== undefined) setDepositCash(snapshot.deposit_cash)
    if (snapshot.current_free_cash !== undefined) setFreeCash(snapshot.current_free_cash)
  }, [])

  return {
    allocations,
    setAllocations,
    depositCash,
    setDepositCash,
    freeCash,
    setFreeCash,
    momentumMode,
    setMomentumMode,
    switchTo,
    addCategory,
    removeCategory,
    updateCategoryName,
    updateAllocationPct,
    addAsset,
    removeAsset,
    updateAsset,
    moveAsset,
    restoreAllocations,
  }
}
