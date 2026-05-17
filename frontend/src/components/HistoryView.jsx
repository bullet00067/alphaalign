import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

export default function HistoryView({ historyData, onRestore }) {
  if (!historyData || historyData.length === 0) {
    return (
      <div className="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
        <Calendar size={32} className="mx-auto mb-3 opacity-50" />
        <p>目前尚無歷史再平衡紀錄</p>
        <p className="text-xs mt-1">點擊下方的「更新配置並產出報告 (Save & Rebalance)」即可建立第一筆快照！</p>
      </div>
    );
  }

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-TW', { hour12: false });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-xl space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
        <Calendar className="text-blue-400" /> 歷史再平衡紀錄 (Historical Snapshots)
      </h2>
      
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {historyData.map((item) => (
          <div key={item.id} className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-600 transition-colors">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar size={12} /> {formatDate(item.created_at)}
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-400">總資產淨值</p>
                  <p className="text-lg font-bold text-white">${item.total_nav.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">未實現損益</p>
                  <p className={`text-sm font-semibold ${item.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.unrealized_pnl >= 0 ? '+' : ''}{item.unrealized_pnl.toLocaleString()} ({item.roi_pct}%)
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => onRestore(item.snapshot)}
                className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} /> 還原此配置
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
