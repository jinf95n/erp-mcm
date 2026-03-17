// src/app/dashboard/pagos/page.tsx
// Lista de pagos con edición y eliminación por ID

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Pago {
  id: string
  monto: number
  tipoPago: string
  fecha: string
  notas: string | null
  venta: {
    id: string
    nombreProyecto: string
    precioTotal: number
    cliente: { nombre: string; empresa: string | null }
  }
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH()    { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const TIPOS_COLOR: Record<string, string> = {
  inicial: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  cuota:   'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  final:   'bg-green-900/40 text-green-400 border-green-700/40',
}

export default function PagosPage() {
  const [pagos, setPagos]     = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  // Editar
  const [editId, setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ monto: '', tipoPago: 'cuota', notas: '', fecha: '' })
  const [saving, setSaving]   = useState(false)
  // Eliminar
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchPagos = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/pagos', { headers: authH() })
      const data = await res.json()
      setPagos(data.pagos || [])
    } catch { setError('Error al cargar pagos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPagos() }, [fetchPagos])

  function openEdit(p: Pago) {
    setEditId(p.id)
    setEditForm({
      monto:    p.monto.toString(),
      tipoPago: p.tipoPago,
      notas:    p.notas || '',
      fecha:    new Date(p.fecha).toISOString().split('T')[0],
    })
  }

  async function handleEdit() {
    if (!editId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pagos/${editId}`, {
        method: 'PUT', headers: authH(), body: JSON.stringify(editForm),
      })
      if (res.ok) { setEditId(null); fetchPagos() }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/pagos/${id}`, { method: 'DELETE', headers: authH() })
      setDeleteId(null); fetchPagos()
    } catch { setError('Error al eliminar') }
  }

  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0)
  const porTipo: Record<string, number> = {}
  pagos.forEach(p => { porTipo[p.tipoPago] = (porTipo[p.tipoPago] || 0) + p.monto })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pagos</h1>
        <p className="text-gray-400 text-sm mt-1">Historial de cobros registrados</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total cobrado</p>
          <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Cantidad</p>
          <p className="text-xl font-bold text-white">{pagos.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Pagos iniciales</p>
          <p className="text-xl font-bold text-blue-400">{formatCurrency(porTipo.inicial || 0)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Cuotas</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency((porTipo.cuota || 0) + (porTipo.final || 0))}</p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pagos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="font-medium">No hay pagos registrados</p>
            <p className="text-sm mt-1">Los pagos se registran desde la sección Ventas</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Proyecto / Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Fecha</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Tipo</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Monto</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-white">{p.venta.nombreProyecto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.venta.cliente.nombre}{p.venta.cliente.empresa ? ` · ${p.venta.cliente.empresa}` : ''}
                    </p>
                    {p.notas && <p className="text-xs text-gray-500 mt-0.5 italic">{p.notas}</p>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-300">{new Date(p.fecha).toLocaleDateString('es-AR')}</span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${TIPOS_COLOR[p.tipoPago] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {p.tipoPago}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-yellow-400">{formatCurrency(p.monto)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal editar pago */}
      {editId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Editar pago</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto</label>
                <input type="number" value={editForm.monto}
                  onChange={e => setEditForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo</label>
                <select value={editForm.tipoPago}
                  onChange={e => setEditForm(p => ({ ...p, tipoPago: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="inicial">Inicial</option>
                  <option value="cuota">Cuota</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Fecha</label>
                <input type="date" value={editForm.fecha}
                  onChange={e => setEditForm(p => ({ ...p, fecha: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input type="text" value={editForm.notas}
                  onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-orange-400 bg-orange-950/30 border border-orange-800/40 rounded-xl px-3 py-2 mt-4">
              ⚠️ Al editar el monto se recalculan las distribuciones automáticamente.
            </p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditId(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar pago?</h3>
            <p className="text-gray-400 text-sm mb-1">Se eliminará el pago y sus distribuciones asociadas.</p>
            <p className="text-gray-600 text-xs mb-6">El estado de la venta se recalcula automáticamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}