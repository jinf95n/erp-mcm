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
    const { descripcion, monto, categoria, fecha, recurrente, notas } = body

    const gasto = await prisma.gasto.update({
      where: { id },
      data: {
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(monto !== undefined && { monto: parseFloat(monto) }),
        ...(categoria !== undefined && { categoria }),
        ...(fecha !== undefined && { fecha: new Date(fecha) }),
        ...(recurrente !== undefined && { recurrente: Boolean(recurrente) }),
        ...(notas !== undefined && { notas: notas?.trim() || null }),
      },
    })

    return NextResponse.json(gasto)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 })
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
    await prisma.gasto.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 })
  }
}
