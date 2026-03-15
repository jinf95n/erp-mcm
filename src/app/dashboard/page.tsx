// src/app/dashboard/page.tsx

'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, Users, ShoppingBag, DollarSign,
  Clock, Award, ArrowDownCircle, RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency } from '@/src/lib/utils'

// ingresosPorPersona: claves dinámicas (nombre de costo) + "ganancia"
type PersonaIngresos = Record<string, number>

interface Metrics {
  ingresosDelMes: number
  ingresosTotales: number
  pagosPendientes: number
  gananciaAgenciaBruta: number
  gastosTotales: number
  gastosDelMes: number
  gananciaNeta: number
  totalMensualMantenimiento: number
  totalDesarrolladores: number
  totalPMs: number
  totalComisiones: number
  distribucionCostos: Record<string, number>
  proyectosActivos: number
  clientesActivos: number
  ingresosPorMes: { mes: string; ingresos: number; gastos: number }[]
  ingresosPorPersona: Record<string, PersonaIngresos>
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : ''
}

// Suma todos los valores de una persona (claves dinámicas)
function totalPersona(p: PersonaIngresos): number {
  return Object.values(p).reduce((s, v) => s + (isFinite(v) ? v : 0), 0)
}

// Colores por persona (extensible)
const PERSONA_STYLE: Record<string, { color: string; bg: string; bar: string }> = {
  Juan:   { color: 'text-yellow-400', bg: 'bg-yellow-400/20 border-yellow-400/30', bar: 'bg-yellow-400' },
  Carlos: { color: 'text-blue-400',   bg: 'bg-blue-400/20 border-blue-400/30',     bar: 'bg-blue-400'   },
}
const DEFAULT_STYLE = { color: 'text-green-400', bg: 'bg-green-400/20 border-green-400/30', bar: 'bg-green-400' }

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/dashboard', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setMetrics(data) })
      .catch(() => setError('Error al cargar métricas'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400">{error || 'Error desconocido'}</p>
      </div>
    )
  }

  const cards = [
    { label: 'Ingresos del mes',   value: formatCurrency(metrics.ingresosDelMes),            icon: TrendingUp,     color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
    { label: 'Ingresos totales',   value: formatCurrency(metrics.ingresosTotales),            icon: DollarSign,     color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20'  },
    { label: 'Pendiente de cobro', value: formatCurrency(metrics.pagosPendientes),            icon: Clock,          color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20'},
    { label: 'Ganancia neta',      value: formatCurrency(metrics.gananciaNeta),               icon: Award,
      color: metrics.gananciaNeta >= 0 ? 'text-blue-400' : 'text-red-400',
      bg: 'bg-blue-400/10 border-blue-400/20' },
    { label: 'Gastos registrados', value: formatCurrency(metrics.gastosTotales),              icon: ArrowDownCircle,color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20'     },
    { label: 'Mantenimiento/mes',  value: formatCurrency(metrics.totalMensualMantenimiento),  icon: RefreshCw,      color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20'},
    { label: 'Proyectos activos',  value: metrics.proyectosActivos,                           icon: ShoppingBag,    color: 'text-teal-400',   bg: 'bg-teal-400/10 border-teal-400/20'   },
    { label: 'Clientes activos',   value: metrics.clientesActivos,                            icon: Users,          color: 'text-pink-400',   bg: 'bg-pink-400/10 border-pink-400/20'   },
  ]

  // Distribución dinámica por concepto de costo
  const distribEntries = Object.entries(metrics.distribucionCostos || {})
  const distribRows = [
    ...distribEntries.map(([label, value]) => ({ label, value, color: 'bg-blue-500' })),
    { label: 'Gastos agencia', value: metrics.gastosTotales,                         color: 'bg-red-500'    },
    { label: 'Ganancia neta',  value: Math.max(metrics.gananciaNeta, 0),             color: 'bg-yellow-400' },
  ]
  const totalDist = distribRows.reduce((s, r) => s + Math.max(r.value, 0), 0)

  // Personas
  const personas = Object.entries(metrics.ingresosPorPersona || {})
  const totalSocios = personas.reduce((s, [, p]) => s + Math.max(totalPersona(p), 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumen financiero de la agencia</p>
      </div>

      {/* Balance del mes */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Balance del mes</p>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Ingresos</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(metrics.ingresosDelMes)}</p>
          </div>
          <span className="text-gray-600 text-xl">−</span>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Gastos</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(metrics.gastosDelMes)}</p>
          </div>
          <span className="text-gray-600 text-xl">=</span>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Balance</p>
            <p className={`text-lg font-bold ${metrics.ingresosDelMes - metrics.gastosDelMes >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {formatCurrency(metrics.ingresosDelMes - metrics.gastosDelMes)}
            </p>
          </div>
          {metrics.totalMensualMantenimiento > 0 && (
            <>
              <span className="text-gray-700 text-xs hidden md:block">· recurrente</span>
              <div className="hidden md:block">
                <p className="text-xs text-gray-500 mb-0.5">Mant. mensual</p>
                <p className="text-lg font-bold text-purple-400">{formatCurrency(metrics.totalMensualMantenimiento)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`bg-gray-900 border rounded-2xl p-5 ${bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico ingresos vs gastos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-6">Ingresos vs Gastos — últimos 6 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={metrics.ingresosPorMes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'ingresos' ? 'Ingresos' : 'Gastos',
              ]}
            />
            <Legend
              formatter={v => v === 'ingresos' ? 'Ingresos' : 'Gastos'}
              wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
            />
            <Bar dataKey="gastos"   fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ingresos" fill="#facc15" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distribución de ingresos — dinámica por concepto */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-5">Distribución de ingresos cobrados</h2>
        <div className="space-y-3">
          {distribRows.map(({ label, value, color }) => {
            const pct = totalDist > 0 ? Math.max((value / totalDist) * 100, 0) : 0
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-medium">
                    {formatCurrency(value)} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ingresos por persona — claves dinámicas */}
      {personas.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-white">Ingresos por persona</h2>
            <span className="text-xs text-gray-500">Sobre cobros actuales · descontando gastos</span>
          </div>
          <p className="text-xs text-gray-600 mb-5">
            Roles asignados por venta · gastos de agencia repartidos entre socios
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {personas.map(([nombre, p]) => {
              const style = PERSONA_STYLE[nombre] || DEFAULT_STYLE
              const tot   = totalPersona(p)

              // Separar concepto de "ganancia" del resto
              const ganancia = isFinite(p.ganancia) ? p.ganancia : 0
              const conceptos = Object.entries(p).filter(([k]) => k !== 'ganancia')

              return (
                <div key={nombre} className={`bg-gray-800/60 border rounded-2xl p-5 ${style.bg}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${style.bg} ${style.color}`}>
                      {nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{nombre}</p>
                      <p className="text-xs text-gray-500">
                        {conceptos.filter(([, v]) => v > 0).map(([k]) => k).join(' · ') || 'Solo ganancia'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs mb-4">
                    {conceptos.map(([concepto, val]) => {
                      const v = isFinite(val) ? val : 0
                      if (v === 0) return null
                      return (
                        <div key={concepto} className="flex justify-between text-gray-400">
                          <span>{concepto}</span>
                          <span>{formatCurrency(v)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between text-gray-400">
                      <span>½ ganancia agencia</span>
                      <span className={ganancia < 0 ? 'text-red-400' : ''}>{formatCurrency(ganancia)}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-3 flex justify-between items-baseline">
                    <span className="text-xs text-gray-500">Total</span>
                    <span className={`text-xl font-bold ${tot >= 0 ? style.color : 'text-red-400'}`}>
                      {formatCurrency(tot)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Barra comparativa */}
          {totalSocios > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                {personas.map(([nombre, p]) => {
                  const tot = Math.max(totalPersona(p), 0)
                  const pct = totalSocios > 0 ? ((tot / totalSocios) * 100).toFixed(0) : '0'
                  return <span key={nombre}>{nombre} ({pct}%)</span>
                })}
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                {personas.map(([nombre, p], i) => {
                  const tot  = Math.max(totalPersona(p), 0)
                  const pct  = totalSocios > 0 ? (tot / totalSocios) * 100 : 0
                  const style = PERSONA_STYLE[nombre] || DEFAULT_STYLE
                  const rounded = i === 0 ? 'rounded-l-full' : i === personas.length - 1 ? 'rounded-r-full' : ''
                  return (
                    <div
                      key={nombre}
                      className={`h-full ${style.bar} ${rounded} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}