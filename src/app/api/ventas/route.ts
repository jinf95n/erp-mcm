// src/app/api/ventas/route.ts
// Fix #2: pago inicial genera distribuciones waterfall al crear la venta

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'
import { generarDistribucionesVenta } from '@/src/lib/distribuciones'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const estado    = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')

    const where: Record<string, unknown> = { deletedAt: null }
    if (estado)    where.estado    = estado
    if (clienteId) where.clienteId = clienteId

    const [ventas, total] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, empresa: true } },
          pagos:   true,
          costos:  true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.venta.count({ where }),
    ])

    const ventasConTotales = ventas.map(v => ({
      ...v,
      totalPagado:  v.pagos.reduce((s, p) => s + p.monto, 0),
      totalCostos:  v.costos.reduce((s, c) => s + c.monto, 0),
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
      clienteId, nombreProyecto, tipoServicio,
      precioTotal, pagoInicial, cantidadCuotas, valorCuota,
      costos, // array: [{ descripcion, monto, personaNombre }]
    } = body

    if (!clienteId || !nombreProyecto || !precioTotal) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const costosData = (costos || []).map((c: {
      descripcion: string
      monto: string | number
      personaNombre?: string
      personaId?: string
    }) => ({
      descripcion:   c.descripcion?.trim() || 'Costo',
      monto:         parseFloat(String(c.monto)) || 0,
      personaNombre: c.personaNombre?.trim() || null,
      personaId:     c.personaId || null,
    }))

    const pagoInicialNum = parseFloat(pagoInicial || 0)

    // Crear venta sin pago anidado para poder generar distribuciones con ID real
    const venta = await prisma.venta.create({
      data: {
        clienteId,
        nombreProyecto,
        tipoServicio:   tipoServicio || 'otro',
        precioTotal:    parseFloat(precioTotal),
        pagoInicial:    pagoInicialNum,
        cantidadCuotas: parseInt(cantidadCuotas || 0),
        valorCuota:     parseFloat(valorCuota    || 0),
        estado: 'activo',
        costos: { create: costosData },
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        costos:  true,
      },
    })

    // Crear pago inicial separado y generar distribuciones
    if (pagoInicialNum > 0) {
      const pago = await prisma.pago.create({
        data: {
          ventaId:  venta.id,
          monto:    pagoInicialNum,
          tipoPago: 'inicial',
          notas:    'Pago inicial',
        },
      })

      await generarDistribucionesVenta(
        venta.id,
        pago.id,
        pagoInicialNum,
        venta.costos
      )

      if (pagoInicialNum >= parseFloat(precioTotal)) {
        await prisma.venta.update({ where: { id: venta.id }, data: { estado: 'completado' } })
      }
    }

    const ventaFinal = await prisma.venta.findUnique({
      where: { id: venta.id },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        pagos:   true,
        costos:  true,
      },
    })

    return NextResponse.json({
      ...ventaFinal,
      totalPagado: ventaFinal?.pagos.reduce((s, p) => s + p.monto, 0) ?? 0,
      totalCostos: ventaFinal?.costos.reduce((s, c) => s + c.monto, 0) ?? 0,
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear venta' }, { status: 500 })
  }
}