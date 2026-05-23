import React from 'react'

interface CashInputsProps {
  depositCash: number
  freeCash: number
  onDepositCashChange: (value: number) => void
  onFreeCashChange: (value: number) => void
}

export default function CashInputs({
  depositCash,
  freeCash,
  onDepositCashChange,
  onFreeCashChange,
}: CashInputsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-2xl">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          本次預計額外投入資金 (Deposit Cash)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="number"
            value={depositCash}
            onChange={e => onDepositCashChange(Number(e.target.value))}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-2xl">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          目前未投入之閒置現金 (Free Cash)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="number"
            value={freeCash}
            onChange={e => onFreeCashChange(Number(e.target.value))}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>
    </div>
  )
}
