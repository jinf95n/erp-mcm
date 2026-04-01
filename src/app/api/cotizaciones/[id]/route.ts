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
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true } },
      items:   { orderBy: { orden: 'asc' } },
    },
  })

  if (!cotizacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(cotizacion)
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
    const {
      nombre, clienteId, moneda, tipoCambio, validezDias,
      condicionesPago, notasInternas, notasCliente,
      descuentoGlobal, estado, items,
    } = body

    // Si vienen items, reemplazar todos
    if (items !== undefined) {
      await prisma.itemCotizacion.deleteMany({ where: { cotizacionId: id } })
      if (items.length > 0) {
        await prisma.itemCotizacion.createMany({
          data: items.map((item: Record<string, unknown>, i: number) => ({
            cotizacionId:  id,
            descripcion:   (item.descripcion as string)?.trim() || 'Servicio',
            tipoServicio:  (item.tipoServicio as string)  || 'otro',
            roles:         typeof item.roles === 'string' ? item.roles : JSON.stringify(item.roles || []),
            modoMargen:    (item.modoMargen as string)   || 'markup',
            margen:        parseFloat(item.margen as string)   || 0.35,
            descuento:     parseFloat(item.descuento as string)|| 0,
            tipoInversion: (item.tipoInversion as string) || 'unica_vez',
            orden:         parseInt(item.orden as string)  ?? i,
          })),
        })
      }
    }

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: {
        ...(nombre          !== undefined && { nombre: nombre.trim() }),
        ...(clienteId       !== undefined && { clienteId: clienteId || null }),
        ...(moneda          !== undefined && { moneda }),
        ...(tipoCambio      !== undefined && { tipoCambio: parseFloat(tipoCambio) }),
        ...(validezDias     !== undefined && { validezDias: parseInt(validezDias) }),
        ...(condicionesPago !== undefined && { condicionesPago: condicionesPago?.trim() || null }),
        ...(notasInternas   !== undefined && { notasInternas:   notasInternas?.trim()   || null }),
        ...(notasCliente    !== undefined && { notasCliente:    notasCliente?.trim()    || null }),
        ...(descuentoGlobal !== undefined && { descuentoGlobal: parseFloat(descuentoGlobal) }),
        ...(estado          !== undefined && { estado }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        items:   { orderBy: { orden: 'asc' } },
      },
    })

    return NextResponse.json(cotizacion)
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
    await prisma.cotizacion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}