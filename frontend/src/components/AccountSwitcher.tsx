import React, { useState } from 'react'
import { Plus, Trash2, Edit2, Wallet } from 'lucide-react'
import { Account } from '../types/rebalance'

interface AccountSwitcherProps {
  accounts: Account[]
  currentAccountId: string
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function AccountSwitcher({
  accounts,
  currentAccountId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: AccountSwitcherProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const currentAccount = accounts.find(a => a.id === currentAccountId)

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400 shrink-0">
          <Wallet size={20} />
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-48 font-medium"
              placeholder="帳戶名稱"
              autoFocus
            />
            <button
              onClick={() => { onRename(currentAccountId, editName); setIsEditing(false) }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-xl transition-all font-semibold shrink-0"
            >
              儲存
            </button>
            <button
              onClick={() => setIsEditing(false)}
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
                onChange={e => onSwitch(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer min-w-[150px] transition-colors"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
              <button
                onClick={() => { setEditName(currentAccount?.name ?? ''); setIsEditing(true) }}
                className="text-slate-400 hover:text-blue-400 p-1.5 hover:bg-slate-700/40 rounded-lg transition-all"
                title="重命名帳戶"
              >
                <Edit2 size={14} />
              </button>
              {accounts.length > 1 && (
                <button
                  onClick={() => {
                    if (window.confirm('確定要刪除此帳戶與其所有本地設定嗎？此動作無法復原。')) {
                      onDelete(currentAccountId)
                    }
                  }}
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
        {isAdding ? (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onCreate(newName); setNewName(''); setIsAdding(false) }
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-48 font-medium"
              placeholder="輸入新帳戶名稱"
              autoFocus
            />
            <button
              onClick={() => { onCreate(newName); setNewName(''); setIsAdding(false) }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-semibold transition-all shrink-0"
            >
              確認建立
            </button>
            <button
              onClick={() => { setNewName(''); setIsAdding(false) }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-2 rounded-xl transition-all shrink-0"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-blue-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={14} /> 新增帳戶
          </button>
        )}
      </div>
    </div>
  )
}
