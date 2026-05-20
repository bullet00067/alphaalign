import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Plus, AlertCircle, CheckCircle2, TrendingUp, Save, Loader2, Sparkles, Trash2, Edit2, Wallet } from 'lucide-react';
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
  // --- Multi-Account Setup ---
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('alphaalign_accounts');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: '預設帳戶' }];
  });

  const [currentAccountId, setCurrentAccountId] = useState(() => {
    return localStorage.getItem('alphaalign_current_account_id') || 'default';
  });

  // Inline UI states for Account management
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editAccountName, setEditAccountName] = useState('');

  // Ref to prevent race condition saves during account switching
  const isSwitchingRef = React.useRef(false);

  // Active Portfolio States (parameterized by currentAccountId)
  const [allocations, setAllocations] = useState(() => {
    const activeId = localStorage.getItem('alphaalign_current_account_id') || 'default';
    const saved = localStorage.getItem(`alphaalign_allocations_${activeId}`) 
      || localStorage.getItem('alphaalign_allocations'); // Backward compatibility fallback
    return saved ? JSON.parse(saved) : INITIAL_ALLOCATIONS;
  });

  const [depositCash, setDepositCash] = useState(() => {
    const activeId = localStorage.getItem('alphaalign_current_account_id') || 'default';
    const saved = localStorage.getItem(`alphaalign_deposit_cash_${activeId}`)
      || localStorage.getItem('alphaalign_deposit_cash'); // Backward compatibility fallback
    return saved !== null ? Number(saved) : 0;
  });

  const [freeCash, setFreeCash] = useState(() => {
    const activeId = localStorage.getItem('alphaalign_current_account_id') || 'default';
    const saved = localStorage.getItem(`alphaalign_free_cash_${activeId}`)
      || localStorage.getItem('alphaalign_free_cash'); // Backward compatibility fallback
    return saved !== null ? Number(saved) : 0;
  });
  
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

  // --- Fetch History from API (Filtered by Current Account ID) ---
  const fetchHistory = async (accId = currentAccountId) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.get(`${apiUrl}/api/rebalance/history?account_id=${accId}`);
      setHistoryData(response.data);
    } catch (err) {
      console.error("無法取得歷史紀錄:", err);
    }
  };

  useEffect(() => {
    fetchHistory(currentAccountId);
  }, [currentAccountId]);

  // --- Persist active session states locally ---
  useEffect(() => {
    if (isSwitchingRef.current) return;
    localStorage.setItem(`alphaalign_allocations_${currentAccountId}`, JSON.stringify(allocations));
  }, [allocations, currentAccountId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    localStorage.setItem(`alphaalign_deposit_cash_${currentAccountId}`, depositCash.toString());
  }, [depositCash, currentAccountId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    localStorage.setItem(`alphaalign_free_cash_${currentAccountId}`, freeCash.toString());
  }, [freeCash, currentAccountId]);

  // Reset the switching flag last
  useEffect(() => {
    isSwitchingRef.current = false;
  }, [currentAccountId]);

  // --- Account Management Core Handlers ---
  const handleSwitchAccount = (accountId) => {
    isSwitchingRef.current = true;

    // 1. Save current account values
    localStorage.setItem(`alphaalign_allocations_${currentAccountId}`, JSON.stringify(allocations));
    localStorage.setItem(`alphaalign_deposit_cash_${currentAccountId}`, depositCash.toString());
    localStorage.setItem(`alphaalign_free_cash_${currentAccountId}`, freeCash.toString());

    // 2. Load target account values
    const savedAllocations = localStorage.getItem(`alphaalign_allocations_${accountId}`);
    const savedDepositCash = localStorage.getItem(`alphaalign_deposit_cash_${accountId}`);
    const savedFreeCash = localStorage.getItem(`alphaalign_free_cash_${accountId}`);

    setAllocations(savedAllocations ? JSON.parse(savedAllocations) : INITIAL_ALLOCATIONS);
    setDepositCash(savedDepositCash !== null ? Number(savedDepositCash) : 0);
    setFreeCash(savedFreeCash !== null ? Number(savedFreeCash) : 0);

    setCurrentAccountId(accountId);
    localStorage.setItem('alphaalign_current_account_id', accountId);
    setReportData(null);
    setError(null);
  };

  const handleCreateAccount = (name) => {
    if (!name || !name.trim()) return;
    const newId = 'acc_' + Date.now();
    const newAccount = { id: newId, name: name.trim() };
    const updated = [...accounts, newAccount];
    
    setAccounts(updated);
    localStorage.setItem('alphaalign_accounts', JSON.stringify(updated));

    // Initialize the new account's allocations by copying current screen template
    localStorage.setItem(`alphaalign_allocations_${newId}`, JSON.stringify(allocations));
    localStorage.setItem(`alphaalign_deposit_cash_${newId}`, depositCash.toString());
    localStorage.setItem(`alphaalign_free_cash_${newId}`, freeCash.toString());

    // Switch to it immediately
    isSwitchingRef.current = true;
    setCurrentAccountId(newId);
    localStorage.setItem('alphaalign_current_account_id', newId);
    setReportData(null);
    setError(null);
  };

  const handleRenameAccount = (accountId, newName) => {
    if (!newName || !newName.trim()) return;
    const updated = accounts.map(acc => {
      if (acc.id === accountId) {
        return { ...acc, name: newName.trim() };
      }
      return acc;
    });
    setAccounts(updated);
    localStorage.setItem('alphaalign_accounts', JSON.stringify(updated));
  };

  const handleDeleteAccount = (accountId) => {
    if (accounts.length <= 1) {
      alert("至少必須保留一個帳戶！");
      return;
    }
    if (!confirm("確定要刪除此帳戶與其所有本地設定嗎？此動作無法復原。")) {
      return;
    }

    const updated = accounts.filter(acc => acc.id !== accountId);
    setAccounts(updated);
    localStorage.setItem('alphaalign_accounts', JSON.stringify(updated));

    // Clear local storage for this deleted account
    localStorage.removeItem(`alphaalign_allocations_${accountId}`);
    localStorage.removeItem(`alphaalign_deposit_cash_${accountId}`);
    localStorage.removeItem(`alphaalign_free_cash_${accountId}`);

    // Switch to the fallback account
    handleSwitchAccount(updated[0].id);
  };

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

  const moveAsset = (sourceCategoryId, sourceAssetIndex, targetCategoryId) => {
    const sId = sourceCategoryId.toString();
    const tId = targetCategoryId.toString();
    if (sId === tId) return;
    
    const sourceCat = allocations.find(c => c.id.toString() === sId);
    if (!sourceCat) return;
    const assetToMove = sourceCat.assets[sourceAssetIndex];
    if (!assetToMove) return;

    setAllocations(allocations.map(cat => {
      const cId = cat.id.toString();
      if (cId === sId) {
        return {
          ...cat,
          assets: cat.assets.filter((_, idx) => idx !== sourceAssetIndex)
        };
      }
      if (cId === tId) {
        return {
          ...cat,
          assets: [...cat.assets, assetToMove]
        };
      }
      return cat;
    }));
    setReportData(null);
  };

  // --- Map Allocation Payload Helper ---
  const getPayload = () => {
    return {
      account_id: currentAccountId,
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

  // --- Delete a past snapshot from history ---
  const handleDeleteHistory = async (recordId) => {
    if (!confirm("確定要刪除此筆歷史紀錄嗎？此動作將無法復原。")) {
      return;
    }
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await axios.delete(`${apiUrl}/api/rebalance/history/${recordId}`);
      // Refresh the list for the current active account
      fetchHistory(currentAccountId);
    } catch (err) {
      console.error("無法刪除歷史紀錄:", err);
      alert("刪除失敗：" + (err.response?.data?.detail || err.message));
    }
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

        {/* Account Switcher Bar */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400 shrink-0">
              <Wallet size={20} />
            </div>
            {isEditingAccount ? (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-48 font-medium"
                  placeholder="帳戶名稱"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleRenameAccount(currentAccountId, editAccountName);
                    setIsEditingAccount(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-xl transition-all font-semibold shrink-0"
                >
                  儲存
                </button>
                <button
                  onClick={() => setIsEditingAccount(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-2 rounded-xl transition-all shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">當前券商帳戶</span>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={currentAccountId}
                    onChange={(e) => handleSwitchAccount(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer min-w-[150px] transition-colors"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const currentAcc = accounts.find(a => a.id === currentAccountId);
                      setEditAccountName(currentAcc ? currentAcc.name : '');
                      setIsEditingAccount(true);
                    }}
                    className="text-slate-400 hover:text-blue-400 p-1.5 hover:bg-slate-700/40 rounded-lg transition-all"
                    title="重命名帳戶"
                  >
                    <Edit2 size={14} />
                  </button>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => handleDeleteAccount(currentAccountId)}
                      className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-slate-700/40 rounded-lg transition-all"
                      title="刪除此帳戶"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAddingAccount ? (
              <div className="flex items-center gap-2 w-full md:w-auto animate-fadeIn">
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-48 font-medium"
                  placeholder="輸入新帳戶名稱"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleCreateAccount(newAccountName);
                    setNewAccountName('');
                    setIsAddingAccount(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-semibold transition-all shrink-0"
                >
                  確認建立
                </button>
                <button
                  onClick={() => {
                    setNewAccountName('');
                    setIsAddingAccount(false);
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-2 rounded-xl transition-all shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingAccount(true)}
                className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus size={14} /> 新增帳戶
              </button>
            )}
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
                支援兩階段混合導入：您可以先配置<strong>大類別目標百分比</strong>（例如 <code>市值型 50%, 高股息 40%</code>），並貼上<strong>成分股持股明細（含股數與成交均價）</strong>。系統會自動辨識並完成歸屬與記帳！
              </p>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  rows={6}
                  value={wizardText}
                  onChange={(e) => setWizardText(e.target.value)}
                  placeholder={`1.先配置資產類型百分比
市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%

2.設定成分股後，自動將這些成分股依照系統判斷排入各項資產類型
006208 1516股 均價109.14
00679B 3306股 均價 28.32
00712 3201股 均價 9.57
台幣活存 50000`}
                  className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent font-mono"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 mr-1">快速套用範例：</span>
                <button
                  type="button"
                  onClick={() => setWizardText("1.先配置資產類型百分比\n市值型 50%, 高股息型 40%, 債券型 5%, 現金 5%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\n006208 1516股 均價109.14\n00679B 3306股 均價 28.32\n00712 3201股 均價 9.57\n00878 22856股 均價 19.74\n00881 2000股 均價 15.13\n2330 11股 均價 1847.72\n台幣活存 50000")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  兩階段混合台股配置
                </button>
                <button
                  type="button"
                  onClick={() => setWizardText("1.先配置資產類型百分比\n市值型 60%, 高股息型 10%, 債券型 20%, 現金 10%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\nVOO 50股 均價 460.50\nQQQM 30股 均價 175.20\nSCHD 25股 均價 78.40\nTLT 100股 均價 92.15\n美元現金 8500")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  全球股債平衡型 (美股)
                </button>
                <button
                  type="button"
                  onClick={() => setWizardText("1.先配置資產類型百分比\n市值型 45%, 高股息型 45%, 債券型 5%, 現金 5%\n\n2.設定成分股後， 自動將這些成分股依照系統判斷排入各項資產類型\n2330 500股 均價 780.00\n0050 1500股 均價 152.40\n00919 5000股 均價 22.15\n00878 8000股 均價 20.80\n00679B 1000股 均價 29.50\nTWD活存 35000")}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  台美科技高優息組合
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
              categories={allocations.map(c => ({ id: c.id, name: c.category }))}
              updateCategoryName={updateCategoryName}
              updateAllocationPct={updateAllocationPct}
              removeCategory={removeCategory}
              updateAsset={updateAsset}
              removeAsset={removeAsset}
              addAsset={addAsset}
              onMoveAsset={moveAsset}
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
        <HistoryView 
          historyData={historyData} 
          onRestore={handleRestore} 
          onDelete={handleDeleteHistory} 
        />


      </div>
    </div>
  );
}
