// src/app/dashboard/ventas/page.tsx
// CAMBIOS vs versión anterior:
//   1. Interface CostoForm agrega personaId
//   2. Estado personas[] y carga desde /api/personas
//   3. Fila de costo reemplaza text "Quién" por select de personas
//   4. updCosto/updEditCosto sincronizan personaId + personaNombre

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface Persona    { id: string; nombre: string; rol: string }
interface Cliente    { id: string; nombre: string; empresa: string | null }
interface Pago       { id: string; monto: number; tipoPago: string; fecha: string; notas: string | null }
interface CostoVenta { id: string; descripcion: string; monto: number; personaNombre: string | null; personaId: string | null }
interface Venta {
  id: string; nombreProyecto: string; tipoServicio: string; precioTotal: number
  pagoInicial: number; cantidadCuotas: number; valorCuota: number; estado: string
  totalPagado: number; totalCostos: number
  cliente: Cliente; pagos: Pago[]; costos: CostoVenta[]
}
interface CostoForm {
  descripcion: string; monto: string; personaNombre: string; personaId: string
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ESTADOS: Record<string, { label: string; color: string }> = {
  activo:     { label: 'Activo',     color: 'bg-blue-900/40 text-blue-400 border-blue-700/40'    },
  completado: { label: 'Completado', color: 'bg-green-900/40 text-green-400 border-green-700/40' },
  cancelado:  { label: 'Cancelado',  color: 'bg-red-900/40 text-red-400 border-red-700/40'       },
}
const TIPOS = ['landing','web','ecommerce','campania','automation','paid_media','social_media','ads','seo','otro']

const PRESETS_COSTOS: Record<string, CostoForm[]> = {
  landing:      [{ descripcion: 'Desarrollo', monto: '78000', personaNombre: 'Juan', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  web:          [{ descripcion: 'Desarrollo', monto: '78000', personaNombre: 'Juan', personaId: '' }, { descripcion: 'PM', monto: '28000', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  ecommerce:    [{ descripcion: 'Desarrollo', monto: '78000', personaNombre: 'Juan', personaId: '' }, { descripcion: 'PM', monto: '28000', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  paid_media:   [{ descripcion: 'Gestión paid media', monto: '', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  social_media: [{ descripcion: 'Gestión social media', monto: '', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  ads:          [{ descripcion: 'Gestión de ads', monto: '', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  seo:          [{ descripcion: 'SEO / Contenido', monto: '', personaNombre: 'Juan', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  campania:     [{ descripcion: 'Producción', monto: '', personaNombre: 'Juan', personaId: '' }, { descripcion: 'Gestión de campaña', monto: '', personaNombre: 'Carlos', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  automation:   [{ descripcion: 'Desarrollo', monto: '78000', personaNombre: 'Juan', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
  otro:         [{ descripcion: 'Costo principal', monto: '', personaNombre: '', personaId: '' }, { descripcion: 'Comisión vendedor', monto: '', personaNombre: 'Carlos', personaId: '' }],
}

function getPreset(tipo: string, precioTotal: string, personas: Persona[]): CostoForm[] {
  const precio = parseFloat(precioTotal) || 0
  return (PRESETS_COSTOS[tipo] || PRESETS_COSTOS.otro).map(c => {
    const persona = personas.find(p => p.nombre === c.personaNombre)
    return {
      ...c,
      personaId: persona?.id || '',
      monto: c.descripcion.toLowerCase().includes('comisión') && !c.monto && precio > 0
        ? Math.round(precio * 0.2).toString()
        : c.monto,
    }
  })
}

function calcWaterfall(totalPagado: number, costos: { monto: number }[]) {
  let restante = totalPagado
  const cobrado = costos.map(c => {
    const cubierto = Math.min(restante, c.monto)
    restante -= cubierto
    return cubierto
  })
  return { cobrado, ganancia: restante }
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH()    { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const FORM_BASE = { clienteId: '', nombreProyecto: '', tipoServicio: 'web', precioTotal: '', pagoInicial: '', cantidadCuotas: '', valorCuota: '' }

// ─── COMPONENTE SELECTOR DE PERSONA ──────────────────────────────────────────
function PersonaSelect({
  value, personaNombre, personas,
  onChange,
}: {
  value: string
  personaNombre: string
  personas: Persona[]
  onChange: (personaId: string, personaNombre: string) => void
}) {
  return (
    <select
      value={value || ''}
      onChange={e => {
        const p = personas.find(x => x.id === e.target.value)
        onChange(e.target.value, p ? p.nombre : personaNombre)
      }}
      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
    >
      <option value="">Quién…</option>
      {personas.map(p => (
        <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>
      ))}
      {/* Si había un nombre libre que no matchea ninguna persona */}
      {personaNombre && !personas.find(p => p.nombre === personaNombre) && (
        <option value="" disabled>─ {personaNombre} (sin perfil)</option>
      )}
    </select>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function VentasPage() {
  const [ventas, setVentas]     = useState<Venta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [filterEstado, setFilterEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detalle, setDetalle]   = useState<Venta | null>(null)
  const [form, setForm]         = useState(FORM_BASE)
  const [costos, setCostos]     = useState<CostoForm[]>(PRESETS_COSTOS.web)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState({ monto: '', tipoPago: 'cuota', notas: '' })
  const [editCostosModal, setEditCostosModal] = useState(false)
  const [editCostos, setEditCostos] = useState<CostoForm[]>([])
  const [editCostosSaving, setEditCostosSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteMsg, setDeleteMsg] = useState('')

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterEstado) params.set('estado', filterEstado)
      const res  = await fetch(`/api/ventas?${params}`, { headers: authH() })
      const data = await res.json()
      setVentas(data.ventas || [])
      setTotal(data.total || 0)
    } catch { setError('Error al cargar ventas') }
    finally { setLoading(false) }
  }, [filterEstado])

  useEffect(() => { fetchVentas() }, [fetchVentas])
  useEffect(() => {
    fetch('/api/clientes?limit=100', { headers: authH() })
      .then(r => r.json()).then(d => setClientes(d.clientes || []))
    fetch('/api/personas', { headers: authH() })
      .then(r => r.json()).then(d => setPersonas(d.personas || []))
  }, [])

  function handleTipoChange(tipo: string) {
    setForm(p => ({ ...p, tipoServicio: tipo }))
    setCostos(getPreset(tipo, form.precioTotal, personas))
  }
  function handlePrecioChange(precio: string) {
    setForm(p => ({ ...p, precioTotal: precio }))
    const val = parseFloat(precio) || 0
    setCostos(prev => prev.map(c =>
      c.descripcion.toLowerCase().includes('comisión')
        ? { ...c, monto: val > 0 ? Math.round(val * 0.2).toString() : c.monto }
        : c
    ))
  }
  useEffect(() => {
    const precio  = parseFloat(form.precioTotal)  || 0
    const inicial = parseFloat(form.pagoInicial)  || 0
    const cuotas  = parseInt(form.cantidadCuotas) || 0
    if (precio > 0 && cuotas > 0)
      setForm(p => ({ ...p, valorCuota: Math.round((precio - inicial) / cuotas).toString() }))
  }, [form.precioTotal, form.pagoInicial, form.cantidadCuotas])

  function addCosto()                              { setCostos(p => [...p, { descripcion: '', monto: '', personaNombre: '', personaId: '' }]) }
  function removeCosto(i: number)                  { setCostos(p => p.filter((_, idx) => idx !== i)) }
  function updCosto(i: number, f: keyof CostoForm, v: string) {
    setCostos(p => p.map((c, idx) => idx === i ? { ...c, [f]: v } : c))
  }
  function updCostoPersona(i: number, personaId: string, personaNombre: string) {
    setCostos(p => p.map((c, idx) => idx === i ? { ...c, personaId, personaNombre } : c))
  }

  function addEditCosto()                              { setEditCostos(p => [...p, { descripcion: '', monto: '', personaNombre: '', personaId: '' }]) }
  function removeEditCosto(i: number)                  { setEditCostos(p => p.filter((_, idx) => idx !== i)) }
  function updEditCosto(i: number, f: keyof CostoForm, v: string) {
    setEditCostos(p => p.map((c, idx) => idx === i ? { ...c, [f]: v } : c))
  }
  function updEditCostoPersona(i: number, personaId: string, personaNombre: string) {
    setEditCostos(p => p.map((c, idx) => idx === i ? { ...c, personaId, personaNombre } : c))
  }

  async function handleSave() {
    if (!form.clienteId || !form.nombreProyecto || !form.precioTotal) {
      setError('Cliente, proyecto y precio total son requeridos'); return
    }
    setSaving(true); setError('')
    try {
      const payload = { ...form, costos: costos.map(c => ({ ...c, personaId: c.personaId || null })) }
      const res  = await fetch('/api/ventas', { method: 'POST', headers: authH(), body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setModalOpen(false); setForm(FORM_BASE); setCostos(PRESETS_COSTOS.web); fetchVentas()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/ventas/${id}`, { method: 'PUT', headers: authH(), body: JSON.stringify({ estado }) })
    fetchVentas()
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, estado } : null)
  }

  async function handleSaveEditCostos() {
    if (!detalle) return
    setEditCostosSaving(true)
    try {
      const payload = editCostos.map(c => ({ ...c, personaId: c.personaId || null }))
      const res  = await fetch(`/api/ventas/${detalle.id}`, {
        method: 'PUT', headers: authH(), body: JSON.stringify({ costos: payload }),
      })
      const data = await res.json()
      if (res.ok) { setEditCostosModal(false); setDetalle(data); fetchVentas() }
    } finally { setEditCostosSaving(false) }
  }

  function openEditCostos() {
    if (!detalle) return
    setEditCostos(detalle.costos.map(c => ({
      descripcion:   c.descripcion,
      monto:         c.monto.toString(),
      personaNombre: c.personaNombre || '',
      personaId:     c.personaId    || '',
    })))
    setEditCostosModal(true)
  }

  async function handleDelete(id: string) {
    try {
      const res  = await fetch(`/api/ventas/${id}`, { method: 'DELETE', headers: authH() })
      const data = await res.json()
      setDeleteId(null)
      if (data.archived) {
        setDeleteMsg('La venta fue archivada (tenía pagos). El historial se conserva.')
        setTimeout(() => setDeleteMsg(''), 5000)
      }
      setDetalle(null); fetchVentas()
    } catch { setError('Error al eliminar') }
  }

  async function agregarPago() {
    if (!pagoForm.monto || !detalle) return
    setSaving(true)
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ ventaId: detalle.id, ...pagoForm }),
      })
      if (res.ok) {
        setPagoModal(false); setPagoForm({ monto: '', tipoPago: 'cuota', notas: '' })
        const r2 = await fetch(`/api/ventas/${detalle.id}`, { headers: authH() })
        const d  = await r2.json()
        setDetalle(d); fetchVentas()
      }
    } finally { setSaving(false) }
  }

  const precioNum  = parseFloat(form.precioTotal) || 0
  const costosNum  = costos.map(c => ({ monto: parseFloat(c.monto) || 0 }))
  const totalCost  = costosNum.reduce((s, c) => s + c.monto, 0)
  const ganEstimada = Math.max(precioNum - totalCost, 0)

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ventas</h1>
          <p className="text-gray-400 text-sm mt-1">{total} venta{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setForm(FORM_BASE); setCostos(getPreset('web', '', personas)); setModalOpen(true); setError('') }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva venta
        </button>
      </div>

      {deleteMsg && (
        <div className="mb-4 bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-sm rounded-xl px-4 py-3">{deleteMsg}</div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ value: '', label: 'Todas' }, ...Object.entries(ESTADOS).map(([v, { label }]) => ({ value: v, label }))].map(opt => (
          <button key={opt.value} onClick={() => setFilterEstado(opt.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              filterEstado === opt.value
                ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >{opt.label}</button>
        ))}
      </div>

      {/* Grid ventas */}
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
            const { ganancia } = calcWaterfall(v.totalPagado, v.costos)
            const estadoInfo   = ESTADOS[v.estado] || ESTADOS.activo
            return (
              <div key={v.id} onClick={() => setDetalle(v)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-white truncate">{v.nombreProyecto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {v.cliente.nombre}{v.cliente.empresa ? ` · ${v.cliente.empresa}` : ''}
                    </p>
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
                  <span className="capitalize">{v.tipoServicio.replace('_', ' ')}</span>
                  <span className={ganancia > 0 ? 'text-green-400' : 'text-gray-500'}>Ganancia: {formatCurrency(ganancia)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal nueva venta ──────────────────────────────────────────────── */}
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
                <select value={form.clienteId} onChange={e => setForm(p => ({ ...p, clienteId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre del proyecto *</label>
                <input type="text" value={form.nombreProyecto}
                  onChange={e => setForm(p => ({ ...p, nombreProyecto: e.target.value }))}
                  placeholder="Ej: Campaña Meta Yanina"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de servicio</label>
                <select value={form.tipoServicio} onChange={e => handleTipoChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ').charAt(0).toUpperCase() + t.replace('_', ' ').slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Precio total *</label>
                  <input type="number" value={form.precioTotal} onChange={e => handlePrecioChange(e.target.value)}
                    placeholder="400000"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Pago inicial</label>
                  <input type="number" value={form.pagoInicial} onChange={e => setForm(p => ({ ...p, pagoInicial: e.target.value }))}
                    placeholder="150000"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Cuotas</label>
                  <input type="number" value={form.cantidadCuotas} onChange={e => setForm(p => ({ ...p, cantidadCuotas: e.target.value }))}
                    placeholder="4"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor cuota <span className="text-gray-600 text-xs">(auto)</span></label>
                  <input type="number" value={form.valorCuota} onChange={e => setForm(p => ({ ...p, valorCuota: e.target.value }))}
                    placeholder="se calcula"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>

              {/* ── COSTOS con selector de persona ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Costos <span className="normal-case font-normal text-gray-600">(waterfall)</span>
                  </p>
                  <button onClick={addCosto} className="text-xs text-yellow-400 hover:text-yellow-300">+ Agregar</button>
                </div>
                <div className="space-y-2">
                  {costos.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <span className="col-span-1 text-xs text-gray-600 text-center">{i + 1}.</span>
                      <input type="text" value={c.descripcion} onChange={e => updCosto(i, 'descripcion', e.target.value)}
                        placeholder="Descripción"
                        className="col-span-4 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                      <input type="number" value={c.monto} onChange={e => updCosto(i, 'monto', e.target.value)}
                        placeholder="Monto"
                        className="col-span-3 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                      <div className="col-span-3">
                        <PersonaSelect value={c.personaId} personaNombre={c.personaNombre} personas={personas}
                          onChange={(pid, pname) => updCostoPersona(i, pid, pname)} />
                      </div>
                      <button onClick={() => removeCosto(i)} className="col-span-1 text-gray-600 hover:text-red-400 flex justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {precioNum > 0 && (
                <div className="bg-gray-800/60 rounded-xl px-4 py-3 text-xs space-y-1.5">
                  <p className="text-gray-500 font-medium uppercase tracking-wide mb-1.5">Estimado al cobrar el total</p>
                  <div className="flex justify-between text-gray-400"><span>Total costos</span><span>{formatCurrency(totalCost)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-gray-700 pt-1.5">
                    <span className="text-gray-300">Ganancia agencia</span>
                    <span className={ganEstimada >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(ganEstimada)}</span>
                  </div>
                </div>
              )}
              {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Creando...' : 'Crear venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detalle venta ──────────────────────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <div className="min-w-0 mr-4">
                <h2 className="text-lg font-semibold text-white truncate">{detalle.nombreProyecto}</h2>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{detalle.tipoServicio.replace('_', ' ')}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-white flex-shrink-0">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total proyecto</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(detalle.precioTotal)}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Cobrado</p>
                  <p className="text-xl font-bold text-yellow-400">{formatCurrency(detalle.totalPagado)}</p>
                </div>
              </div>

              {/* Waterfall */}
              <div className="bg-gray-800/40 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Costos waterfall</p>
                  <button onClick={openEditCostos} className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                </div>
                {detalle.costos.length === 0 ? (
                  <p className="text-xs text-gray-600">Sin costos. Hacé clic en Editar para agregar.</p>
                ) : (() => {
                  const { cobrado, ganancia } = calcWaterfall(detalle.totalPagado, detalle.costos)
                  const ganFinal = detalle.precioTotal - detalle.costos.reduce((s, c) => s + c.monto, 0)
                  return (
                    <>
                      {detalle.costos.map((costo, i) => {
                        const cubierto = cobrado[i]
                        const completo = cubierto >= costo.monto
                        const parcial  = cubierto > 0 && !completo
                        return (
                          <div key={costo.id} className="flex justify-between items-center mb-1.5">
                            <span className="text-gray-400">
                              {i + 1}. {costo.descripcion}
                              {costo.personaNombre && <span className="text-gray-600 ml-1">({costo.personaNombre})</span>}
                            </span>
                            <span className={completo ? 'text-green-400' : parcial ? 'text-yellow-400' : 'text-gray-600'}>
                              {formatCurrency(cubierto)}
                              {!completo && <span className="text-gray-700 ml-1">/ {formatCurrency(costo.monto)}</span>}
                            </span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between border-t border-gray-700 pt-2 font-medium">
                        <span className="text-gray-300">Ganancia agencia</span>
                        <span className={ganancia > 0 ? 'text-green-400' : 'text-gray-500'}>{formatCurrency(ganancia)}</span>
                      </div>
                      {detalle.totalPagado < detalle.precioTotal && (
                        <div className="flex justify-between text-xs pt-1 border-t border-gray-800 text-gray-500">
                          <span>Ganancia final estimada</span>
                          <span>{formatCurrency(ganFinal)}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Estado */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Cambiar estado</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ESTADOS).map(([v, { label, color }]) => (
                    <button key={v} onClick={() => cambiarEstado(detalle.id, v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${detalle.estado === v ? color : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pagos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Pagos ({detalle.pagos?.length || 0})</p>
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

              <div className="border-t border-gray-800 pt-4">
                <button onClick={() => setDeleteId(detalle.id)}
                  className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar costos ─────────────────────────────────────────────── */}
      {editCostosModal && detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-white">Editar costos</h3>
                <p className="text-xs text-gray-500 mt-0.5">{detalle.nombreProyecto}</p>
              </div>
              <button onClick={() => setEditCostosModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-500">Los costos se pagan en orden. La ganancia es lo que queda.</p>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1.5 text-xs text-gray-600 px-1">
                  <span className="col-span-1">#</span>
                  <span className="col-span-4">Descripción</span>
                  <span className="col-span-3">Monto</span>
                  <span className="col-span-3">Persona</span>
                  <span className="col-span-1"></span>
                </div>
                {editCostos.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                    <span className="col-span-1 text-xs text-gray-600 text-center">{i + 1}.</span>
                    <input type="text" value={c.descripcion} onChange={e => updEditCosto(i, 'descripcion', e.target.value)}
                      placeholder="Descripción"
                      className="col-span-4 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                    <input type="number" value={c.monto} onChange={e => updEditCosto(i, 'monto', e.target.value)}
                      placeholder="0"
                      className="col-span-3 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                    <div className="col-span-3">
                      <PersonaSelect value={c.personaId} personaNombre={c.personaNombre} personas={personas}
                        onChange={(pid, pname) => updEditCostoPersona(i, pid, pname)} />
                    </div>
                    <button onClick={() => removeEditCosto(i)} className="col-span-1 text-gray-600 hover:text-red-400 flex justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addEditCosto} className="text-xs text-yellow-400 hover:text-yellow-300">+ Agregar costo</button>

              {editCostos.length > 0 && (() => {
                const costosN  = editCostos.map(c => ({ monto: parseFloat(c.monto) || 0 }))
                const totalC   = costosN.reduce((s, c) => s + c.monto, 0)
                const { ganancia } = calcWaterfall(detalle.totalPagado, costosN)
                const ganFinal = detalle.precioTotal - totalC
                return (
                  <div className="bg-gray-800/60 rounded-xl px-4 py-3 text-xs space-y-1.5">
                    <p className="text-gray-500 font-medium uppercase tracking-wide mb-1.5">Preview (cobrado actual: {formatCurrency(detalle.totalPagado)})</p>
                    <div className="flex justify-between text-gray-400"><span>Total costos</span><span>{formatCurrency(totalC)}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Ganancia actual</span><span className={ganancia > 0 ? 'text-green-400' : 'text-gray-500'}>{formatCurrency(ganancia)}</span></div>
                    <div className="flex justify-between font-medium border-t border-gray-700 pt-1.5">
                      <span className="text-gray-400">Ganancia final estimada</span>
                      <span className={ganFinal >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(ganFinal)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditCostosModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSaveEditCostos} disabled={editCostosSaving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {editCostosSaving ? 'Guardando...' : 'Guardar costos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal agregar pago ──────────────────────────────────────────────── */}
      {pagoModal && detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Registrar pago</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Monto</label>
                <input type="number" value={pagoForm.monto}
                  onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))}
                  placeholder={detalle.valorCuota ? detalle.valorCuota.toString() : '50000'}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo</label>
                <select value={pagoForm.tipoPago} onChange={e => setPagoForm(p => ({ ...p, tipoPago: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="cuota">Cuota</option>
                  <option value="inicial">Inicial</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input type="text" value={pagoForm.notas}
                  onChange={e => setPagoForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPagoModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={agregarPago} disabled={saving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminar venta ────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar venta?</h3>
            <p className="text-gray-400 text-sm mb-6">Con pagos → se archiva. Sin pagos → se elimina definitivamente.</p>
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