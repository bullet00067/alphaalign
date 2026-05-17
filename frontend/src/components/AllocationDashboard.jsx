import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Plus, AlertCircle, CheckCircle2, TrendingUp, Save, Loader2, Sparkles } from 'lucide-react';
import AssetCategoryCard from './AssetCategoryCard';
import SimulationReport from './SimulationReport';
import HistoryView from './HistoryView';

const INITIAL_ALLOCATIONS = [
  { id: '1', category: '市值型股票', target_pct: 60, assets: [{ ticker: 'QQQM', shares: 50, average_cost: 0 }, { ticker: '0050.TW', shares: 0, average_cost: 0 }] },
  { id: '2', category: '高股息型', target_pct: 20, assets: [{ ticker: 'QYLD', shares: 100, average_cost: 0 }] },
  { id: '3', category: '美國公債', target_pct: 15, assets: [{ ticker: 'TLT', shares: 30, average_cost: 0 }] },
  { id: '4', category: '現金', target_pct: 5, assets: [] }
];

export default function AllocationDashboard() {
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [depositCash, setDepositCash] = useState(0);
  const [freeCash, setFreeCash] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  // --- Smart Portfolio Wizard State ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardText, setWizardText] = useState('');
  const [isWizardLoading, setIsWizardLoading] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);

  const totalAllocation = useMemo(() => {
    return allocations.reduce((sum, item) => sum + (item.target_pct || 0), 0);
  }, [allocations]);

  const remaining = 100 - totalAllocation;
  const isPerfect = remaining === 0;

  // --- Fetch History from API ---
  const fetchHistory = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.get(`${apiUrl}/api/rebalance/history`);
      setHistoryData(response.data);
    } catch (err) {
      console.error("無法取得歷史紀錄:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
        return { ...a, assets: [...a.assets, { ticker: '', shares: 0, average_cost: 0 }] };
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

  // --- Map Allocation Payload Helper ---
  const getPayload = () => {
    return {
      deposit_cash: Number(depositCash) || 0,
      current_free_cash: Number(freeCash) || 0,
      allocations: allocations.map(cat => ({
        category: cat.category,
        target_pct: cat.target_pct / 100.0,
        assets: cat.assets.map(a => ({
          ticker: a.ticker.toUpperCase().trim(),
          current_shares: Number(a.shares) || 0,
          average_cost: Number(a.average_cost) || 0
        }))
      }))
    };
  };

  // --- API Call: Simulate Only ---
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

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/rebalance/calculate`, getPayload());
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "無法連線至伺服器或發生未知錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  // --- API Call: Save & Rebalance ---
  const handleSaveAndRebalance = async () => {
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

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/rebalance/save`, getPayload());
      setReportData(response.data.data);
      fetchHistory(); // Refresh the list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "無法連線至伺服器或發生未知錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Restore configuration from a past snapshot ---
  const handleRestore = (snapshot) => {
    if (!snapshot) return;
    
    const restoredAllocations = snapshot.allocations.map((cat, idx) => ({
      id: (idx + 1).toString(),
      category: cat.category,
      target_pct: Math.round(cat.target_pct * 100),
      assets: cat.assets.map(a => ({
        ticker: a.ticker,
        shares: a.current_shares,
        average_cost: a.average_cost || 0
      }))
    }));
    
    setAllocations(restoredAllocations);
    setDepositCash(snapshot.deposit_cash || 0);
    setFreeCash(snapshot.current_free_cash || 0);
    setReportData(null);
    setError(null);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWizardSubmit = async () => {
    if (!wizardText.trim()) return;
    setIsWizardLoading(true);
    setError(null);
    setWizardSuccess(false);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/rebalance/parse-wizard`, {
        input_text: wizardText
      });
      if (response.data && response.data.length > 0) {
        const newAllocations = response.data.map((cat, idx) => ({
          id: (idx + 1).toString(),
          category: cat.category,
          target_pct: cat.target_pct,
          assets: cat.assets.map(a => ({
            ticker: a.ticker,
            shares: a.shares || 0,
            average_cost: a.average_cost || 0
          }))
        }));
        setAllocations(newAllocations);
        setWizardSuccess(true);
        setReportData(null);
        setTimeout(() => {
          setWizardSuccess(false);
          setIsWizardOpen(false);
        }, 1500);
      } else {
        setError("未能解析出任何有效的標的或比例，請檢查輸入格式。");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "智慧導入解析失敗，請稍後再試。");
    } finally {
      setIsWizardLoading(false);
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

        {/* Smart Portfolio Wizard */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 backdrop-blur-xl border border-indigo-500/20 p-6 rounded-2xl shadow-xl transition-all duration-300">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="text-yellow-400 animate-pulse" size={20} />
              <h2 className="text-lg font-semibold text-white tracking-wide">🧙‍♂️ 智慧一鍵配置精靈 (Smart Import)</h2>
            </div>
            <button
              onClick={() => setIsWizardOpen(!isWizardOpen)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all"
            >
              {isWizardOpen ? '收合精靈 (Collapse)' : '展開精靈 (Expand)'}
            </button>
          </div>

          {isWizardOpen && (
            <div className="mt-5 space-y-4 border-t border-indigo-500/10 pt-4 transition-all animate-fadeIn">
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                直接貼上您的資產分配計畫（例如：從 ChatGPT 產生的計畫或是手寫筆記）。
                系統會自動解析代號，並幫您自動分類至<strong>「市值型」、「高股息」、「美債」、「現金」</strong>中！
              </p>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  rows={4}
                  value={wizardText}
                  onChange={(e) => setWizardText(e.target.value)}
                  placeholder={`請輸入您的資產分配計畫，例如：
0050 30%
0056 25%
00679B 30%
台幣活存 15%`}
                  className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent font-mono"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 mr-1">快速套用範例：</span>
                <button
                  type="button"
                  onClick={() => setWizardText("0050 30%\n0056 25%\n00679B 30%\n台幣活存 15%")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  經典台股配置 (30/25/30/15)
                </button>
                <button
                  type="button"
                  onClick={() => setWizardText("VOO 40%\nSCHD 20%\nTLT 30%\nUSD_美金現金 10%")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  經典美股平衡型 (40/20/30/10)
                </button>
                <button
                  type="button"
                  onClick={() => setWizardText("QQQM 40%\n2330 30%\n00878 15%\n外幣活存 15%")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  台美科技雙引擎 (40/30/15/15)
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardText('')}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  清空 (Clear)
                </button>
                <button
                  type="button"
                  onClick={handleWizardSubmit}
                  disabled={isWizardLoading || !wizardText.trim()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isWizardLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> 解析中...
                    </>
                  ) : wizardSuccess ? (
                    <>
                      <CheckCircle2 size={14} className="text-green-300" /> 導入成功！
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> 一鍵智慧分類導入 (Import)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
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
            onClick={handleSaveAndRebalance}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
              !isPerfect || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {isLoading ? '正在進行儲存並計算...' : '更新配置並產出報告 (Save & Rebalance)'}
          </button>
        </div>

        {/* Simulation Report Section */}
        <SimulationReport reportData={reportData} />

        {/* Historical Track section */}
        <HistoryView historyData={historyData} onRestore={handleRestore} />

      </div>
    </div>
  );
}
