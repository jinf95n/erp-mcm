import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')

    const where: Record<string, unknown> = {}
    if (estado) where.estado = estado
    if (clienteId) where.clienteId = clienteId

    const [ventas, total] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, empresa: true } },
          pagos: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.venta.count({ where }),
    ])

    const ventasConTotales = ventas.map(v => ({
      ...v,
      totalPagado: v.pagos.reduce((s, p) => s + p.monto, 0),
    }))

    return NextResponse.json({ ventas: ventasConTotales, total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      clienteId,
      nombreProyecto,
      tipoServicio,
      precioTotal,
      pagoInicial,
      cantidadCuotas,
      valorCuota,
      costoDesarrollador,
      costoPM,
      comisionVendedor,
    } = body

    if (!clienteId || !nombreProyecto || !precioTotal) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const venta = await prisma.venta.create({
      data: {
        clienteId,
        nombreProyecto,
        tipoServicio: tipoServicio || 'otro',
        precioTotal: parseFloat(precioTotal),
        pagoInicial: parseFloat(pagoInicial || 0),
        cantidadCuotas: parseInt(cantidadCuotas || 0),
        valorCuota: parseFloat(valorCuota || 0),
        costoDesarrollador: parseFloat(costoDesarrollador || 0),
        costoPM: parseFloat(costoPM || 0),
        comisionVendedor: parseFloat(comisionVendedor || 0),
        estado: 'activo',
        // Crear pago inicial automáticamente si hay
        ...(parseFloat(pagoInicial) > 0 && {
          pagos: {
            create: {
              monto: parseFloat(pagoInicial),
              tipoPago: 'inicial',
              notas: 'Pago inicial',
            },
          },
        }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        pagos: true,
      },
    })

    return NextResponse.json(venta, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear venta' }, { status: 500 })
  }
}