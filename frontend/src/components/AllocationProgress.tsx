import React from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface AllocationProgressProps {
  totalAllocation: number
}

export default function AllocationProgress({ totalAllocation }: AllocationProgressProps) {
  const remaining = 100 - totalAllocation
  const isPerfect = remaining === 0
  const isOver = remaining < 0

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">資金配置總和 (Total Allocation)</h2>
        <span
          className={`text-xl font-bold px-3 py-1 rounded-full ${
            isPerfect
              ? 'bg-green-500/20 text-green-400'
              : isOver
              ? 'bg-red-500/20 text-red-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {totalAllocation}% / 100%
        </span>
      </div>

      <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            isOver ? 'bg-red-500' : isPerfect ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(totalAllocation, 100)}%` }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        {isPerfect ? (
          <p className="text-green-400 flex items-center gap-1">
            <CheckCircle2 size={16} /> 配置完美，可執行再平衡
          </p>
        ) : isOver ? (
          <p className="text-red-400 flex items-center gap-1">
            <AlertCircle size={16} /> 超額配置 {Math.abs(remaining)}%，請調降部分資產比例
          </p>
        ) : (
          <p className="text-blue-400 flex items-center gap-1">
            <AlertCircle size={16} /> 尚有 {remaining}% 待分配資金
          </p>
        )}
      </div>
    </div>
  )
}
