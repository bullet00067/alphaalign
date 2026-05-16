import React, { useState, useMemo } from 'react';
import { Plus, Minus, AlertCircle, CheckCircle2, TrendingUp, Save } from 'lucide-react';

const INITIAL_ALLOCATIONS = [
  { id: '1', category: '市值型股票', target_pct: 60, assets: [{ ticker: 'QQQM', shares: 50 }] },
  { id: '2', category: '高股息型', target_pct: 20, assets: [{ ticker: 'QYLD', shares: 100 }] },
  { id: '3', category: '美國公債', target_pct: 15, assets: [{ ticker: 'TLT', shares: 30 }] },
  { id: '4', category: '現金', target_pct: 5, assets: [] }
];

export default function AllocationDashboard() {
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);

  const totalAllocation = useMemo(() => {
    return allocations.reduce((sum, item) => sum + (item.target_pct || 0), 0);
  }, [allocations]);

  const remaining = 100 - totalAllocation;
  const isPerfect = remaining === 0;

  const updateAllocation = (id, newPct) => {
    const validPct = Math.max(0, Math.min(100, Number(newPct) || 0));
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, target_pct: validPct } : a
    ));
  };

  const handleSimulate = () => {
    // API Call logic here
    console.log("Simulating with:", allocations);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="text-blue-400" /> AlphaAlign
            </h1>
            <p className="text-slate-400 mt-2 text-sm md:text-base">
              互動式資產再平衡與監控平台
            </p>
          </div>
        </div>

        {/* Unallocated Pool Progress */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">資金配置總和 (Total Allocation)</h2>
            <span className={`text-xl font-bold px-3 py-1 rounded-full ${
              isPerfect ? 'bg-green-500/20 text-green-400' : 
              remaining < 0 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {totalAllocation}% / 100%
            </span>
          </div>
          
          <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden flex">
            <div 
              className={`h-full transition-all duration-500 ease-out ${
                remaining < 0 ? 'bg-red-500' : isPerfect ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(totalAllocation, 100)}%` }}
            />
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            {isPerfect ? (
              <p className="text-green-400 flex items-center gap-1"><CheckCircle2 size={16} /> 配置完美，可執行再平衡</p>
            ) : remaining > 0 ? (
              <p className="text-blue-400 flex items-center gap-1"><AlertCircle size={16} /> 尚有 {remaining}% 待分配資金</p>
            ) : (
              <p className="text-red-400 flex items-center gap-1"><AlertCircle size={16} /> 超額配置 {Math.abs(remaining)}%，請調降部分資產比例</p>
            )}
          </div>
        </div>

        {/* Asset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allocations.map((item) => (
            <div key={item.id} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl hover:border-slate-600/80 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">{item.category}</h3>
                <span className="text-xs font-mono bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                  {item.assets.map(a => a.ticker).join(', ') || 'CASH'}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => updateAllocation(item.id, item.target_pct - 1)}
                  className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <Minus size={18} />
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={item.target_pct}
                    onChange={(e) => updateAllocation(item.id, e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2 px-4 text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>

                <button 
                  onClick={() => updateAllocation(item.id, item.target_pct + 1)}
                  className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700/50">
          <button 
            disabled={!isPerfect}
            onClick={handleSimulate}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              isPerfect 
                ? 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <TrendingUp size={20} />
            僅單次試算 (Simulate Only)
          </button>
          
          <button 
            disabled={!isPerfect}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              isPerfect 
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save size={20} />
            更新配置並產出報告 (Save & Rebalance)
          </button>
        </div>

      </div>
    </div>
  );
}
