import React from 'react'
import { Zap, Shield } from 'lucide-react'

interface StrategySelectorProps {
  momentumMode: boolean
  onChange: (enabled: boolean) => void
}

export default function StrategySelector({ momentumMode, onChange }: StrategySelectorProps) {
  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-xl transition-all duration-300">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
          {momentumMode ? (
            <Zap size={18} className="animate-pulse" />
          ) : (
            <Shield size={18} />
          )}
        </div>
        <h3 className="text-base font-semibold text-white">
          再平衡交易策略 (Rebalancing Strategy)
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono ml-auto">
          {momentumMode ? '強勢股加碼' : '風險分散'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Diversification */}
        <div
          onClick={() => onChange(false)}
          className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
            !momentumMode
              ? 'border-blue-500/80 bg-blue-600/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
              : 'border-slate-700/60 bg-slate-900/30 hover:border-slate-600/80 hover:bg-slate-800/20'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  !momentumMode ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Shield size={18} />
              </div>
              <span className="font-semibold text-sm text-slate-100">
                風險分散模式 (Diversified)
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              申購大類別中<strong>「持股數量最多」</strong>的標的。適合穩健配置，避免單一標的佔比過高。
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-700/30 pt-2 text-[10px]">
            <span className="text-slate-500">賣出規則：維持股數最多優先</span>
            <span
              className={`px-2 py-0.5 rounded-md font-medium ${
                !momentumMode ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800/80 text-slate-500'
              }`}
            >
              {!momentumMode ? '啟用中' : '可選用'}
            </span>
          </div>
        </div>

        {/* Momentum Mode */}
        <div
          onClick={() => onChange(true)}
          className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
            momentumMode
              ? 'border-indigo-500/80 bg-indigo-600/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
              : 'border-slate-700/60 bg-slate-900/30 hover:border-slate-600/80 hover:bg-slate-800/20'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  momentumMode
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Zap size={18} />
              </div>
              <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                強勢股加碼模式 (Momentum)
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                  強勢
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              申購大類別中<strong>「歷史報酬率 (ROI) 最高」</strong>的標的。適合順勢交易，放大獲利效益。
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-700/30 pt-2 text-[10px]">
            <span className="text-slate-500">賣出規則：維持股數最多優先</span>
            <span
              className={`px-2 py-0.5 rounded-md font-medium ${
                momentumMode
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'bg-slate-800/80 text-slate-500'
              }`}
            >
              {momentumMode ? '啟用中' : '可選用'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
