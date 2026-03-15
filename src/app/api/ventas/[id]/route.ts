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
      pagos: { orderBy: { fecha: 'asc' } },
    },
  })

  if (!venta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(venta)
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
    const { estado, nombreProyecto, tipoServicio, costoDesarrollador, costoPM, comisionVendedor } = body

    const venta = await prisma.venta.update({
      where: { id },
      data: {
        ...(estado !== undefined && { estado }),
        ...(nombreProyecto !== undefined && { nombreProyecto }),
        ...(tipoServicio !== undefined && { tipoServicio }),
        ...(costoDesarrollador !== undefined && { costoDesarrollador: parseFloat(costoDesarrollador) }),
        ...(costoPM !== undefined && { costoPM: parseFloat(costoPM) }),
        ...(comisionVendedor !== undefined && { comisionVendedor: parseFloat(comisionVendedor) }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        pagos: true,
      },
    })

    return NextResponse.json(venta)
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
    await prisma.pago.deleteMany({ where: { ventaId: id } })
    await prisma.venta.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}