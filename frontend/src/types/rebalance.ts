// =====================================================
// AlphaAlign Type Definitions
// Mirrors backend Pydantic models in rebalancer.py
// =====================================================

// --- Internal UI Representation ---

/** A single asset/stock as stored in UI state */
export interface AssetItem {
  ticker: string
  shares: number         // UI uses 'shares' (maps to 'current_shares' in API)
  average_cost: number
}

/** A category with its target allocation and constituent assets */
export interface CategoryAllocation {
  id: string
  category: string
  target_pct: number     // UI uses 0–100 (maps to 0.0–1.0 in API)
  assets: AssetItem[]
}

/** User account */
export interface Account {
  id: string
  name: string
}

// --- API Request/Response Types ---

/** Asset in API payload format */
export interface AssetPayload {
  ticker: string
  current_shares: number // API field name
  average_cost: number
}

/** Category in API payload format */
export interface CategoryPayload {
  category: string
  target_pct: number     // 0.0–1.0
  assets: AssetPayload[]
}

/** Full API request body — mirrors RebalanceRequest in rebalancer.py */
export interface RebalanceRequest {
  account_id: string
  deposit_cash: number
  current_free_cash: number
  momentum_mode: boolean
  allocations: CategoryPayload[]
}

/** A single trade action */
export interface ActionItem {
  ticker: string
  action: 'BUY' | 'SELL'
  shares: number
  price: number
  estimated_value: number
  estimated_cost: number
}

/** Per-category result from the rebalancing engine */
export interface CategoryReport {
  category: string
  target_pct: string     // formatted as "60%"
  current_pct: string    // formatted as "58.3%"
  current_value: number
  unrealized_pnl: number
  target_value: number
  diff_amount: number
  actions: ActionItem[]
}

/** Full rebalancing result from the API */
export interface RebalanceResult {
  total_nav: number
  total_asset_value: number
  total_cost_basis: number
  total_unrealized_pnl: number
  total_roi_pct: number
  estimated_total_transaction_cost: number
  reports: CategoryReport[]
}

/** A saved history record from Supabase / local JSON */
export interface HistoryRecord {
  id: string
  created_at: string
  total_nav: number
  unrealized_pnl: number
  roi_pct: number
  snapshot: Partial<RebalanceRequest> & {
    allocations?: {
      category: string
      target_pct: number
      assets: AssetPayload[]
    }[]
    deposit_cash?: number
    current_free_cash?: number
    account_id?: string
  }
}
