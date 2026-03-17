// src/app/api/pagos/[id]/route.ts
// Editar y eliminar pago por ID — recalcula distribuciones usando helper compartido

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'
import { regenerarDistribucionesVenta } from '@/src/lib/distribuciones'

async function recalcEstadoVenta(ventaId: string) {
  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { pagos: true },
  })
  if (!venta || venta.estado === 'cancelado') return
  const totalPagado = venta.pagos.reduce((s, p) => s + p.monto, 0)
  const nuevoEstado = totalPagado >= venta.precioTotal ? 'completado' : 'activo'
  await prisma.venta.update({ where: { id: ventaId }, data: { estado: nuevoEstado } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  try {
    const body = await request.json()
    const { monto, tipoPago, notas, fecha } = body

    const pago = await prisma.pago.update({
      where: { id },
      data: {
        ...(monto    !== undefined && { monto: parseFloat(monto) }),
        ...(tipoPago !== undefined && { tipoPago }),
        ...(notas    !== undefined && { notas: notas?.trim() || null }),
        ...(fecha    !== undefined && { fecha: new Date(fecha) }),
      },
    })

    await recalcEstadoVenta(pago.ventaId)

    // Si cambió el monto, regenerar distribuciones
    if (monto !== undefined) {
      await regenerarDistribucionesVenta(id)
    }

    return NextResponse.json(pago)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar pago' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  try {
    const pago = await prisma.pago.findUnique({ where: { id } })
    if (!pago) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await prisma.distribucion.deleteMany({ where: { pagoId: id } })
    await prisma.pago.delete({ where: { id } })
    await recalcEstadoVenta(pago.ventaId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 })
  }
}