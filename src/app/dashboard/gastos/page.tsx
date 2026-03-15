'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Gasto {
  id: string
  descripcion: string
  monto: number
  categoria: string
  fecha: string
  recurrente: boolean
  notas: string | null
}

const CATEGORIAS = ['herramienta', 'servicio', 'oficina', 'sueldo', 'otro']
const CAT_COLOR: Record<string, string> = {
  herramienta: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  servicio:    'bg-purple-900/40 text-purple-400 border-purple-700/40',
  oficina:     'bg-orange-900/40 text-orange-400 border-orange-700/40',
  sueldo:      'bg-green-900/40 text-green-400 border-green-700/40',
  otro:        'bg-gray-800 text-gray-400 border-gray-700',
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const FORM_VACIO = { descripcion: '', monto: '', categoria: 'herramienta', fecha: '', recurrente: false, notas: '' }

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gastos', { headers: authH() })
      const data = await res.json()
      setGastos(data.gastos || [])
      setTotal(data.total || 0)
    } catch { setError('Error al cargar gastos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchGastos() }, [fetchGastos])

  // Totales por categoría
  const porCategoria = gastos.reduce<Record<string, number>>((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  const recurrente = gastos.filter(g => g.recurrente).reduce((s, g) => s + g.monto, 0)

  async function handleSave() {
    if (!form.descripcion.trim()) { setError('La descripción es requerida'); return }
    if (!form.monto) { setError('El monto es requerido'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST', headers: authH(), body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setModalOpen(false)
      setForm(FORM_VACIO)
      fetchGastos()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/gastos/${id}`, { method: 'DELETE', headers: authH() })
      setDeleteId(null)
      fetchGastos()
    } catch { setError('Error al eliminar') }
  }

  // Fecha default: hoy
  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos</h1>
          <p className="text-gray-400 text-sm mt-1">Costos operativos de la agencia</p>
        </div>
        <button
          onClick={() => { setForm({ ...FORM_VACIO, fecha: hoy }); setModalOpen(true); setError('') }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo gasto
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Total registrado</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(total)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Recurrentes</p>
          <p className="text-xl font-bold text-orange-400">{formatCurrency(recurrente)}</p>
        </div>
        {Object.entries(porCategoria).slice(0, 2).map(([cat, monto]) => (
          <div key={cat} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1 capitalize">{cat}</p>
            <p className="text-xl font-bold text-gray-300">{formatCurrency(monto)}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gastos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="font-medium">No hay gastos registrados</p>
            <p className="text-sm mt-1">Registrá Claude, Hetzner, etc. con el botón de arriba</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Descripción</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Categoría</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Fecha</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Monto</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {gastos.map(g => (
                <tr key={g.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{g.descripcion}</p>
                      {g.recurrente && (
                        <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded-md">rec</span>
                      )}
                    </div>
                    {g.notas && <p className="text-xs text-gray-500 mt-0.5">{g.notas}</p>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${CAT_COLOR[g.categoria] || CAT_COLOR.otro}`}>
                      {g.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-400">{new Date(g.fecha).toLocaleDateString('es-AR')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-red-400">{formatCurrency(g.monto)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setDeleteId(g.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo gasto */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Nuevo gasto</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción *</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej: Claude Pro, Hetzner VPS, etc."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto *</label>
                  <input
                    type="number"
                    value={form.monto}
                    onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                    placeholder="50000"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha || hoy}
                    onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(p => ({ ...p, recurrente: !p.recurrente }))}
                  className={`w-10 h-5 rounded-full transition-colors ${form.recurrente ? 'bg-yellow-400' : 'bg-gray-700'} relative`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.recurrente ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Gasto recurrente mensual</span>
              </label>

              {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Registrar gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar gasto?</h3>
            <p className="text-gray-400 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}