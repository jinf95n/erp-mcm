// src/lib/distribuciones.ts
// Helper compartido: genera distribuciones waterfall para un pago dado.
// Usado por: api/pagos/route.ts (POST), api/ventas/route.ts (POST), api/cobros/route.ts (POST)

import { prisma } from '@/src/lib/prisma'
import { calcWaterfall } from '@/src/lib/waterfall'

interface CostoBasico {
  monto: number
  descripcion: string
  personaId: string | null
  personaNombre: string | null
}

/**
 * Calcula qué fracción nueva del waterfall cubre este pago
 * y crea las distribuciones correspondientes en la DB.
 *
 * @param ventaId   ID de la venta
 * @param pagoId    ID del pago recién creado
 * @param pagoMonto Monto del pago recién creado (ya sumado al total)
 * @param costos    Array de costos de la venta (orden importa)
 */
export async function generarDistribucionesVenta(
  ventaId: string,
  pagoId: string,
  pagoMonto: number,
  costos: CostoBasico[]
) {
  if (costos.length === 0) return

  // Total cobrado ANTES de este pago
  const otrosPagos = await prisma.pago.findMany({
    where: { ventaId, id: { not: pagoId } },
  })
  const prevTotal = otrosPagos.reduce((s, p) => s + p.monto, 0)
  const newTotal  = prevTotal + pagoMonto

  const prev = calcWaterfall(prevTotal, costos)
  const curr = calcWaterfall(newTotal,  costos)

  // Socios para dividir la ganancia
  const socios = await prisma.persona.findMany({ where: { rol: 'socio', activo: true } })
  const sociosNombres = socios.length > 0 ? socios.map(s => s.nombre) : ['Juan', 'Carlos']

  const data: Array<{
    ventaId: string
    pagoId: string
    descripcion: string
    monto: number
    tipo: string
    estado: string
    personaId: string | null
    personaNombre: string | null
  }> = []

  // Distribución por cada costo
  costos.forEach((costo, i) => {
    const delta = curr.cobrado[i] - prev.cobrado[i]
    if (delta > 0.01) {
      data.push({
        ventaId,
        pagoId,
        descripcion:   costo.descripcion,
        monto:         Math.round(delta * 100) / 100,
        tipo:          'costo',
        estado:        'pendiente',
        personaId:     costo.personaId,
        personaNombre: costo.personaNombre,
      })
    }
  })

  // Ganancia de agencia → dividida entre socios
  const deltaGanancia = curr.ganancia - prev.ganancia
  if (deltaGanancia > 0.01) {
    const montoPorSocio = Math.round((deltaGanancia / sociosNombres.length) * 100) / 100
    sociosNombres.forEach(nombre => {
      const persona = socios.find(s => s.nombre === nombre)
      data.push({
        ventaId,
        pagoId,
        descripcion:   'Ganancia agencia',
        monto:         montoPorSocio,
        tipo:          'ganancia',
        estado:        'pendiente',
        personaId:     persona?.id || null,
        personaNombre: nombre,
      })
    })
  }

  if (data.length > 0) {
    await prisma.distribucion.createMany({ data })
  }
}

/**
 * Regenera distribuciones de un pago existente (usado al editar monto).
 * Elimina las anteriores y recalcula.
 */
export async function regenerarDistribucionesVenta(pagoId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { venta: { include: { costos: true } } },
  })
  if (!pago || !pago.venta) return

  await prisma.distribucion.deleteMany({ where: { pagoId } })

  if (pago.venta.costos.length === 0) return

  await generarDistribucionesVenta(
    pago.ventaId,
    pagoId,
    pago.monto,
    pago.venta.costos
  )
}