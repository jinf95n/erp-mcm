// src/app/api/dashboard/route.ts
// Fix #6: socios se leen de la DB en lugar de array hardcodeado

import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { calcWaterfall } from '@/src/lib/waterfall'


type PersonaIngresos = {
  [concepto: string]: number
  ganancia: number
}

function getPersona(map: Record<string, PersonaIngresos>, nombre: string): PersonaIngresos {
  if (!map[nombre]) map[nombre] = { ganancia: 0 }
  return map[nombre]
}

export async function GET() {
  try {
    const now          = new Date()
    const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Fix #6: leer socios desde la DB
    const sociosDB     = await prisma.persona.findMany({ where: { rol: 'socio', activo: true } })
    const SOCIOS       = sociosDB.length > 0 ? sociosDB.map(s => s.nombre) : ['Juan', 'Carlos']

    const ventas = await prisma.venta.findMany({
      where: { deletedAt: null },
      include: { pagos: true, costos: true },
    })

    const todosPagos = await prisma.pago.findMany({
      include: { venta: { select: { deletedAt: true } } },
    })
    const pagosValidos = todosPagos.filter(p => !p.venta.deletedAt)

    const pagosDelMes = pagosValidos.filter(p => {
      const f = new Date(p.fecha)
      return f >= primerDiaMes && f <= ultimoDiaMes
    })

    const ingresosDelMes  = pagosDelMes.reduce((s, p) => s + p.monto, 0)
    const ingresosTotales = pagosValidos.reduce((s, p) => s + p.monto, 0)

    const distribucionCostos: Record<string, number> = {}
    let gananciaAgenciaBruta = 0

    const ingresosPorPersona: Record<string, PersonaIngresos> = {}
    SOCIOS.forEach(s => getPersona(ingresosPorPersona, s))

    ventas.forEach(venta => {
      const totalPagado = venta.pagos.reduce((s, p) => s + p.monto, 0)
      if (venta.precioTotal <= 0 || venta.costos.length === 0) {
        gananciaAgenciaBruta += totalPagado
        SOCIOS.forEach(s => {
          getPersona(ingresosPorPersona, s).ganancia += totalPagado / SOCIOS.length
        })
        return
      }

      const { cobrado, ganancia } = calcWaterfall(totalPagado, venta.costos)

      gananciaAgenciaBruta += ganancia

      venta.costos.forEach((costo, i) => {
        const montoCubierto = cobrado[i]

        // Acumular en distribución por tipo de costo
        const key = costo.descripcion
        distribucionCostos[key] = (distribucionCostos[key] || 0) + montoCubierto

        // Asignar a la persona que ejecuta ese costo
        const persona = costo.personaNombre || 'Sin asignar'
        const p = getPersona(ingresosPorPersona, persona)
        p[key] = (p[key] || 0) + montoCubierto
      })

      // Ganancia de agencia: split entre socios
      SOCIOS.forEach(s => {
        getPersona(ingresosPorPersona, s).ganancia += ganancia / SOCIOS.length
      })
    })

    // Totales de costos para el dashboard (compatibilidad)
    const totalDesarrolladores = distribucionCostos['Desarrollo'] || 0
    const totalPMs             = distribucionCostos['PM']         || 0
    const totalComisiones      = Object.entries(distribucionCostos)
      .filter(([k]) => k.toLowerCase().includes('comisión') || k.toLowerCase().includes('comision'))
      .reduce((s, [, v]) => s + v, 0)

    // Mantenimientos
    const mantenimientos = await prisma.mantenimiento.findMany({
      include: { cobros: true },
    })

    let ingresosMantenimiento    = 0
    let ingresosMantenimientoMes = 0

    mantenimientos.forEach(m => {
      m.cobros.forEach(cobro => {
        const f = new Date(cobro.fecha)
        ingresosMantenimiento += cobro.monto
        if (f >= primerDiaMes && f <= ultimoDiaMes) ingresosMantenimientoMes += cobro.monto

        const devPart = m.montoMensual > 0 ? cobro.monto * (m.costoDesarrollador / m.montoMensual) : 0
        const agPart  = cobro.monto - devPart

        const devNom = m.desarrolladorNombre || 'Juan'
        const p = getPersona(ingresosPorPersona, devNom)
        p['Mantenimiento'] = (p['Mantenimiento'] || 0) + devPart

        gananciaAgenciaBruta += agPart
        SOCIOS.forEach(s => {
          getPersona(ingresosPorPersona, s).ganancia += agPart / SOCIOS.length
        })
      })
    })

    // Gastos
    const gastos        = await prisma.gasto.findMany()
    const gastosTotales = gastos.reduce((s, g) => s + g.monto, 0)
    const gastosDelMes  = gastos
      .filter(g => { const f = new Date(g.fecha); return f >= primerDiaMes && f <= ultimoDiaMes })
      .reduce((s, g) => s + g.monto, 0)

    SOCIOS.forEach(s => {
      getPersona(ingresosPorPersona, s).ganancia -= gastosTotales / SOCIOS.length
    })

    const gananciaNeta = gananciaAgenciaBruta - gastosTotales

    // ── Caja ──────────────────────────────────────────────────────────────
    const distribuciones    = await prisma.distribucion.findMany()
    const salidasPagadas    = distribuciones.filter(d => d.estado === 'pagado').reduce((s, d) => s + d.monto, 0)
    const salidasPendientes = distribuciones.filter(d => d.estado === 'pendiente').reduce((s, d) => s + d.monto, 0)
    const totalCobrado      = ingresosTotales + ingresosMantenimiento
    const cajaActual        = totalCobrado - salidasPagadas - gastosTotales

    const pagosPendientes = ventas.reduce((sum, v) => {
      const cobrado = v.pagos.reduce((s, p) => s + p.monto, 0)
      return sum + (v.precioTotal - cobrado)
    }, 0)

    const proyectosActivos = ventas.filter(v => v.estado === 'activo').length
    const clientesActivos  = await prisma.cliente.count({ where: { activo: true, deletedAt: null } })

    const totalMensualMantenimiento = mantenimientos
      .filter(m => m.activo)
      .reduce((s, m) => s + m.montoMensual, 0)

    // Gráfico últimos 6 meses
    const ingresosPorMes = []
    for (let i = 5; i >= 0; i--) {
      const desde = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const hasta = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

      const proyMes = pagosValidos
        .filter(p => { const f = new Date(p.fecha); return f >= desde && f <= hasta })
        .reduce((s, p) => s + p.monto, 0)

      const mantMes = mantenimientos
        .flatMap(m => m.cobros)
        .filter(c => { const f = new Date(c.fecha); return f >= desde && f <= hasta })
        .reduce((s, c) => s + c.monto, 0)

      const gastosMes = gastos
        .filter(g => { const f = new Date(g.fecha); return f >= desde && f <= hasta })
        .reduce((s, g) => s + g.monto, 0)

      ingresosPorMes.push({
        mes: desde.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
        ingresos: proyMes + mantMes,
        gastos: gastosMes,
      })
    }

    return NextResponse.json({
      ingresosDelMes: ingresosDelMes + ingresosMantenimientoMes,
      ingresosTotales: ingresosTotales + ingresosMantenimiento,
      pagosPendientes,
      gananciaAgenciaBruta,
      gastosTotales,
      gastosDelMes,
      gananciaNeta,
      cajaActual,
      salidasPagadas,
      salidasPendientes,
      totalMensualMantenimiento,
      totalDesarrolladores,
      totalPMs,
      totalComisiones,
      distribucionCostos,
      proyectosActivos,
      clientesActivos,
      ingresosPorMes,
      ingresosPorPersona,
    })
  } catch (error) {
    console.error('Error en dashboard:', error)
    return NextResponse.json({ error: 'Error al cargar métricas' }, { status: 500 })
  }
}