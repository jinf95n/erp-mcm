// src/app/dashboard/caja/page.tsx
// Flujo de caja: ingresos cobrados - salidas (distribuciones pagadas) - gastos = saldo en cuenta

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, TrendingDown, Clock, CheckCircle2, DollarSign, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Persona { id: string; nombre: string; rol: string }
interface Venta   { id: string; nombreProyecto: string }
interface Distribucion {
  id: string
  descripcion: string
  monto: number
  estado: string
  tipo: string
  fechaPago: string | null
  notas: string | null
  personaId: string | null
  personaNombre: string | null
  persona: Persona | null
  venta: Venta | null
}
interface DolarInfo { compra: number | null; venta: number | null; promedio: number | null; fecha: string | null; error?: string }

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH()    { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

export default function CajaPage() {
  const [distribuciones, setDistribuciones] = useState<Distribucion[]>([])
  const [dashMetrics, setDashMetrics]        = useState<{ ingresosTotales: number; gastosTotales: number; cajaActual: number; salidasPagadas: number; salidasPendientes: number } | null>(null)
  const [dolar, setDolar]                    = useState<DolarInfo | null>(null)
  const [loading, setLoading]                = useState(true)
  const [filtro, setFiltro]                  = useState<'todos' | 'pendiente' | 'pagado'>('pendiente')
  const [error, setError]                    = useState('')
  // Modal marcar pagado
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoDistId, setPagoDistId] = useState<string | null>(null)
  const [pagoFecha, setPagoFecha]   = useState('')
  const [pagoNotas, setPagoNotas]   = useState('')
  const [saving, setSaving]         = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rDist, rDash, rDolar] = await Promise.all([
        fetch('/api/distribuciones', { headers: authH() }),
        fetch('/api/dashboard',      { headers: authH() }),
        fetch('/api/dolar',          { headers: authH() }),
      ])
      const dDist = await rDist.json()
      const dDash = await rDash.json()
      const dDolar = await rDolar.json()
      setDistribuciones(dDist.distribuciones || [])
      setDashMetrics({
        ingresosTotales:  dDash.ingresosTotales,
        gastosTotales:    dDash.gastosTotales,
        cajaActual:       dDash.cajaActual,
        salidasPagadas:   dDash.salidasPagadas,
        salidasPendientes: dDash.salidasPendientes,
      })
      setDolar(dDolar)
    } catch { setError('Error al cargar datos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const hoy = new Date().toISOString().split('T')[0]

  function abrirMarcarPagado(id: string) {
    setPagoDistId(id); setPagoFecha(hoy); setPagoNotas(''); setPagoModal(true)
  }

  async function marcarPagado() {
    if (!pagoDistId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/distribuciones/${pagoDistId}`, {
        method: 'PUT', headers: authH(),
        body: JSON.stringify({ estado: 'pagado', fechaPago: pagoFecha, notas: pagoNotas }),
      })
      if (res.ok) { setPagoModal(false); fetchData() }
    } finally { setSaving(false) }
  }

  async function marcarPendiente(id: string) {
    await fetch(`/api/distribuciones/${id}`, {
      method: 'PUT', headers: authH(),
      body: JSON.stringify({ estado: 'pendiente', fechaPago: null }),
    })
    fetchData()
  }

  const filtradas = distribuciones.filter(d => filtro === 'todos' || d.estado === filtro)

  // Agrupar por persona
  const porPersona = filtradas.reduce<Record<string, { nombre: string; items: Distribucion[]; total: number }>>((acc, d) => {
    const nombre = d.persona?.nombre || d.personaNombre || 'Sin asignar'
    if (!acc[nombre]) acc[nombre] = { nombre, items: [], total: 0 }
    acc[nombre].items.push(d)
    acc[nombre].total += d.monto
    return acc
  }, {})

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja</h1>
          <p className="text-gray-400 text-sm mt-1">Saldo real y distribución del dinero</p>
        </div>
        {/* Dólar oficial */}
        {dolar && !dolar.error && dolar.promedio && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <div className="text-right">
              <p className="text-xs text-gray-500">USD Oficial</p>
              <p className="text-sm font-bold text-green-400">{formatCurrency(dolar.promedio)}</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Resumen */}
      {dashMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-green-400/20 rounded-2xl p-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-400" />
              <p className="text-xs text-gray-500">Saldo en caja</p>
            </div>
            <p className={`text-2xl font-bold ${dashMetrics.cajaActual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(dashMetrics.cajaActual)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Cobrado − pagado − gastos</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-2">Cobrado total</p>
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(dashMetrics.ingresosTotales)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs text-gray-500">Ya enviado</p>
            </div>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(dashMetrics.salidasPagadas)}</p>
          </div>
          <div className="bg-gray-900 border border-orange-400/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs text-gray-500">Pendiente enviar</p>
            </div>
            <p className="text-xl font-bold text-orange-400">{formatCurrency(dashMetrics.salidasPendientes)}</p>
          </div>
        </div>
      )}

      {/* Barra de fórmula visual */}
      {dashMetrics && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <p className="text-xs text-gray-500 mb-3">Composición del saldo</p>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="text-yellow-400 font-semibold">{formatCurrency(dashMetrics.ingresosTotales)}</span>
            <span className="text-gray-600">cobrado</span>
            <span className="text-gray-600">−</span>
            <span className="text-blue-400 font-semibold">{formatCurrency(dashMetrics.salidasPagadas)}</span>
            <span className="text-gray-600">enviado</span>
            <span className="text-gray-600">−</span>
            <span className="text-red-400 font-semibold">{formatCurrency(dashMetrics.gastosTotales)}</span>
            <span className="text-gray-600">gastos</span>
            <span className="text-gray-600">=</span>
            <span className={`font-bold text-base ${dashMetrics.cajaActual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(dashMetrics.cajaActual)}
            </span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {(['pendiente', 'pagado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize ${
              filtro === f
                ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes de enviar' : 'Ya enviados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : Object.keys(porPersona).length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="font-medium">Sin distribuciones {filtro !== 'todos' ? `${filtro}s` : ''}</p>
          <p className="text-sm mt-1">Registrá pagos en una venta para que aparezcan aquí</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porPersona).map(([nombre, grupo]) => (
            <div key={nombre}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-yellow-400">{nombre.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{nombre}</span>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(grupo.total)}</span>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-800">
                    {grupo.items.map(d => (
                      <tr key={d.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="text-sm text-white">{d.descripcion}</p>
                            {d.venta && <p className="text-xs text-gray-500 mt-0.5">{d.venta.nombreProyecto}</p>}
                            {d.fechaPago && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                Enviado: {new Date(d.fechaPago).toLocaleDateString('es-AR')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium border ${
                            d.tipo === 'ganancia'
                              ? 'bg-purple-900/40 text-purple-400 border-purple-700/40'
                              : 'bg-blue-900/40 text-blue-400 border-blue-700/40'
                          }`}>
                            {d.tipo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-sm font-semibold text-white">{formatCurrency(d.monto)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {d.estado === 'pendiente' ? (
                            <button onClick={() => abrirMarcarPagado(d.id)}
                              className="text-xs bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-700/40 px-3 py-1.5 rounded-lg transition-colors">
                              Marcar enviado
                            </button>
                          ) : (
                            <button onClick={() => marcarPendiente(d.id)}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                              ✓ Enviado
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar envío */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Confirmar envío</h3>
            <p className="text-gray-400 text-sm mb-4">Esto indica que el dinero ya salió de la caja.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Fecha de envío</label>
                <input type="date" value={pagoFecha}
                  onChange={e => setPagoFecha(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas (opcional)</label>
                <input type="text" value={pagoNotas}
                  onChange={e => setPagoNotas(e.target.value)}
                  placeholder="Transferencia, efectivo, etc."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPagoModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={marcarPagado} disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Confirmar envío'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}