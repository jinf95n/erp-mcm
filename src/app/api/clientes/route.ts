import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { nombre: { contains: search } },
            { empresa: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { ventas: true } } },
      }),
      prisma.cliente.count({ where }),
    ])

    return NextResponse.json({ clientes, total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { nombre, empresa, email, telefono, sitioWeb, vendedor, notas } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }
    if (!vendedor?.trim()) {
      return NextResponse.json({ error: 'El vendedor es requerido' }, { status: 400 })
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        empresa: empresa?.trim() || null,
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        sitioWeb: sitioWeb?.trim() || null,
        vendedor: vendedor.trim(),
        notas: notas?.trim() || null,
      },
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
  }
}