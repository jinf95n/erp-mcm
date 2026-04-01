'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Copy, FileText,
  CheckCircle2, Send, XCircle, ArrowRight, TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Persona  { id: string; nombre: string; rol: string; tipoCompensacion: string; monto: number }
interface ClienteMin { id: string; nombre: string; empresa: string | null }
interface Rol      { personaNombre: string; tarifaHora: number; horas: number }

interface ItemLocal {
  id?:           string
  descripcion:   string
  tipoServicio:  string
  roles:         Rol[]
  modoMargen:    'markup' | 'margin'
  margen:        number   // 0–1
  descuento:     number   // 0–1
  tipoInversion: 'unica_vez' | 'mensual'
  orden:         number
}

interface ItemDB {
  id: string; descripcion: string; tipoServicio: string; roles: string
  modoMargen: string; margen: number; descuento: number; tipoInversion: string; orden: number
}

interface Cotizacion {
  id: string; numero: string; nombre: string
  clienteId: string | null; cliente: ClienteMin | null
  estado: string; moneda: string; tipoCambio: number
  validezDias: number; condicionesPago: string | null
  notasInternas: string | null; notasCliente: string | null
  descuentoGlobal: number; createdAt: string; updatedAt: string
  items: ItemDB[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: 'bg-gray-800 text-gray-400 border-gray-700'          },
  enviada:   { label: 'Enviada',   color: 'bg-blue-900/40 text-blue-400 border-blue-700/40'   },
  aceptada:  { label: 'Aceptada',  color: 'bg-green-900/40 text-green-400 border-green-700/40'},
  rechazada: { label: 'Rechazada', color: 'bg-red-900/40 text-red-400 border-red-700/40'      },
}

const TIPOS_SERVICIO = ['landing', 'web', 'crm', 'ads', 'automation', 'social_media', 'seo', 'otro']

const ITEM_VACIO: ItemLocal = {
  descripcion: '', tipoServicio: 'otro', roles: [],
  modoMargen: 'markup', margen: 0.35, descuento: 0,
  tipoInversion: 'unica_vez', orden: 0,
}

const FORM_VACIO = {
  nombre: '', clienteId: '', moneda: 'usd', tipoCambio: 1300,
  validezDias: 15, condicionesPago: '50% al inicio, 50% al finalizar',
  notasInternas: '', notasCliente: '', descuentoGlobal: 0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcItem(item: ItemLocal) {
  const costo = item.roles.reduce((s, r) => s + r.tarifaHora * r.horas, 0)
  const precio = item.modoMargen === 'markup'
    ? costo * (1 + item.margen)
    : item.margen < 1 ? costo / (1 - item.margen) : costo
  const precioConDesc = precio * (1 - item.descuento)
  const ganancia      = precioConDesc - costo
  return { costo, precio, precioConDesc, ganancia }
}

function calcTotales(items: ItemLocal[], descuentoGlobal: number) {
  let unicaVez = 0, mensual = 0, costoTotal = 0, gananciaTotal = 0
  items.forEach(item => {
    const { precioConDesc, costo, ganancia } = calcItem(item)
    if (item.tipoInversion === 'mensual') mensual += precioConDesc
    else unicaVez += precioConDesc
    costoTotal    += costo
    gananciaTotal += ganancia
  })
  const subtotal       = unicaVez + mensual
  const descuentoMonto = subtotal * descuentoGlobal
  const total          = subtotal - descuentoMonto
  return { unicaVez, mensual, subtotal, descuentoMonto, total, costoTotal, gananciaTotal }
}

function itemFromDB(item: ItemDB): ItemLocal {
  return {
    ...item,
    roles:         JSON.parse(item.roles || '[]'),
    modoMargen:    item.modoMargen    as 'markup' | 'margin',
    tipoInversion: item.tipoInversion as 'unica_vez' | 'mensual',
  }
}

function formatUSD(n: number) {
  return `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH()    { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CotizacionesPage() {
  const [cotizaciones,  setCotizaciones]  = useState<Cotizacion[]>([])
  const [personas,      setPersonas]      = useState<Persona[]>([])
  const [clientes,      setClientes]      = useState<ClienteMin[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filtro,        setFiltro]        = useState('')
  const [error,         setError]         = useState('')

  // Editor
  const [editorOpen,  setEditorOpen]  = useState(false)
  const [editandoId,  setEditandoId]  = useState<string | null>(null)
  const [form,        setForm]        = useState({ ...FORM_VACIO })
  const [items,       setItems]       = useState<ItemLocal[]>([])
  const [saving,      setSaving]      = useState(false)

  // Item editor
  const [itemModal, setItemModal] = useState(false)
  const [itemIdx,   setItemIdx]   = useState<number | null>(null)
  const [itemForm,  setItemForm]  = useState<ItemLocal>({ ...ITEM_VACIO })

  // Print
  const [printCot, setPrintCot] = useState<Cotizacion | null>(null)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rc, rp, rcl, rd] = await Promise.all([
        fetch(`/api/cotizaciones${filtro ? `?estado=${filtro}` : ''}`, { headers: authH() }),
        fetch('/api/personas',          { headers: authH() }),
        fetch('/api/clientes?limit=200',{ headers: authH() }),
        fetch('/api/dolar'),
      ])
      const [dc, dp, dcl, dd] = await Promise.all([rc.json(), rp.json(), rcl.json(), rd.json()])
      setCotizaciones(dc.cotizaciones || [])
      setPersonas(dp.personas         || [])
      setClientes(dcl.clientes        || [])
      if (dd.promedio) setForm(p => ({ ...p, tipoCambio: dd.promedio }))
    } catch { setError('Error al cargar') }
    finally  { setLoading(false) }
  }, [filtro])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Open editor (nuevo) ────────────────────────────────────────────────────
  async function openCreate() {
    const dd = await fetch('/api/dolar').then(r => r.json()).catch(() => null)
    const tc = dd?.promedio || form.tipoCambio
    setEditandoId(null)
    setForm({ ...FORM_VACIO, tipoCambio: tc })
    setItems([])
    setEditorOpen(true)
    setError('')
  }

  // ── Open editor (existente) ────────────────────────────────────────────────
  function openEdit(cot: Cotizacion) {
    setEditandoId(cot.id)
    setForm({
      nombre:          cot.nombre,
      clienteId:       cot.clienteId       || '',
      moneda:          cot.moneda,
      tipoCambio:      cot.tipoCambio,
      validezDias:     cot.validezDias,
      condicionesPago: cot.condicionesPago  || '',
      notasInternas:   cot.notasInternas    || '',
      notasCliente:    cot.notasCliente     || '',
      descuentoGlobal: cot.descuentoGlobal,
    })
    setItems(cot.items.map(itemFromDB))
    setEditorOpen(true)
    setError('')
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(estadoOverride?: string) {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        ...(estadoOverride && { estado: estadoOverride }),
        items: items.map((item, i) => ({
          ...item,
          id:    item.id,
          roles: JSON.stringify(item.roles),
          orden: i,
        })),
      }
      const url    = editandoId ? `/api/cotizaciones/${editandoId}` : '/api/cotizaciones'
      const method = editandoId ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: authH(), body: JSON.stringify(payload) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setEditorOpen(false); fetchAll()
    } catch { setError('Error de conexión') }
    finally   { setSaving(false) }
  }

  // ── Cambiar estado (desde card) ────────────────────────────────────────────
  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/cotizaciones/${id}`, {
      method: 'PUT', headers: authH(), body: JSON.stringify({ estado }),
    })
    fetchAll()
  }

  // ── Duplicar ───────────────────────────────────────────────────────────────
  async function handleDuplicate(id: string) {
    try {
      await fetch(`/api/cotizaciones/${id}/duplicar`, { method: 'POST', headers: authH() })
      fetchAll()
    } catch { setError('Error al duplicar') }
  }

  // ── Convertir a Venta ──────────────────────────────────────────────────────
  async function handleConvertir(id: string) {
    const res  = await fetch(`/api/cotizaciones/${id}/convertir`, { method: 'POST', headers: authH() })
    const data = await res.json()
    if (res.ok) {
      alert(`✅ Venta creada: ${data.venta?.nombreProyecto}`)
      fetchAll()
    } else {
      setError(data.error || 'Error al convertir')
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/cotizaciones/${id}`, { method: 'DELETE', headers: authH() })
    setDeleteId(null); fetchAll()
  }

  // ── Item editor helpers ────────────────────────────────────────────────────
  function openItemEditor(idx: number | null) {
    setItemIdx(idx)
    setItemForm(idx === null ? { ...ITEM_VACIO, orden: items.length } : { ...items[idx] })
    setItemModal(true)
  }

  function saveItem() {
    if (!itemForm.descripcion.trim()) return
    if (itemIdx === null) setItems(p => [...p, { ...itemForm }])
    else setItems(p => p.map((it, i) => i === itemIdx ? { ...itemForm } : it))
    setItemModal(false)
  }

  function removeItem(idx: number) { setItems(p => p.filter((_, i) => i !== idx)) }

  function addRol() {
    const primera = personas[0]
    const tarifa  = primera?.tipoCompensacion === 'usd' ? primera.monto : 15
    setItemForm(p => ({
      ...p,
      roles: [...p.roles, { personaNombre: primera?.nombre || '', tarifaHora: tarifa, horas: 1 }],
    }))
  }

  function updRol(ri: number, field: keyof Rol, val: string | number) {
    setItemForm(prev => ({
      ...prev,
      roles: prev.roles.map((r, i) => i === ri ? { ...r, [field]: val } : r),
    }))
  }

  function pickPersona(ri: number, nombre: string) {
    const persona = personas.find(p => p.nombre === nombre)
    const tarifa  = persona?.tipoCompensacion === 'usd' ? persona.monto : itemForm.roles[ri].tarifaHora
    setItemForm(prev => ({
      ...prev,
      roles: prev.roles.map((r, i) => i === ri ? { ...r, personaNombre: nombre, tarifaHora: tarifa } : r),
    }))
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const totales = calcTotales(items, form.descuentoGlobal)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cotizaciones</h1>
          <p className="text-gray-400 text-sm mt-1">{cotizaciones.length} cotización{cotizaciones.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nueva cotización
        </button>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* ── Filtros ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ v: '', l: 'Todas' }, ...Object.entries(ESTADOS).map(([v, { label: l }]) => ({ v, l }))].map(opt => (
          <button key={opt.v} onClick={() => setFiltro(opt.v)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              filtro === opt.v ? 'bg-yellow-400 border-yellow-400 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {opt.l}
          </button>
        ))}
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cotizaciones.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="font-medium">No hay cotizaciones</p>
          <p className="text-sm mt-1">Creá la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cotizaciones.map(cot => {
            const cotItems  = cot.items.map(itemFromDB)
            const tots      = calcTotales(cotItems, cot.descuentoGlobal)
            const estadoInfo = ESTADOS[cot.estado] || ESTADOS.borrador
            return (
              <div key={cot.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-xs text-gray-500 mb-0.5">{cot.numero}</p>
                    <p className="text-sm font-semibold text-white truncate">{cot.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cot.cliente ? `${cot.cliente.nombre}${cot.cliente.empresa ? ` · ${cot.cliente.empresa}` : ''}` : 'Sin cliente'}
                    </p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border flex-shrink-0 ${estadoInfo.color}`}>
                    {estadoInfo.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-800/60 rounded-xl p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Total</p>
                    <p className="text-sm font-bold text-yellow-400">{formatUSD(tots.total)}</p>
                    <p className="text-xs text-gray-600">≈ {formatCurrency(tots.total * cot.tipoCambio)}</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Ganancia</p>
                    <p className="text-sm font-bold text-green-400">{formatUSD(tots.gananciaTotal)}</p>
                    <p className="text-xs text-gray-600">
                      {tots.total > 0 ? `${((tots.gananciaTotal / tots.total) * 100).toFixed(0)}% del total` : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-2 mb-3">
                  <span>{cot.items.length} ítem{cot.items.length !== 1 ? 's' : ''}</span>
                  {tots.mensual > 0 && <span className="text-purple-400">+{formatUSD(tots.mensual)}/mes</span>}
                  <span>{new Date(cot.createdAt).toLocaleDateString('es-AR')}</span>
                </div>

                {/* Estado rápido */}
                <div className="flex gap-1 mb-3">
                  {Object.entries(ESTADOS).filter(([v]) => v !== cot.estado).map(([v, { label, color }]) => (
                    <button key={v} onClick={() => cambiarEstado(cot.id, v)}
                      className={`px-2 py-0.5 rounded-lg text-xs border transition-colors opacity-60 hover:opacity-100 ${color}`}>
                      → {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(cot)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2 text-xs font-medium transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => setPrintCot(cot)} title="Propuesta PDF"
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDuplicate(cot.id)} title="Duplicar"
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {cot.estado === 'aceptada' && (
                    <button onClick={() => handleConvertir(cot.id)} title="Convertir a Venta"
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-green-950/40 rounded-xl transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setDeleteId(cot.id)} title="Eliminar"
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Editor Modal ─────────────────────────────────────────────────────── */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl my-4">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-white">{editandoId ? 'Editar cotización' : 'Nueva cotización'}</h2>
                {items.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatUSD(totales.total)} · {formatUSD(totales.gananciaTotal)} ganancia ({totales.total > 0 ? `${((totales.gananciaTotal / totales.total) * 100).toFixed(0)}%` : '—'})
                  </p>
                )}
              </div>
              <button onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-6">

              {/* General */}
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-4">General</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre interno *</label>
                    <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: Propuesta completa — Empresa XYZ"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Cliente</label>
                    <select value={form.clienteId} onChange={e => setForm(p => ({ ...p, clienteId: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                      <option value="">Sin cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Moneda</label>
                    <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                      <option value="usd">USD</option>
                      <option value="ars">ARS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de cambio (ARS/USD)</label>
                    <input type="number" value={form.tipoCambio}
                      onChange={e => setForm(p => ({ ...p, tipoCambio: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Validez (días)</label>
                    <input type="number" value={form.validezDias}
                      onChange={e => setForm(p => ({ ...p, validezDias: parseInt(e.target.value) || 15 }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Descuento global (%)</label>
                    <input type="number" min="0" max="100"
                      value={Math.round(form.descuentoGlobal * 100)}
                      onChange={e => setForm(p => ({ ...p, descuentoGlobal: (parseFloat(e.target.value) || 0) / 100 }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Condiciones de pago</label>
                    <input type="text" value={form.condicionesPago}
                      onChange={e => setForm(p => ({ ...p, condicionesPago: e.target.value }))}
                      placeholder="Ej: 50% al inicio, 50% al finalizar"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Notas para el cliente <span className="text-gray-600 font-normal">(aparece en la propuesta)</span>
                    </label>
                    <textarea value={form.notasCliente}
                      onChange={e => setForm(p => ({ ...p, notasCliente: e.target.value }))}
                      rows={2} placeholder="Incluye X revisiones, soporte Y días..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Notas internas <span className="text-gray-600 font-normal">(solo el equipo)</span>
                    </label>
                    <textarea value={form.notasInternas}
                      onChange={e => setForm(p => ({ ...p, notasInternas: e.target.value }))}
                      rows={2} placeholder="Contexto, prioridades, alertas..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Ítems / Servicios</p>
                  <button onClick={() => openItemEditor(null)}
                    className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300">
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="border border-dashed border-gray-700 rounded-2xl py-10 text-center">
                    <p className="text-gray-600 text-sm">Sin ítems todavía</p>
                    <button onClick={() => openItemEditor(null)} className="text-yellow-400 text-sm mt-1 hover:text-yellow-300">
                      + Agregar el primero
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-800/40 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <span className="col-span-4">Descripción</span>
                      <span className="col-span-2">Roles</span>
                      <span className="col-span-2 text-right">Costo</span>
                      <span className="col-span-2 text-right">Precio</span>
                      <span className="col-span-1 text-right">Mgn</span>
                      <span className="col-span-1" />
                    </div>
                    {items.map((item, i) => {
                      const { costo, precioConDesc, ganancia } = calcItem(item)
                      const mgn = precioConDesc > 0 ? `${((ganancia / precioConDesc) * 100).toFixed(0)}%` : '—'
                      return (
                        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors items-center">
                          <div className="col-span-4">
                            <p className="text-sm font-medium text-white">{item.descripcion}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-500 capitalize">{item.tipoServicio.replace('_', ' ')}</span>
                              <span className={`text-xs ${item.tipoInversion === 'mensual' ? 'text-purple-400' : 'text-gray-600'}`}>
                                {item.tipoInversion === 'mensual' ? '/mes' : 'único'}
                              </span>
                              {item.descuento > 0 && <span className="text-xs text-orange-400">-{(item.descuento * 100).toFixed(0)}%</span>}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 leading-relaxed">
                              {item.roles.length === 0 ? '—' : item.roles.map(r => `${r.personaNombre} ${r.horas}h`).join(' · ')}
                            </p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-xs text-blue-400">{formatUSD(costo)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-semibold text-yellow-400">{formatUSD(precioConDesc)}</p>
                          </div>
                          <div className="col-span-1 text-right">
                            <p className="text-xs text-green-400">{mgn}</p>
                          </div>
                          <div className="col-span-1 flex gap-1 justify-end">
                            <button onClick={() => openItemEditor(i)} className="p-1 text-gray-500 hover:text-white rounded transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeItem(i)} className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Totales */}
              {items.length > 0 && (
                <div className="bg-gray-800/60 rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Para el cliente */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Propuesta para el cliente</p>
                      {totales.unicaVez > 0 && (
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-400">Única vez</span>
                          <span className="text-white">{formatUSD(totales.unicaVez)}</span>
                        </div>
                      )}
                      {totales.mensual > 0 && (
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-400">Mensual</span>
                          <span className="text-purple-400">{formatUSD(totales.mensual)}/mes</span>
                        </div>
                      )}
                      {form.descuentoGlobal > 0 && (
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-400">Descuento {(form.descuentoGlobal * 100).toFixed(0)}%</span>
                          <span className="text-red-400">-{formatUSD(totales.descuentoMonto)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-gray-700 pt-2">
                        <span className="text-white">Total</span>
                        <div className="text-right">
                          <p className="text-yellow-400">{formatUSD(totales.total)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(totales.total * form.tipoCambio)}</p>
                        </div>
                      </div>
                    </div>
                    {/* Interno */}
                    <div className="border-l border-gray-700 pl-6">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Interno</p>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-400">Costo total</span>
                        <span className="text-blue-400">{formatUSD(totales.costoTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-400">Ganancia bruta</span>
                        <span className="text-green-400">{formatUSD(totales.gananciaTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                        <span className="text-gray-400">Margen efectivo</span>
                        <span className="font-bold text-green-400">
                          {totales.total > 0 ? `${((totales.gananciaTotal / totales.total) * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-1.5">
                        <span className="text-gray-600">Ganancia en ARS</span>
                        <span className="text-gray-500">{formatCurrency(totales.gananciaTotal * form.tipoCambio)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 pb-6 flex-wrap border-t border-gray-800 pt-5">
              <button onClick={() => setEditorOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleSave('borrador')} disabled={saving}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button onClick={() => handleSave('enviada')} disabled={saving}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors">
                <Send className="w-3.5 h-3.5" /> Guardar y marcar enviada
              </button>
              {editandoId && (
                <>
                  <div className="flex-1" />
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ESTADOS).map(([v, { label, color }]) => (
                      <button key={v}
                        onClick={async () => { await cambiarEstado(editandoId, v); setEditorOpen(false) }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${color}`}>
                        → {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Item Editor Modal ─────────────────────────────────────────────────── */}
      {itemModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">{itemIdx === null ? 'Nuevo ítem' : 'Editar ítem'}</h3>
              <button onClick={() => setItemModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción *</label>
                  <input type="text" value={itemForm.descripcion}
                    onChange={e => setItemForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Set Up CRM con automatizaciones"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de servicio</label>
                  <select value={itemForm.tipoServicio} onChange={e => setItemForm(p => ({ ...p, tipoServicio: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    {TIPOS_SERVICIO.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ').charAt(0).toUpperCase() + t.replace('_', ' ').slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de inversión</label>
                  <select value={itemForm.tipoInversion}
                    onChange={e => setItemForm(p => ({ ...p, tipoInversion: e.target.value as 'unica_vez' | 'mensual' }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    <option value="unica_vez">Única vez</option>
                    <option value="mensual">Mensual recurrente</option>
                  </select>
                </div>
              </div>

              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Roles y horas</label>
                  <button onClick={addRol} className="text-xs text-yellow-400 hover:text-yellow-300">+ Agregar rol</button>
                </div>
                {itemForm.roles.length === 0 ? (
                  <div className="border border-dashed border-gray-700 rounded-xl py-6 text-center">
                    <p className="text-gray-600 text-sm">Sin roles — el costo será USD 0</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1 mb-1">
                      <span className="col-span-4">Persona</span>
                      <span className="col-span-3">Tarifa/hr USD</span>
                      <span className="col-span-3">Horas</span>
                      <span className="col-span-1 text-right">Sub</span>
                      <span className="col-span-1" />
                    </div>
                    {itemForm.roles.map((rol, ri) => (
                      <div key={ri} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <select value={rol.personaNombre} onChange={e => pickPersona(ri, e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400">
                            <option value="">— Elegir —</option>
                            {personas.map(p => <option key={p.id} value={p.nombre}>{p.nombre} ({p.rol})</option>)}
                            {rol.personaNombre && !personas.find(p => p.nombre === rol.personaNombre) && (
                              <option value={rol.personaNombre}>{rol.personaNombre}</option>
                            )}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input type="number" value={rol.tarifaHora} min="0"
                            onChange={e => updRol(ri, 'tarifaHora', parseFloat(e.target.value) || 0)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                        </div>
                        <div className="col-span-3">
                          <input type="number" value={rol.horas} min="0" step="0.5"
                            onChange={e => updRol(ri, 'horas', parseFloat(e.target.value) || 0)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-xs text-blue-400">{formatUSD(rol.tarifaHora * rol.horas)}</span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => setItemForm(p => ({ ...p, roles: p.roles.filter((_, i) => i !== ri) }))}
                            className="text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Margen + Descuento */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Modo margen</label>
                  <select value={itemForm.modoMargen}
                    onChange={e => setItemForm(p => ({ ...p, modoMargen: e.target.value as 'markup' | 'margin' }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    <option value="markup">Markup (sobre costo)</option>
                    <option value="margin">Margin (sobre precio)</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    {itemForm.modoMargen === 'markup'
                      ? 'precio = costo × (1 + %)'
                      : 'precio = costo ÷ (1 − %)'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    {itemForm.modoMargen === 'markup' ? 'Markup' : 'Margen'} %
                  </label>
                  <input type="number" min="0" max="500"
                    value={Math.round(itemForm.margen * 100)}
                    onChange={e => setItemForm(p => ({ ...p, margen: (parseFloat(e.target.value) || 0) / 100 }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Descuento %</label>
                  <input type="number" min="0" max="100"
                    value={Math.round(itemForm.descuento * 100)}
                    onChange={e => setItemForm(p => ({ ...p, descuento: (parseFloat(e.target.value) || 0) / 100 }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>

              {/* Live preview */}
              {(() => {
                const { costo, precio, precioConDesc, ganancia } = calcItem(itemForm)
                const mgn = precioConDesc > 0 ? ((ganancia / precioConDesc) * 100).toFixed(1) : '0'
                return (
                  <div className="bg-gray-800/60 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Preview en tiempo real</p>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Costo',        val: formatUSD(costo),        sub: formatCurrency(costo * form.tipoCambio),        color: 'text-blue-400'   },
                        { label: 'Precio s/desc', val: formatUSD(precio),       sub: '',                                             color: 'text-white'      },
                        { label: 'Precio final',  val: formatUSD(precioConDesc),sub: formatCurrency(precioConDesc * form.tipoCambio),color: 'text-yellow-400' },
                        { label: 'Ganancia',      val: formatUSD(ganancia),     sub: `${mgn}% del precio`,                           color: 'text-green-400'  },
                      ].map(({ label, val, sub, color }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <p className={`text-sm font-bold ${color}`}>{val}</p>
                          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setItemModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={saveItem}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {itemIdx === null ? 'Agregar ítem' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print / Propuesta ─────────────────────────────────────────────────── */}
      {printCot && (() => {
        const cotItems = printCot.items.map(itemFromDB)
        const tots     = calcTotales(cotItems, printCot.descuentoGlobal)
        const vence    = new Date(printCot.createdAt)
        vence.setDate(vence.getDate() + printCot.validezDias)

        return (
          <>
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #cot-print-view, #cot-print-view * { visibility: visible; }
                #cot-print-view { position: fixed; top: 0; left: 0; width: 100%; background: white; }
              }
            `}</style>
            <div id="cot-print-view" className="fixed inset-0 bg-white z-[100] overflow-auto">
              {/* Toolbar — oculto al imprimir */}
              <div className="bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center gap-3 print:hidden">
                <button onClick={() => window.print()}
                  className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2 rounded-xl text-sm font-semibold">
                  Imprimir / Guardar PDF
                </button>
                <button onClick={() => setPrintCot(null)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
                <span className="text-xs text-gray-400">Solo se imprime la propuesta — sin costos ni márgenes internos</span>
              </div>

              {/* Propuesta */}
              <div className="max-w-3xl mx-auto p-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-10">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">Valy Agency</h1>
                    <p className="text-gray-500 text-sm mt-1">Propuesta de servicios digitales</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gray-900">{printCot.numero}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Fecha: {new Date(printCot.createdAt).toLocaleDateString('es-AR')}</p>
                    <p className="text-xs text-gray-400">Válida hasta: {vence.toLocaleDateString('es-AR')}</p>
                  </div>
                </div>

                {/* Cliente */}
                {printCot.cliente && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-8">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Preparada para</p>
                    <p className="font-bold text-gray-900 text-lg">{printCot.cliente.nombre}</p>
                    {printCot.cliente.empresa && <p className="text-gray-500">{printCot.cliente.empresa}</p>}
                  </div>
                )}

                {/* Tabla ítems */}
                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b-2 border-gray-900">
                      <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider pb-3">Servicio</th>
                      <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider pb-3">Tipo</th>
                      <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider pb-3">Inversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotItems.map((item, i) => {
                      const { precioConDesc } = calcItem(item)
                      return (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-3.5">
                            <p className="font-medium text-gray-900">{item.descripcion}</p>
                          </td>
                          <td className="py-3.5 text-center">
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                              item.tipoInversion === 'mensual'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.tipoInversion === 'mensual' ? 'Mensual' : 'Única vez'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-gray-900">
                            {printCot.moneda === 'usd'
                              ? formatUSD(precioConDesc)
                              : formatCurrency(precioConDesc * printCot.tipoCambio)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Totales */}
                <div className="flex justify-end mb-8">
                  <div className="w-64 space-y-2">
                    {tots.unicaVez > 0 && tots.mensual > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Única vez</span>
                          <span className="text-gray-900">{formatUSD(tots.unicaVez)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Mensual</span>
                          <span className="text-gray-900">{formatUSD(tots.mensual)}/mes</span>
                        </div>
                      </>
                    )}
                    {printCot.descuentoGlobal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Descuento {(printCot.descuentoGlobal * 100).toFixed(0)}%</span>
                        <span className="text-red-600">-{formatUSD(tots.descuentoMonto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t-2 border-gray-900 pt-2.5">
                      <span>Total</span>
                      <div className="text-right">
                        <p className="text-gray-900">{formatUSD(tots.total)}</p>
                        <p className="text-xs text-gray-400 font-normal">{formatCurrency(tots.total * printCot.tipoCambio)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Condiciones */}
                {printCot.condicionesPago && (
                  <div className="border border-gray-200 rounded-xl p-4 mb-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Condiciones de pago</p>
                    <p className="text-sm text-gray-700">{printCot.condicionesPago}</p>
                  </div>
                )}

                {/* Notas cliente */}
                {printCot.notasCliente && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Notas</p>
                    <p className="text-sm text-gray-700">{printCot.notasCliente}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-gray-200 pt-6 text-center">
                  <p className="text-xs text-gray-400">
                    Propuesta válida por {printCot.validezDias} días · {new Date(printCot.createdAt).toLocaleDateString('es-AR')} · Valy Agency
                  </p>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Confirmar eliminar ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar cotización?</h3>
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