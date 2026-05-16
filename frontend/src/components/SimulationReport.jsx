import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function SimulationReport({ reportData }) {
  if (!reportData) return null;

  return (
    <div className="mt-8 bg-slate-800/80 backdrop-blur-xl border border-blue-500/30 p-6 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <CheckCircle2 className="text-blue-400" /> 試算報告 (Simulation Report)
      </h2>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">重分配後總資產淨值 (Total NAV)</p>
          <p className="text-2xl font-bold">${reportData.total_nav.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm mb-1">預估總交易成本 (Est. Fees & Taxes)</p>
          <p className="text-2xl font-bold text-orange-400">${reportData.estimated_total_transaction_cost.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-4">
        {reportData.reports.map((report, idx) => (
          <div key={idx} className="bg-slate-900/30 rounded-xl p-5 border border-slate-700/50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-lg">{report.category}</h3>
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
