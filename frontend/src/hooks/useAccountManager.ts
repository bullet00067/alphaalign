import { useState, useCallback } from 'react'
import { Account } from '../types/rebalance'

const STORAGE_KEYS = {
  accounts: 'alphaalign_accounts',
  currentAccountId: 'alphaalign_current_account_id',
} as const

const DEFAULT_ACCOUNT: Account = { id: 'default', name: '預設帳戶' }

function loadAccounts(): Account[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.accounts)
    return saved ? JSON.parse(saved) : [DEFAULT_ACCOUNT]
  } catch {
    return [DEFAULT_ACCOUNT]
  }
}

function loadCurrentAccountId(): string {
  return localStorage.getItem(STORAGE_KEYS.currentAccountId) || 'default'
}

function persistAccounts(accounts: Account[]) {
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts))
}

// =====================================================
// useAccountManager
// Manages multi-account state and localStorage sync.
// Decoupled from portfolio state — switching accounts
// is orchestrated by the parent via onSwitch callback.
// =====================================================
export function useAccountManager(onSwitch: (accountId: string) => void) {
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts)
  const [currentAccountId, setCurrentAccountId] = useState<string>(loadCurrentAccountId)

  const switchAccount = useCallback((accountId: string) => {
    setCurrentAccountId(accountId)
    localStorage.setItem(STORAGE_KEYS.currentAccountId, accountId)
    onSwitch(accountId)
  }, [onSwitch])

  const createAccount = useCallback((name: string) => {
    if (!name.trim()) return
    const newId = `acc_${Date.now()}`
    const newAccount: Account = { id: newId, name: name.trim() }
    const updated = [...accounts, newAccount]
    setAccounts(updated)
    persistAccounts(updated)
    // Switch to new account immediately
    setCurrentAccountId(newId)
    localStorage.setItem(STORAGE_KEYS.currentAccountId, newId)
    onSwitch(newId)
  }, [accounts, onSwitch])

  const renameAccount = useCallback((accountId: string, newName: string) => {
    if (!newName.trim()) return
    const updated = accounts.map(acc =>
      acc.id === accountId ? { ...acc, name: newName.trim() } : acc
    )
    setAccounts(updated)
    persistAccounts(updated)
  }, [accounts])

  const deleteAccount = useCallback((accountId: string): boolean => {
    if (accounts.length <= 1) return false
    const updated = accounts.filter(acc => acc.id !== accountId)
    setAccounts(updated)
    persistAccounts(updated)
    // Clean up storage for deleted account
    localStorage.removeItem(`alphaalign_allocations_${accountId}`)
    localStorage.removeItem(`alphaalign_deposit_cash_${accountId}`)
    localStorage.removeItem(`alphaalign_free_cash_${accountId}`)
    // Switch to first remaining account
    switchAccount(updated[0].id)
    return true
  }, [accounts, switchAccount])

  return {
    accounts,
    currentAccountId,
    switchAccount,
    createAccount,
    renameAccount,
    deleteAccount,
  }
}
