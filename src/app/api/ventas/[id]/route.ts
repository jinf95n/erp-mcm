// src/app/api/ventas/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const venta = await prisma.venta.findUnique({
    where: { id },
    include: {
      cliente: true,
      pagos:   { orderBy: { fecha: 'asc' } },
      costos:  true,
    },
  })

  if (!venta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({
    ...venta,
    totalPagado: venta.pagos.reduce((s, p) => s + p.monto, 0),
    totalCostos: venta.costos.reduce((s, c) => s + c.monto, 0),
  })
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
    const { estado, nombreProyecto, tipoServicio, costos } = body

    // Si vienen costos nuevos, reemplazar todos los existentes
    if (costos !== undefined) {
      await prisma.costoVenta.deleteMany({ where: { ventaId: id } })
      if (costos.length > 0) {
        await prisma.costoVenta.createMany({
          data: costos.map((c: { descripcion: string; monto: string | number; personaNombre?: string }) => ({
            ventaId:       id,
            descripcion:   c.descripcion?.trim() || 'Costo',
            monto:         parseFloat(String(c.monto)) || 0,
            personaNombre: c.personaNombre?.trim() || null,
          })),
        })
      }
    }

    const venta = await prisma.venta.update({
      where: { id },
      data: {
        ...(estado         !== undefined && { estado }),
        ...(nombreProyecto !== undefined && { nombreProyecto }),
        ...(tipoServicio   !== undefined && { tipoServicio }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        pagos:   true,
        costos:  true,
      },
    })

    return NextResponse.json({
      ...venta,
      totalPagado: venta.pagos.reduce((s, p) => s + p.monto, 0),
      totalCostos: venta.costos.reduce((s, c) => s + c.monto, 0),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
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
    const pagosCount = await prisma.pago.count({ where: { ventaId: id } })

    if (pagosCount > 0) {
      await prisma.venta.update({
        where: { id },
        data: { deletedAt: new Date(), estado: 'cancelado' },
      })
      return NextResponse.json({ ok: true, archived: true })
    }

    // Sin pagos: eliminar todo (costos en cascada)
    await prisma.venta.delete({ where: { id } })
    return NextResponse.json({ ok: true, archived: false })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}