// src/app/api/ventas/[id]/route.ts
// PUT: al editar costos regenera distribuciones de todos los pagos existentes

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'
import { generarDistribucionesVenta } from '@/src/lib/distribuciones'

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
          data: costos.map((c: {
            descripcion:    string
            monto:          string | number
            personaNombre?: string
            personaId?:     string
          }) => ({
            ventaId:       id,
            descripcion:   c.descripcion?.trim() || 'Costo',
            monto:         parseFloat(String(c.monto)) || 0,
            personaNombre: c.personaNombre?.trim() || null,
            personaId:     c.personaId || null,
          })),
        })
      }

      // Regenerar distribuciones de todos los pagos existentes con los costos nuevos
      // 1. Eliminar todas las distribuciones de esta venta
      await prisma.distribucion.deleteMany({ where: { ventaId: id } })

      // 2. Obtener los costos recién creados y los pagos
      const [costosNuevos, pagosVenta] = await Promise.all([
        prisma.costoVenta.findMany({ where: { ventaId: id }, orderBy: { createdAt: 'asc' } }),
        prisma.pago.findMany({ where: { ventaId: id }, orderBy: { fecha: 'asc' } }),
      ])

      // 3. Recrear distribuciones pago a pago en orden cronológico
      //    Cada pago cubre la parte del waterfall que le corresponde
      for (const pago of pagosVenta) {
        if (costosNuevos.length > 0) {
          await generarDistribucionesVenta(id, pago.id, pago.monto, costosNuevos)
        }
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