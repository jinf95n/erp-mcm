import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const original = await prisma.cotizacion.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: 'asc' } } },
    })

    if (!original) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const nueva = await prisma.$transaction(async tx => {
      const count  = await tx.cotizacion.count()
      const numero = `COT-${String(count + 1).padStart(3, '0')}`

      return tx.cotizacion.create({
        data: {
          numero,
          nombre:          `${original.nombre} (copia)`,
          clienteId:       original.clienteId,
          moneda:          original.moneda,
          tipoCambio:      original.tipoCambio,
          validezDias:     original.validezDias,
          condicionesPago: original.condicionesPago,
          notasInternas:   original.notasInternas,
          notasCliente:    original.notasCliente,
          descuentoGlobal: original.descuentoGlobal,
          estado:          'borrador',
          items: {
            create: original.items.map(item => ({
              descripcion:   item.descripcion,
              tipoServicio:  item.tipoServicio,
              roles:         item.roles,
              modoMargen:    item.modoMargen,
              margen:        item.margen,
              descuento:     item.descuento,
              tipoInversion: item.tipoInversion,
              orden:         item.orden,
            })),
          },
        },
        include: {
          cliente: { select: { id: true, nombre: true, empresa: true } },
          items:   { orderBy: { orden: 'asc' } },
        },
      })
    })

    return NextResponse.json(nueva, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al duplicar' }, { status: 500 })
  }
}