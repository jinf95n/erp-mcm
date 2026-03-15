'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, ShoppingBag, DollarSign, Clock, Award } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/src/lib/utils'

interface Metrics {
  ingresosDelMes: number
  ingresosTotales: number
  pagosPendientes: number
  gananciaAgencia: number
  totalDesarrolladores: number
  totalPMs: number
  totalComisiones: number
  proyectosActivos: number
  clientesActivos: number
  ingresosPorMes: { mes: string; ingresos: number }[]
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setMetrics(data)
      })
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
    {
      label: 'Ingresos del mes',
      value: formatCurrency(metrics.ingresosDelMes),
      icon: TrendingUp,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10 border-yellow-400/20',
    },
    {
      label: 'Ingresos totales',
      value: formatCurrency(metrics.ingresosTotales),
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-400/10 border-green-400/20',
    },
    {
      label: 'Pendiente de cobro',
      value: formatCurrency(metrics.pagosPendientes),
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10 border-orange-400/20',
    },
    {
      label: 'Ganancia agencia',
      value: formatCurrency(metrics.gananciaAgencia),
      icon: Award,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10 border-blue-400/20',
    },
    {
      label: 'Proyectos activos',
      value: metrics.proyectosActivos,
      icon: ShoppingBag,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10 border-purple-400/20',
    },
    {
      label: 'Clientes activos',
      value: metrics.clientesActivos,
      icon: Users,
      color: 'text-pink-400',
      bg: 'bg-pink-400/10 border-pink-400/20',
    },
  ]

  const costos = [
    { label: 'Desarrolladores', value: metrics.totalDesarrolladores, color: 'bg-blue-500' },
    { label: 'PMs', value: metrics.totalPMs, color: 'bg-purple-500' },
    { label: 'Comisiones', value: metrics.totalComisiones, color: 'bg-orange-500' },
    { label: 'Ganancia', value: metrics.gananciaAgencia, color: 'bg-yellow-400' },
  ]
  const totalCostos = costos.reduce((s, c) => s + Math.max(c.value, 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumen financiero de la agencia</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Gráfico ingresos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-6">Ingresos últimos 6 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={metrics.ingresosPorMes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#facc15" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
              labelStyle={{ color: '#f9fafb', fontSize: 12 }}
              formatter={(value) => [formatCurrency(Number(value)), 'Ingresos']}
            />
            <Area type="monotone" dataKey="ingresos" stroke="#facc15" strokeWidth={2} fill="url(#colorIngresos)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribución de costos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-5">Distribución de ingresos cobrados</h2>
        <div className="space-y-3">
          {costos.map(({ label, value, color }) => {
            const pct = totalCostos > 0 ? Math.max((value / totalCostos) * 100, 0) : 0
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-medium">{formatCurrency(value)} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}