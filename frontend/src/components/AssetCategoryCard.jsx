import React from 'react';
import { Plus, Minus, Trash2, Edit2, Info } from 'lucide-react';

export default function AssetCategoryCard({
  item,
  updateCategoryName,
  updateAllocationPct,
  removeCategory,
  updateAsset,
  removeAsset,
  addAsset
}) {
  return (
    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl hover:border-slate-600/80 transition-colors">
      
      {/* Category Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700/50 pb-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Edit2 size={16} className="text-slate-500" />
          <input 
            type="text"
            value={item.category}
            onChange={(e) => updateCategoryName(item.id, e.target.value)}
            className="bg-transparent border-b border-dashed border-slate-500 text-xl font-bold text-slate-100 focus:outline-none focus:border-blue-400 w-full md:w-48"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 flex-1 md:flex-none">
            <button 
              onClick={() => updateAllocationPct(item.id, item.target_pct - 1)}
              className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors shrink-0"
            >
              <Minus size={16} />
            </button>
            <div className="relative w-24">
              <input
                type="number"
                value={item.target_pct}
                onChange={(e) => updateAllocationPct(item.id, e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-1 px-3 text-center text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <button 
              onClick={() => updateAllocationPct(item.id, item.target_pct + 1)}
              className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <button 
            onClick={() => removeCategory(item.id)}
            className="text-slate-500 hover:text-red-400 transition-colors p-2"
            title="刪除此分類"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      {/* Assets List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1 relative group cursor-help">
          <h4 className="text-sm font-medium text-slate-400">成分股 (Assets)</h4>
          <Info size={14} className="text-slate-500 hover:text-blue-400" />
          <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-700 text-xs text-slate-200 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
            此類別的目標資金將平均分配給以下所有標的 (Equal Weight)。
          </div>
        </div>
        
        {item.assets.length === 0 && (
          <p className="text-sm text-slate-500 italic px-1">目前無指定標的，將視為持有現金或無需操作。</p>
        )}

        {item.assets.map((asset, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/30">
            <div className="flex-1 w-full relative">
              <label className="text-xs text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">標的代碼</label>
              <input 
                type="text" 
                placeholder="例如: QQQM"
                value={asset.ticker}
                onChange={(e) => updateAsset(item.id, idx, 'ticker', e.target.value)}
                className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none uppercase"
              />
            </div>
            <div className="flex-1 w-full relative">
              <label className="text-xs text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">目前持股 (股)</label>
              <input 
                type="number" 
                placeholder="持股數"
                value={asset.shares}
                onChange={(e) => updateAsset(item.id, idx, 'shares', e.target.value)}
                className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 w-full relative">
              <label className="text-xs text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">平均成本 ($)</label>
              <input 
                type="number" 
                placeholder="選填"
                value={asset.average_cost}
                onChange={(e) => updateAsset(item.id, idx, 'average_cost', e.target.value)}
                className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button 
              onClick={() => removeAsset(item.id, idx)}
              className="text-slate-500 hover:text-red-400 transition-colors p-2 w-full sm:w-auto flex justify-center"
              title="移除此標的"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        
        <button 
          onClick={() => addAsset(item.id)}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-slate-800"
        >
          <Plus size={14} /> 新增成分股
        </button>
      </div>
    </div>
  );
}
