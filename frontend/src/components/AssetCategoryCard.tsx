import React, { useState } from 'react'
import { Plus, Minus, Trash2, Edit2, Info, GripVertical } from 'lucide-react'
import { CategoryAllocation, AssetItem } from '../types/rebalance'

interface AssetCategoryCardProps {
  item: CategoryAllocation
  categories: { id: string; name: string }[]
  updateCategoryName: (id: string, newName: string) => void
  updateAllocationPct: (id: string, newPct: number | string) => void
  removeCategory: (id: string) => void
  updateAsset: (categoryId: string, assetIndex: number, field: keyof AssetItem, value: string | number) => void
  removeAsset: (categoryId: string, assetIndex: number) => void
  addAsset: (categoryId: string) => void
  onMoveAsset: (sourceCategoryId: string, sourceAssetIndex: number, targetCategoryId: string) => void
}

export default function AssetCategoryCard({
  item,
  categories,
  updateCategoryName,
  updateAllocationPct,
  removeCategory,
  updateAsset,
  removeAsset,
  addAsset,
  onMoveAsset,
}: AssetCategoryCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isCashCategory =
    item.category.includes('現金') || item.category.toUpperCase().includes('CASH')

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        try {
          const dataStr = e.dataTransfer.getData('text/plain')
          if (dataStr) {
            const { sourceCategoryId, assetIndex } = JSON.parse(dataStr)
            onMoveAsset(sourceCategoryId, assetIndex, item.id)
          }
        } catch (err) {
          console.error('Drop error:', err)
        }
      }}
      className={`bg-slate-800/40 backdrop-blur-md border p-6 rounded-2xl transition-all duration-300 ${
        isDragOver
          ? 'border-blue-500 bg-slate-800/80 shadow-[0_0_25px_rgba(59,130,246,0.3)] scale-[1.005]'
          : 'border-slate-700/50 hover:border-slate-600/80'
      }`}
    >
      {/* Category Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700/50 pb-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Edit2 size={16} className="text-slate-500" />
          <input
            type="text"
            value={item.category}
            onChange={e => updateCategoryName(item.id, e.target.value)}
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
                onChange={e => updateAllocationPct(item.id, e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-1 px-3 text-center text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                %
              </span>
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
          <h4 className="text-sm font-medium text-slate-400">
            {isCashCategory ? '現金項目 (Cash Assets)' : '成分股 (Assets)'}
          </h4>
          <Info size={14} className="text-slate-500 hover:text-blue-400" />
          <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-700 text-xs text-slate-200 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
            {isCashCategory
              ? '在此分類下的現金項目將會直接計入資產總額中。'
              : '此類別的目標資金將平均分配給以下所有標的 (Equal Weight)。可直接拖曳成分股至其他類別！手機平板等觸控裝置可直接使用選單一鍵移動。'}
          </div>
        </div>

        {item.assets.length === 0 && (
          <p className="text-sm text-slate-500 italic px-1 py-4 text-center border border-dashed border-slate-700/40 rounded-xl">
            拖曳標的至此，或點擊下方新增成分股
          </p>
        )}

        {item.assets.map((asset, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData(
                'text/plain',
                JSON.stringify({ sourceCategoryId: item.id, assetIndex: idx })
              )
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-slate-900/40 p-4 lg:p-3 rounded-xl border border-slate-700/30 cursor-grab active:cursor-grabbing hover:bg-slate-800/60 hover:border-slate-500/30 transition-all duration-200 group relative pl-9 pr-10 lg:pr-3"
          >
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-400 transition-colors pointer-events-none">
              <GripVertical size={16} />
            </div>

            <div className="grid grid-cols-2 lg:flex lg:flex-row items-center gap-3 w-full">
              {/* Ticker */}
              <div className="col-span-2 lg:flex-1 relative">
                <label className="text-[10px] text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">
                  {isCashCategory ? '項目名稱' : '標的代碼'}
                </label>
                <input
                  type="text"
                  placeholder={isCashCategory ? '例如: 台幣活存' : '例如: QQQM'}
                  value={asset.ticker}
                  onChange={e => updateAsset(item.id, idx, 'ticker', e.target.value)}
                  className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none uppercase text-sm lg:text-base"
                />
              </div>

              {/* Shares */}
              <div className={`${isCashCategory ? 'col-span-2 lg:flex-1' : 'col-span-1 lg:flex-1'} relative`}>
                <label className="text-[10px] text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">
                  {isCashCategory ? '目前金額 ($)' : '目前持股 (股)'}
                </label>
                <input
                  type="number"
                  placeholder={isCashCategory ? '金額' : '持股數'}
                  value={asset.shares}
                  onChange={e => updateAsset(item.id, idx, 'shares', e.target.value)}
                  className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>

              {/* Average Cost */}
              {!isCashCategory && (
                <div className="col-span-1 lg:flex-1 relative">
                  <label className="text-[10px] text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded">
                    成交均價 ($)
                  </label>
                  <input
                    type="number"
                    placeholder="選填"
                    value={asset.average_cost}
                    onChange={e => updateAsset(item.id, idx, 'average_cost', e.target.value)}
                    className="w-full bg-transparent border border-slate-600 rounded-lg py-2 px-3 text-white focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                  />
                </div>
              )}

              {/* Move selector */}
              {categories.length > 1 && (
                <div className="col-span-2 lg:w-auto relative shrink-0">
                  <label className="text-[10px] text-slate-500 absolute -top-2 left-2 bg-slate-800 px-1 rounded block lg:hidden">
                    移至分類 (Move to)
                  </label>
                  <select
                    value={item.id}
                    onChange={e => {
                      const targetId = e.target.value
                      if (targetId !== item.id) onMoveAsset(item.id, idx, targetId)
                    }}
                    className="w-full lg:w-32 bg-slate-900/60 border border-slate-600 rounded-lg py-2 px-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value={item.id} disabled>移動分類...</option>
                    {categories
                      .filter(c => c.id !== item.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          ➡ {c.name || '未命名分類'}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={() => removeAsset(item.id, idx)}
              className="absolute right-2.5 top-2.5 lg:static text-slate-500 hover:text-red-400 transition-colors p-2 lg:p-1.5 flex justify-center shrink-0"
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
  )
}
