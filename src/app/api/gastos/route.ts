import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') // formato: "2026-03"

    const where: Record<string, unknown> = {}
    if (mes) {
      const [year, month] = mes.split('-').map(Number)
      where.fecha = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      }
    }

    const gastos = await prisma.gasto.findMany({
      where,
      orderBy: { fecha: 'desc' },
    })

    const total = gastos.reduce((s, g) => s + g.monto, 0)
    return NextResponse.json({ gastos, total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { descripcion, monto, categoria, fecha, recurrente, notas } = body

    if (!descripcion?.trim()) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    if (!monto || isNaN(parseFloat(monto))) return NextResponse.json({ error: 'El monto es requerido' }, { status: 400 })

    const gasto = await prisma.gasto.create({
      data: {
        descripcion: descripcion.trim(),
        monto: parseFloat(monto),
        categoria: categoria || 'herramienta',
        fecha: fecha ? new Date(fecha) : new Date(),
        recurrente: Boolean(recurrente),
        notas: notas?.trim() || null,
      },
    })

    return NextResponse.json(gasto, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear gasto' }, { status: 500 })
  }
}