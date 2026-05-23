import { useState, useCallback } from 'react'
import axios from 'axios'
import { CategoryAllocation } from '../types/rebalance'

function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
}

interface ParsedCategory {
  category: string
  target_pct: number
  assets: { ticker: string; shares: number; average_cost: number }[]
}

// =====================================================
// useWizard
// Manages the Smart Portfolio Wizard panel state and
// API interaction for natural-language portfolio import.
// =====================================================
export function useWizard(onSuccess: (allocations: CategoryAllocation[]) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [wizardText, setWizardText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!wizardText.trim()) return
    setIsLoading(true)
    setIsSuccess(false)

    try {
      const response = await axios.post<ParsedCategory[]>(
        `${getApiUrl()}/api/rebalance/parse-wizard`,
        { input_text: wizardText }
      )
      if (response.data && response.data.length > 0) {
        const newAllocations: CategoryAllocation[] = response.data.map((cat, idx) => ({
          id: (idx + 1).toString(),
          category: cat.category,
          target_pct: cat.target_pct,
          assets: cat.assets.map(a => ({
            ticker: a.ticker,
            shares: a.shares ?? 0,
            average_cost: a.average_cost ?? 0,
          })),
        }))
        onSuccess(newAllocations)
        setIsSuccess(true)
        setTimeout(() => {
          setIsSuccess(false)
          setIsOpen(false)
          setWizardText('')
        }, 1500)
      }
    } catch (err) {
      console.error('Wizard parse error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [wizardText, onSuccess])

  const handleClear = useCallback(() => setWizardText(''), [])

  return {
    isOpen,
    setIsOpen,
    wizardText,
    setWizardText,
    isLoading,
    isSuccess,
    handleSubmit,
    handleClear,
  }
}
