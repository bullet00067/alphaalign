import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Plus, AlertCircle, CheckCircle2, TrendingUp, Save, Loader2 } from 'lucide-react';
import AssetCategoryCard from './AssetCategoryCard';
import SimulationReport from './SimulationReport';

const INITIAL_ALLOCATIONS = [
  { id: '1', category: '市值型股票', target_pct: 60, assets: [{ ticker: 'QQQM', shares: 50 }, { ticker: '0050.TW', shares: 0 }] },
  { id: '2', category: '高股息型', target_pct: 20, assets: [{ ticker: 'QYLD', shares: 100 }] },
  { id: '3', category: '美國公債', target_pct: 15, assets: [{ ticker: 'TLT', shares: 30 }] },
  { id: '4', category: '現金', target_pct: 5, assets: [] }
];

export default function AllocationDashboard() {
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [depositCash, setDepositCash] = useState(0);
  const [freeCash, setFreeCash] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const totalAllocation = useMemo(() => {
    return allocations.reduce((sum, item) => sum + (item.target_pct || 0), 0);
  }, [allocations]);

  const remaining = 100 - totalAllocation;
  const isPerfect = remaining === 0;

  // --- Category Actions ---
  const addCategory = () => {
    setAllocations([...allocations, {
      id: Date.now().toString(),
      category: '新資產類別',
      target_pct: 0,
      assets: []
    }]);
  };

  const removeCategory = (id) => {
    setAllocations(allocations.filter(a => a.id !== id));
    setReportData(null);
  };

  const updateCategoryName = (id, newName) => {
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, category: newName } : a
    ));
  };

  const updateAllocationPct = (id, newPct) => {
    const validPct = Math.max(0, Math.min(100, Number(newPct) || 0));
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, target_pct: validPct } : a
    ));
    setReportData(null);
    setError(null);
  };

  // --- Asset Actions ---
  const addAsset = (categoryId) => {
    setAllocations(allocations.map(a => {
      if (a.id === categoryId) {
        return { ...a, assets: [...a.assets, { ticker: '', shares: 0 }] };
      }
      return a;
    }));
  };

  const removeAsset = (categoryId, assetIndex) => {
    setAllocations(allocations.map(a => {
      if (a.id === categoryId) {
        const newAssets = [...a.assets];
        newAssets.splice(assetIndex, 1);
        return { ...a, assets: newAssets };
      }
      return a;
    }));
    setReportData(null);
  };

  const updateAsset = (categoryId, assetIndex, field, value) => {
    setAllocations(allocations.map(a => {
      if (a.id === categoryId) {
        const newAssets = [...a.assets];
        newAssets[assetIndex] = { ...newAssets[assetIndex], [field]: value };
        return { ...a, assets: newAssets };
      }
      return a;
    }));
  };

  // --- API Call ---
  const handleSimulate = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);

    // Validate empty tickers
    for (const cat of allocations) {
      for (const asset of cat.assets) {
        if (!asset.ticker.trim()) {
          setError(`請填寫「${cat.category}」中所有標的的代號 (Ticker)`);
          setIsLoading(false);
          return;
        }
      }
    }

    const payload = {
      deposit_cash: Number(depositCash) || 0,
      current_free_cash: Number(freeCash) || 0,
      allocations: allocations.map(cat => ({
        category: cat.category,
        target_pct: cat.target_pct / 100.0,
        assets: cat.assets.map(a => ({
          ticker: a.ticker.toUpperCase().trim(),
          current_shares: Number(a.shares) || 0
        }))
      }))
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/rebalance/calculate`, payload);
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "無法連線至伺服器或發生未知錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-6 md:p-12 font-sans pb-24">
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

        {/* Extra Cash Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-2xl">
            <label className="block text-sm font-medium text-slate-300 mb-2">本次預計額外投入資金 (Deposit Cash)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input 
                type="number" 
                value={depositCash}
                onChange={(e) => setDepositCash(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-2xl">
            <label className="block text-sm font-medium text-slate-300 mb-2">目前未投入之閒置現金 (Free Cash)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input 
                type="number" 
                value={freeCash}
                onChange={(e) => setFreeCash(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl py-2 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Asset Cards */}
        <div className="grid grid-cols-1 gap-6">
          {allocations.map((item) => (
            <AssetCategoryCard 
              key={item.id}
              item={item}
              updateCategoryName={updateCategoryName}
              updateAllocationPct={updateAllocationPct}
              removeCategory={removeCategory}
              updateAsset={updateAsset}
              removeAsset={removeAsset}
              addAsset={addAsset}
            />
          ))}
          
          {/* Add Category Button */}
          <button 
            onClick={addCategory}
            className="w-full border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-colors bg-slate-800/20 hover:bg-slate-800/40"
          >
            <Plus size={24} />
            <span className="font-medium">新增資產類別 (Add Category)</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700/50">
          <button 
            disabled={!isPerfect || isLoading}
            onClick={handleSimulate}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              !isPerfect || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white shadow-lg'
            }`}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
            {isLoading ? '正在獲取即時報價...' : '僅單次試算 (Simulate Only)'}
          </button>
          
          <button 
            disabled={!isPerfect || isLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              !isPerfect || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            <Save size={20} />
            更新配置並產出報告 (Save & Rebalance)
          </button>
        </div>

        {/* Simulation Report Section */}
        <SimulationReport reportData={reportData} />

      </div>
    </div>
  );
}
