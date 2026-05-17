import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function SimulationReport({ reportData }) {
  if (!reportData) return null;

  return (
    <div className="mt-8 bg-slate-800/80 backdrop-blur-xl border border-blue-500/30 p-6 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <CheckCircle2 className="text-blue-400" /> 試算報告 (Simulation Report)
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">重分配後淨值 (Total NAV)</p>
          <p className="text-2xl font-bold">${reportData.total_nav.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">總投資成本 (Total Cost)</p>
          <p className="text-xl font-bold">${reportData.total_cost_basis.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">未實現損益 (Unrealized P&L)</p>
          <p className={`text-xl font-bold ${reportData.total_unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {reportData.total_unrealized_pnl >= 0 ? '+' : ''}{reportData.total_unrealized_pnl.toLocaleString()} 
            <span className="text-sm ml-1">({reportData.total_roi_pct}%)</span>
          </p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">預估手續費 (Est. Fees)</p>
          <p className="text-xl font-bold text-orange-400">${reportData.estimated_total_transaction_cost.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-4">
        {reportData.reports.map((report, idx) => (
          <div key={idx} className="bg-slate-900/30 rounded-xl p-5 border border-slate-700/50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {report.category}
                  {report.unrealized_pnl !== 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${report.unrealized_pnl > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {report.unrealized_pnl > 0 ? '+' : ''}{report.unrealized_pnl.toLocaleString()}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-400">目標比例: {report.target_pct}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">現值 <ArrowRight className="inline w-3 h-3 mx-1" /> 目標</p>
                <p className="font-mono">${report.current_value.toLocaleString()} <ArrowRight className="inline w-3 h-3 mx-1 text-slate-600" /> ${report.target_value.toLocaleString()}</p>
              </div>
            </div>

            {report.actions && report.actions.length > 0 ? (
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-700/50">
                {report.actions.map((action, aidx) => (
                  <div key={aidx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-sm font-mono">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded font-bold ${action.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {action.action}
                      </span>
                      <span className="font-bold text-slate-200">{action.ticker}</span>
                    </div>
                    <div className="text-right">
                      <p>{action.shares} 股 @ ${action.price}</p>
                      <p className="text-xs text-slate-400 mt-1">成本: ${action.estimated_cost}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-700/50 text-slate-500 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> 無需調整
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
