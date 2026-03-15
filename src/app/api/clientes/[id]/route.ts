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
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { ventas: { include: { pagos: true }, orderBy: { createdAt: 'desc' } } },
  })

  if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(cliente)
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
    const { nombre, empresa, email, telefono, sitioWeb, vendedor, notas, activo } = body

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(empresa !== undefined && { empresa }),
        ...(email !== undefined && { email }),
        ...(telefono !== undefined && { telefono }),
        ...(sitioWeb !== undefined && { sitioWeb }),
        ...(vendedor !== undefined && { vendedor }),
        ...(notas !== undefined && { notas }),
        ...(activo !== undefined && { activo }),
      },
    })

    return NextResponse.json(cliente)
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
    const ventas = await prisma.venta.findMany({ where: { clienteId: id }, select: { id: true } })
    for (const v of ventas) {
      await prisma.pago.deleteMany({ where: { ventaId: v.id } })
    }
    await prisma.venta.deleteMany({ where: { clienteId: id } })
    await prisma.cliente.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}