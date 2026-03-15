'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Trash2, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Cliente { id: string; nombre: string; empresa: string | null }
interface CobroMantenimiento {
  id: string; monto: number; fecha: string; notas: string | null
}
interface Mantenimiento {
  id: string
  descripcion: string
  montoMensual: number
  costoDesarrollador: number
  desarrolladorNombre: string | null
  activo: boolean
  fechaInicio: string
  notas: string | null
  clienteId: string | null
  cliente: Cliente | null
  cobros: CobroMantenimiento[]
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const FORM_VACIO = {
  descripcion: '', montoMensual: '', costoDesarrollador: '',
  desarrolladorNombre: 'Juan', clienteId: '', fechaInicio: '', notas: '',
}

export default function MantenimientoPage() {
  const [items, setItems] = useState<Mantenimiento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [totalMensual, setTotalMensual] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  // Modal cobro
  const [cobroModal, setCobroModal] = useState(false)
  const [cobroMid, setCobroMid] = useState<string | null>(null)
  const [cobroForm, setCobroForm] = useState({ monto: '', fecha: '', notas: '' })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const [resM, resC] = await Promise.all([
        fetch('/api/mantenimiento', { headers: authH() }),
        fetch('/api/clientes?limit=100', { headers: authH() }),
      ])
      const dm = await resM.json()
      const dc = await resC.json()
      setItems(dm.mantenimientos || [])
      setTotalMensual(dm.totalMensual || 0)
      setClientes(dc.clientes || [])
    } catch { setError('Error al cargar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const detalle = items.find(i => i.id === detalleId) || null

  const hoy = new Date().toISOString().split('T')[0]

  async function handleSave() {
    if (!form.descripcion.trim()) { setError('La descripción es requerida'); return }
    if (!form.montoMensual) { setError('El monto mensual es requerido'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/mantenimiento', {
        method: 'POST', headers: authH(), body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setModalOpen(false)
      setForm(FORM_VACIO)
      fetchItems()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function handleToggleActivo(id: string, activo: boolean) {
    await fetch(`/api/mantenimiento/${id}`, {
      method: 'PUT', headers: authH(), body: JSON.stringify({ activo: !activo }),
    })
    fetchItems()
    if (detalleId === id) setDetalleId(null)
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/mantenimiento/${id}`, { method: 'DELETE', headers: authH() })
      setDeleteId(null)
      if (detalleId === id) setDetalleId(null)
      fetchItems()
    } catch { setError('Error al eliminar') }
  }

  async function registrarCobro() {
    if (!cobroMid) return
    setSaving(true)
    try {
      const m = items.find(i => i.id === cobroMid)
      const res = await fetch('/api/cobros', {
        method: 'POST', headers: authH(),
        body: JSON.stringify({
          mantenimientoId: cobroMid,
          monto: cobroForm.monto || m?.montoMensual,
          fecha: cobroForm.fecha || new Date().toISOString(),
          notas: cobroForm.notas || null,
        }),
      })
      if (res.ok) {
        setCobroModal(false)
        setCobroForm({ monto: '', fecha: '', notas: '' })
        fetchItems()
      }
    } finally { setSaving(false) }
  }

  // Mes actual para verificar si ya cobró
  const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  function yaCobradoEsteMes(cobros: CobroMantenimiento[]) {
    return cobros.some(c => {
      const f = new Date(c.fecha)
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
      return key === mesActual
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mantenimiento</h1>
          <p className="text-gray-400 text-sm mt-1">Contratos de soporte mensual</p>
        </div>
        <button
          onClick={() => { setForm({ ...FORM_VACIO, fechaInicio: hoy }); setModalOpen(true); setError('') }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo contrato
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Ingreso mensual recurrente</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalMensual)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Contratos activos</p>
          <p className="text-xl font-bold text-white">{items.filter(i => i.activo).length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Cobrado este mes</p>
          <p className="text-xl font-bold text-yellow-400">
            {formatCurrency(
              items.flatMap(m => m.cobros).filter(c => {
                const f = new Date(c.fecha)
                const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
                return key === mesActual
              }).reduce((s, c) => s + c.monto, 0)
            )}
          </p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Lista de contratos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="font-medium">No hay contratos de mantenimiento</p>
          <p className="text-sm mt-1">Añadí el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(m => {
            const cobradoTotal = m.cobros.reduce((s, c) => s + c.monto, 0)
            const cobradoMes   = yaCobradoEsteMes(m.cobros)
            const gananciaXCobro = m.montoMensual - m.costoDesarrollador

            return (
              <div
                key={m.id}
                onClick={() => setDetalleId(m.id)}
                className={`bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-colors ${
                  m.activo ? 'border-gray-800 hover:border-gray-600' : 'border-gray-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.cliente ? `${m.cliente.nombre}${m.cliente.empresa ? ` · ${m.cliente.empresa}` : ''}` : 'Sin cliente asignado'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cobradoMes && (
                      <CheckCircle className="w-4 h-4 text-green-400" aria-label="Cobrado este mes" />
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      m.activo
                        ? 'bg-green-900/40 text-green-400 border-green-700/40'
                        : 'bg-gray-800 text-gray-500 border-gray-700'
                    }`}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-gray-500 mb-0.5">Mensual</p>
                    <p className="text-white font-medium">{formatCurrency(m.montoMensual)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Dev ({m.desarrolladorNombre || 'N/A'})</p>
                    <p className="text-blue-400 font-medium">{formatCurrency(m.costoDesarrollador)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Ganancia</p>
                    <p className="text-green-400 font-medium">{formatCurrency(gananciaXCobro)}</p>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 border-t border-gray-800 pt-2">
                  <span>{m.cobros.length} cobro{m.cobros.length !== 1 ? 's' : ''} registrados</span>
                  <span>Total: {formatCurrency(cobradoTotal)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal nuevo contrato ──────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Nuevo contrato de mantenimiento</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción *</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej: Mantenimiento web Yanina"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Cliente</label>
                <select
                  value={form.clienteId}
                  onChange={e => setForm(p => ({ ...p, clienteId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Sin cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto mensual *</label>
                  <input
                    type="number"
                    value={form.montoMensual}
                    onChange={e => setForm(p => ({ ...p, montoMensual: e.target.value }))}
                    placeholder="25000"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Costo dev</label>
                  <input
                    type="number"
                    value={form.costoDesarrollador}
                    onChange={e => setForm(p => ({ ...p, costoDesarrollador: e.target.value }))}
                    placeholder="10000"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>

              {/* Preview split */}
              {form.montoMensual && (
                <div className="bg-gray-800/60 rounded-xl px-4 py-3 text-xs space-y-1">
                  <p className="text-gray-500 font-medium uppercase tracking-wide mb-2">Split mensual</p>
                  <div className="flex justify-between text-gray-400">
                    <span>Dev ({form.desarrolladorNombre || '—'})</span>
                    <span>{formatCurrency(parseFloat(form.costoDesarrollador) || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-gray-700 pt-1">
                    <span className="text-gray-300">Agencia</span>
                    <span className="text-green-400">
                      {formatCurrency((parseFloat(form.montoMensual) || 0) - (parseFloat(form.costoDesarrollador) || 0))}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Desarrollador</label>
                  <input
                    type="text"
                    value={form.desarrolladorNombre}
                    onChange={e => setForm(p => ({ ...p, desarrolladorNombre: e.target.value }))}
                    placeholder="Juan"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio || hoy}
                    onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
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

              {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Creando...' : 'Crear contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detalle contrato ─────────────────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white truncate mr-4">{detalle.descripcion}</h2>
              <button onClick={() => setDetalleId(null)} className="text-gray-400 hover:text-white flex-shrink-0">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Info */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Mensual</p>
                  <p className="font-bold text-white">{formatCurrency(detalle.montoMensual)}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Dev</p>
                  <p className="font-bold text-blue-400">{formatCurrency(detalle.costoDesarrollador)}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Agencia</p>
                  <p className="font-bold text-green-400">{formatCurrency(detalle.montoMensual - detalle.costoDesarrollador)}</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCobroMid(detalle.id)
                    setCobroForm({ monto: detalle.montoMensual.toString(), fecha: hoy, notas: '' })
                    setCobroModal(true)
                  }}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl py-2 text-xs font-semibold transition-colors"
                >
                  + Registrar cobro
                </button>
                <button
                  onClick={() => handleToggleActivo(detalle.id, detalle.activo)}
                  className={`px-4 rounded-xl text-xs font-medium border transition-colors ${
                    detalle.activo
                      ? 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'
                      : 'border-green-700/40 text-green-400 hover:bg-green-900/20'
                  }`}
                >
                  {detalle.activo ? 'Pausar' : 'Reactivar'}
                </button>
                <button
                  onClick={() => setDeleteId(detalle.id)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/50 rounded-xl border border-gray-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Historial cobros */}
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Cobros registrados ({detalle.cobros.length})
                  {detalle.cobros.length > 0 && (
                    <span className="ml-2 text-gray-400">
                      · Total: {formatCurrency(detalle.cobros.reduce((s, c) => s + c.monto, 0))}
                    </span>
                  )}
                </p>
                {detalle.cobros.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2">Sin cobros registrados aún</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detalle.cobros.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-2.5">
                        <div>
                          <span className="text-sm text-white">{new Date(c.fecha).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                          {c.notas && <span className="text-xs text-gray-500 ml-2">{c.notas}</span>}
                        </div>
                        <span className="text-sm font-semibold text-yellow-400">{formatCurrency(c.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal registrar cobro ─────────────────────────────────────────── */}
      {cobroModal && cobroMid && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Registrar cobro</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto</label>
                <input
                  type="number"
                  value={cobroForm.monto}
                  onChange={e => setCobroForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={cobroForm.fecha}
                  onChange={e => setCobroForm(p => ({ ...p, fecha: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input
                  type="text"
                  value={cobroForm.notas}
                  onChange={e => setCobroForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCobroModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={registrarCobro} disabled={saving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar contrato?</h3>
            <p className="text-gray-400 text-sm mb-6">Se eliminarán también todos los cobros registrados. Esta acción no se puede deshacer.</p>
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