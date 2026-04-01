import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')

    const cotizaciones = await prisma.cotizacion.findMany({
      where: estado ? { estado } : {},
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        items: { orderBy: { orden: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ cotizaciones })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener cotizaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      nombre, clienteId, moneda, tipoCambio, validezDias,
      condicionesPago, notasInternas, notasCliente,
      descuentoGlobal, estado, items,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Número con transacción para evitar duplicados
    const cotizacion = await prisma.$transaction(async tx => {
      const count = await tx.cotizacion.count()
      const numero = `COT-${String(count + 1).padStart(3, '0')}`

      return tx.cotizacion.create({
        data: {
          numero,
          nombre:          nombre.trim(),
          clienteId:       clienteId || null,
          moneda:          moneda || 'usd',
          tipoCambio:      parseFloat(tipoCambio)      || 1300,
          validezDias:     parseInt(validezDias)        || 15,
          condicionesPago: condicionesPago?.trim()      || null,
          notasInternas:   notasInternas?.trim()        || null,
          notasCliente:    notasCliente?.trim()         || null,
          descuentoGlobal: parseFloat(descuentoGlobal) || 0,
          estado:          estado || 'borrador',
          items: {
            create: (items || []).map((item: Record<string, unknown>, i: number) => ({
              descripcion:   (item.descripcion as string)?.trim() || 'Servicio',
              tipoServicio:  (item.tipoServicio as string)  || 'otro',
              roles:         typeof item.roles === 'string' ? item.roles : JSON.stringify(item.roles || []),
              modoMargen:    (item.modoMargen as string)   || 'markup',
              margen:        parseFloat(item.margen as string)   || 0.35,
              descuento:     parseFloat(item.descuento as string)|| 0,
              tipoInversion: (item.tipoInversion as string) || 'unica_vez',
              orden:         parseInt(item.orden as string)  ?? i,
            })),
          },
        },
        include: {
          cliente: { select: { id: true, nombre: true, empresa: true } },
          items:   { orderBy: { orden: 'asc' } },
        },
      })
    })

    return NextResponse.json(cotizacion, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear cotización' }, { status: 500 })
  }
}