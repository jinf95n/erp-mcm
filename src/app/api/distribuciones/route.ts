// src/app/api/distribuciones/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const ventaId = searchParams.get('ventaId')
    const estado  = searchParams.get('estado')

    const where: Record<string, unknown> = {}
    if (ventaId) where.ventaId = ventaId
    if (estado)  where.estado  = estado

    const distribuciones = await prisma.distribucion.findMany({
      where,
      include: {
        persona: { select: { id: true, nombre: true, rol: true } },
        venta:   { select: { id: true, nombreProyecto: true } },
        pago:    { select: { id: true, monto: true, fecha: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalPendiente = distribuciones
      .filter(d => d.estado === 'pendiente')
      .reduce((s, d) => s + d.monto, 0)
    const totalPagado = distribuciones
      .filter(d => d.estado === 'pagado')
      .reduce((s, d) => s + d.monto, 0)

    return NextResponse.json({ distribuciones, totalPendiente, totalPagado })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener distribuciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { descripcion, monto, tipo, ventaId, personaId, personaNombre, notas, estado, fechaPago } = body

    if (!descripcion?.trim()) return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
    if (!monto) return NextResponse.json({ error: 'Monto requerido' }, { status: 400 })

    const distribucion = await prisma.distribucion.create({
      data: {
        descripcion: descripcion.trim(),
        monto: parseFloat(monto),
        tipo: tipo || 'costo',
        estado: estado || 'pendiente',
        ventaId: ventaId || null,
        personaId: personaId || null,
        personaNombre: personaNombre?.trim() || null,
        notas: notas?.trim() || null,
        fechaPago: fechaPago ? new Date(fechaPago) : null,
      },
      include: {
        persona: { select: { id: true, nombre: true } },
        venta:   { select: { id: true, nombreProyecto: true } },
      },
    })
    return NextResponse.json(distribucion, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear distribución' }, { status: 500 })
  }
}