import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const soloActivos = searchParams.get('activo') !== 'false'

    const where = soloActivos ? { activo: true } : {}

    const mantenimientos = await prisma.mantenimiento.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        cobros: { orderBy: { fecha: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalMensual = mantenimientos
      .filter(m => m.activo)
      .reduce((s, m) => s + m.montoMensual, 0)

    return NextResponse.json({ mantenimientos, totalMensual })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener mantenimientos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      descripcion, montoMensual, costoDesarrollador,
      desarrolladorNombre, clienteId, fechaInicio, notas,
    } = body

    if (!descripcion?.trim()) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    if (!montoMensual || isNaN(parseFloat(montoMensual))) return NextResponse.json({ error: 'El monto mensual es requerido' }, { status: 400 })

    const m = await prisma.mantenimiento.create({
      data: {
        descripcion: descripcion.trim(),
        montoMensual: parseFloat(montoMensual),
        costoDesarrollador: parseFloat(costoDesarrollador || 0),
        desarrolladorNombre: desarrolladorNombre?.trim() || null,
        clienteId: clienteId || null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
        notas: notas?.trim() || null,
        activo: true,
      },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        cobros: true,
      },
    })

    return NextResponse.json(m, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear mantenimiento' }, { status: 500 })
  }
}