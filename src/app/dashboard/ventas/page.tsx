'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Cliente { id: string; nombre: string; empresa: string | null }
interface Pago { id: string; monto: number; tipoPago: string; fecha: string; notas: string | null }
interface Venta {
  id: string
  nombreProyecto: string
  tipoServicio: string
  precioTotal: number
  pagoInicial: number
  cantidadCuotas: number
  valorCuota: number
  costoDesarrollador: number
  costoPM: number
  comisionVendedor: number
  estado: string
  totalPagado: number
  cliente: Cliente
  pagos: Pago[]
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  activo:      { label: 'Activo',      color: 'bg-blue-900/40 text-blue-400 border-blue-700/40' },
  completado:  { label: 'Completado',  color: 'bg-green-900/40 text-green-400 border-green-700/40' },
  cancelado:   { label: 'Cancelado',   color: 'bg-red-900/40 text-red-400 border-red-700/40' },
}

const TIPOS = ['landing', 'web', 'ecommerce', 'campania', 'automation', 'otro']

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const FORM_VACIO = {
  clienteId: '', nombreProyecto: '', tipoServicio: 'web',
  precioTotal: '', pagoInicial: '', cantidadCuotas: '', valorCuota: '',
  costoDesarrollador: '', costoPM: '', comisionVendedor: '',
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterEstado, setFilterEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detalle, setDetalle] = useState<Venta | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Modal agregar pago
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState({ monto: '', tipoPago: 'cuota', notas: '' })

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterEstado) params.set('estado', filterEstado)
      const res = await fetch(`/api/ventas?${params}`, { headers: authHeaders() })
      const data = await res.json()
      setVentas(data.ventas || [])
      setTotal(data.total || 0)
    } catch { setError('Error al cargar ventas') }
    finally { setLoading(false) }
  }, [filterEstado])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  useEffect(() => {
    fetch('/api/clientes?limit=100', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setClientes(d.clientes || []))
  }, [])

  async function handleSave() {
    if (!form.clienteId || !form.nombreProyecto || !form.precioTotal) {
      setError('Cliente, proyecto y precio total son requeridos')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      setModalOpen(false)
      setForm(FORM_VACIO)
      fetchVentas()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/ventas/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ estado }),
    })
    fetchVentas()
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, estado } : null)
  }

  async function agregarPago() {
    if (!pagoForm.monto || !detalle) return
    setSaving(true)
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ventaId: detalle.id, ...pagoForm }),
      })
      if (res.ok) {
        setPagoModal(false)
        setPagoForm({ monto: '', tipoPago: 'cuota', notas: '' })
        // Recargar detalle
        const r2 = await fetch(`/api/ventas/${detalle.id}`, { headers: authHeaders() })
        const d = await r2.json()
        setDetalle({ ...d, totalPagado: d.pagos.reduce((s: number, p: Pago) => s + p.monto, 0) })
        fetchVentas()
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ventas</h1>
          <p className="text-gray-400 text-sm mt-1">{total} venta{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setError('') }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva venta
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ value: '', label: 'Todas' }, ...Object.entries(ESTADOS).map(([v, { label }]) => ({ value: v, label }))].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterEstado(opt.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              filterEstado === opt.value
                ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ventas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium">No hay ventas</p>
          <p className="text-sm mt-1">Registrá la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ventas.map(v => {
            const pct = v.precioTotal > 0 ? Math.min((v.totalPagado / v.precioTotal) * 100, 100) : 0
            const ganancia = v.totalPagado - (v.costoDesarrollador + v.costoPM + v.comisionVendedor) * (v.totalPagado / v.precioTotal)
            const estadoInfo = ESTADOS[v.estado] || ESTADOS.activo
            return (
              <div
                key={v.id}
                onClick={() => setDetalle(v)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-white truncate">{v.nombreProyecto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{v.cliente.nombre}{v.cliente.empresa ? ` · ${v.cliente.empresa}` : ''}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border flex-shrink-0 ${estadoInfo.color}`}>
                    {estadoInfo.label}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">Cobrado</span>
                    <span className="text-white font-medium">{formatCurrency(v.totalPagado)} / {formatCurrency(v.precioTotal)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span className="capitalize">{v.tipoServicio}</span>
                  <span className="text-green-400">Ganancia: {formatCurrency(ganancia)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva venta */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Nueva venta</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Cliente *</label>
                <select
                  value={form.clienteId}
                  onChange={e => setForm(p => ({ ...p, clienteId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre del proyecto *</label>
                <input type="text" value={form.nombreProyecto} onChange={e => setForm(p => ({ ...p, nombreProyecto: e.target.value }))} placeholder="Ej: Sitio web corporativo" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de servicio</label>
                <select value={form.tipoServicio} onChange={e => setForm(p => ({ ...p, tipoServicio: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Precio total *</label>
                  <input type="number" value={form.precioTotal} onChange={e => setForm(p => ({ ...p, precioTotal: e.target.value }))} placeholder="500000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Pago inicial</label>
                  <input type="number" value={form.pagoInicial} onChange={e => setForm(p => ({ ...p, pagoInicial: e.target.value }))} placeholder="150000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Cuotas</label>
                  <input type="number" value={form.cantidadCuotas} onChange={e => setForm(p => ({ ...p, cantidadCuotas: e.target.value }))} placeholder="3" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor cuota</label>
                  <input type="number" value={form.valorCuota} onChange={e => setForm(p => ({ ...p, valorCuota: e.target.value }))} placeholder="116666" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Costos internos</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Desarrollador', key: 'costoDesarrollador' },
                  { label: 'PM', key: 'costoPM' },
                  { label: 'Comisión', key: 'comisionVendedor' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-400 mb-1">{f.label}</label>
                    <input type="number" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder="0" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Creando...' : 'Crear venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle venta */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white truncate mr-4">{detalle.nombreProyecto}</h2>
              <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-white flex-shrink-0">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total del proyecto</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(detalle.precioTotal)}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Cobrado</p>
                  <p className="text-xl font-bold text-yellow-400">{formatCurrency(detalle.totalPagado)}</p>
                </div>
              </div>

              <div className="bg-gray-800/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Costo desarrollador</span><span className="text-white">{formatCurrency(detalle.costoDesarrollador)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Costo PM</span><span className="text-white">{formatCurrency(detalle.costoPM)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Comisión vendedor</span><span className="text-white">{formatCurrency(detalle.comisionVendedor)}</span></div>
                <div className="flex justify-between border-t border-gray-700 pt-2 font-medium">
                  <span className="text-gray-300">Ganancia agencia</span>
                  <span className="text-green-400">{formatCurrency(detalle.precioTotal - detalle.costoDesarrollador - detalle.costoPM - detalle.comisionVendedor)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Cambiar estado</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ESTADOS).map(([v, { label, color }]) => (
                    <button key={v} onClick={() => cambiarEstado(detalle.id, v)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${detalle.estado === v ? color : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Pagos registrados ({detalle.pagos?.length || 0})</p>
                  <button onClick={() => setPagoModal(true)} className="text-xs text-yellow-400 hover:text-yellow-300">+ Agregar pago</button>
                </div>
                <div className="space-y-2">
                  {(detalle.pagos || []).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-sm text-white capitalize">{p.tipoPago}</span>
                        <span className="text-xs text-gray-500 ml-2">{new Date(p.fecha).toLocaleDateString('es-AR')}</span>
                      </div>
                      <span className="text-sm font-semibold text-yellow-400">{formatCurrency(p.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar pago */}
      {pagoModal && detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Registrar pago</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto</label>
                <input type="number" value={pagoForm.monto} onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))} placeholder="116666" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo</label>
                <select value={pagoForm.tipoPago} onChange={e => setPagoForm(p => ({ ...p, tipoPago: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="cuota">Cuota</option>
                  <option value="inicial">Inicial</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input type="text" value={pagoForm.notas} onChange={e => setPagoForm(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPagoModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={agregarPago} disabled={saving} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}