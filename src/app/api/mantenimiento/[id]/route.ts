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
    const {
      descripcion, montoMensual, costoDesarrollador,
      desarrolladorNombre, clienteId, fechaInicio, notas, activo,
    } = body

    const m = await prisma.mantenimiento.update({
      where: { id },
      data: {
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(montoMensual !== undefined && { montoMensual: parseFloat(montoMensual) }),
        ...(costoDesarrollador !== undefined && { costoDesarrollador: parseFloat(costoDesarrollador) }),
        ...(desarrolladorNombre !== undefined && { desarrolladorNombre: desarrolladorNombre?.trim() || null }),
        ...(clienteId !== undefined && { clienteId: clienteId || null }),
        ...(fechaInicio !== undefined && { fechaInicio: new Date(fechaInicio) }),
        ...(notas !== undefined && { notas: notas?.trim() || null }),
        ...(activo !== undefined && { activo }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        cobros: { orderBy: { fecha: 'desc' } },
      },
    })

    return NextResponse.json(m)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar mantenimiento' }, { status: 500 })
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
    await prisma.mantenimiento.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar mantenimiento' }, { status: 500 })
  }
}
