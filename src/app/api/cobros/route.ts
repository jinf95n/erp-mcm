// src/app/api/cobros/route.ts
// Maneja los cobros de mantenimiento

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { mantenimientoId, monto, fecha, notas } = body

    if (!mantenimientoId) return NextResponse.json({ error: 'mantenimientoId requerido' }, { status: 400 })

    const mantenimiento = await prisma.mantenimiento.findUnique({ where: { id: mantenimientoId } })
    if (!mantenimiento) return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })

    const cobro = await prisma.cobroMantenimiento.create({
      data: {
        mantenimientoId,
        monto: parseFloat(monto || mantenimiento.montoMensual),
        fecha: fecha ? new Date(fecha) : new Date(),
        notas: notas?.trim() || null,
      },
    })

    return NextResponse.json(cobro, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar cobro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await prisma.cobroMantenimiento.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar cobro' }, { status: 500 })
  }
}