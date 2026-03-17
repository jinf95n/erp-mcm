// src/app/api/pagos/route.ts
// Usa generarDistribucionesVenta desde lib/distribuciones

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'
import { generarDistribucionesVenta } from '@/src/lib/distribuciones'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const ventaId = searchParams.get('ventaId')

    const where = ventaId ? { ventaId } : {}

    const pagos = await prisma.pago.findMany({
      where,
      include: {
        venta: {
          include: { cliente: { select: { nombre: true, empresa: true } } },
        },
      },
      orderBy: { fecha: 'desc' },
    })

    return NextResponse.json({ pagos })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { ventaId, monto, tipoPago, notas, fecha } = body

    if (!ventaId || !monto || !tipoPago) {
      return NextResponse.json({ error: 'ventaId, monto y tipoPago son requeridos' }, { status: 400 })
    }

    const montoNum = parseFloat(monto)

    const pago = await prisma.pago.create({
      data: {
        ventaId,
        monto:    montoNum,
        tipoPago,
        notas:    notas || null,
        fecha:    fecha ? new Date(fecha) : new Date(),
      },
      include: {
        venta: { include: { cliente: { select: { nombre: true } } } },
      },
    })

    // Verificar si la venta se completó y generar distribuciones
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { pagos: true, costos: true },
    })

    if (venta) {
      const totalPagado = venta.pagos.reduce((s, p) => s + p.monto, 0)
      if (totalPagado >= venta.precioTotal && venta.estado !== 'cancelado') {
        await prisma.venta.update({ where: { id: ventaId }, data: { estado: 'completado' } })
      }

      // Generar distribuciones waterfall
      await generarDistribucionesVenta(ventaId, pago.id, montoNum, venta.costos)
    }

    return NextResponse.json(pago, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
  }
}

// DELETE legacy por body (compatibilidad)
export async function DELETE(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await prisma.distribucion.deleteMany({ where: { pagoId: id } })
    await prisma.pago.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 })
  }
}