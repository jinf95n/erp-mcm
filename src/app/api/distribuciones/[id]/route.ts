// src/app/api/distribuciones/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  try {
    const body = await request.json()
    const { estado, fechaPago, notas, monto, descripcion, personaId, personaNombre } = body
    const distribucion = await prisma.distribucion.update({
      where: { id },
      data: {
        ...(estado        !== undefined && { estado }),
        ...(fechaPago     !== undefined && { fechaPago: fechaPago ? new Date(fechaPago) : null }),
        ...(notas         !== undefined && { notas: notas?.trim() || null }),
        ...(monto         !== undefined && { monto: parseFloat(monto) }),
        ...(descripcion   !== undefined && { descripcion: descripcion.trim() }),
        ...(personaId     !== undefined && { personaId: personaId || null }),
        ...(personaNombre !== undefined && { personaNombre: personaNombre?.trim() || null }),
      },
    })
    return NextResponse.json(distribucion)
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
    await prisma.distribucion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}