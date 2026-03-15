'use client'

import { useState, useEffect, useCallback } from 'react'
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
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const TIPOS_COLOR: Record<string, string> = {
  inicial:  'bg-blue-900/40 text-blue-400 border-blue-700/40',
  cuota:    'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  final:    'bg-green-900/40 text-green-400 border-green-700/40',
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPagos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pagos', { headers: authHeaders() })
      const data = await res.json()
      setPagos(data.pagos || [])
    } catch { setError('Error al cargar pagos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPagos() }, [fetchPagos])

  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0)

  const porTipo: Record<string, number> = {}
  pagos.forEach(p => {
    porTipo[p.tipoPago] = (porTipo[p.tipoPago] || 0) + p.monto
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pagos</h1>
        <p className="text-gray-400 text-sm mt-1">Historial de cobros registrados</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total cobrado</p>
          <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Cantidad de pagos</p>
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

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-white">{p.venta.nombreProyecto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.venta.cliente.nombre}{p.venta.cliente.empresa ? ` · ${p.venta.cliente.empresa}` : ''}</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-4 text-center">
        Para registrar nuevos pagos, ingresá a una venta desde la sección Ventas y hacé clic en &quot;Agregar pago&quot;
      </p>
    </div>
  )
}