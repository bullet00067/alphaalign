import React from 'react'
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { CategoryAllocation } from '../types/rebalance'

const PRESETS = [
  {
    label: '兩階段混合台股配置',
    text: '1.先配置資產類型百分比\n市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\n006208 1516股 均價109.14\n00679B 3306股 均價 28.32\n00712 3201股 均價 9.57\n00878 22856股 均價 19.74\n00881 2000股 均價 15.13\n2330 11股 均價 1847.72\n台幣活存 50000',
  },
  {
    label: '全球股債平衡型 (美股)',
    text: '1.先配置資產類型百分比\n市值型 60%, 高股息型 10%, 債券型 20%, 現金 10%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\nVOO 50股 均價 460.50\nQQQM 30股 均價 175.20\nSCHD 25股 均價 78.40\nTLT 100股 均價 92.15\n美元現金 8500',
  },
  {
    label: '台美科技高優息組合',
    text: '1.先配置資產類型百分比\n市值型 45%, 高股息型 45%, 債券型 5%, 現金 5%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\n2330 500股 均價 780.00\n0050 1500股 均價 152.40\n00919 5000股 均價 22.15\n00878 8000股 均價 20.80\n00679B 1000股 均價 29.50\nTWD活存 35000',
  },
]

interface WizardPanelProps {
  isOpen: boolean
  onToggle: () => void
  wizardText: string
  onTextChange: (text: string) => void
  isLoading: boolean
  isSuccess: boolean
  onSubmit: () => void
  onClear: () => void
  // Called when wizard successfully parses — allows parent to update allocations
  onSuccess?: (allocations: CategoryAllocation[]) => void
}

export default function WizardPanel({
  isOpen,
  onToggle,
  wizardText,
  onTextChange,
  isLoading,
  isSuccess,
  onSubmit,
  onClear,
}: WizardPanelProps) {
  return (
    <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 backdrop-blur-xl border border-indigo-500/20 p-6 rounded-2xl shadow-xl transition-all duration-300">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="text-yellow-400 animate-pulse" size={20} />
          <h2 className="text-lg font-semibold text-white tracking-wide">
            🧙‍♂️ 智慧一鍵配置精靈 (Smart Import)
          </h2>
        </div>
        <button
          onClick={onToggle}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all"
        >
          {isOpen ? '收合精靈 (Collapse)' : '展開精靈 (Expand)'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 space-y-4 border-t border-indigo-500/10 pt-4">
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            支援兩階段混合導入：您可以先配置<strong>大類別目標百分比</strong>（例如{' '}
            <code>市值型 50%, 高股息 40%</code>），並貼上
            <strong>成分股持股明細（含股數與成交均價）</strong>
            。系統會自動辨識並完成歸屬與記帳！
          </p>

          <div className="relative">
            <textarea
              rows={6}
              value={wizardText}
              onChange={e => onTextChange(e.target.value)}
              placeholder={`1.先配置資產類型百分比\n市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%\n\n2.設定成分股後，自動將這些成分股依照系統判斷排入各項資產類型\n006208 1516股 均價109.14\n00679B 3306股 均價 28.32\n台幣活存 50000`}
              className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">快速套用範例：</span>
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onTextChange(preset.text)}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClear}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            >
              清空 (Clear)
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || !wizardText.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <><Loader2 className="animate-spin" size={14} /> 解析中...</>
              ) : isSuccess ? (
                <><CheckCircle2 size={14} className="text-green-300" /> 導入成功！</>
              ) : (
                <><Sparkles size={14} /> 一鍵智慧分類導入 (Import)</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
