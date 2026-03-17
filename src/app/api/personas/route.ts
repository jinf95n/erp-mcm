// src/app/api/personas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const soloActivos = searchParams.get('activo') !== 'false'
    const personas = await prisma.persona.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ personas })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener personas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { nombre, rol, tipoCompensacion, monto, email, telefono, notas } = body

    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const persona = await prisma.persona.create({
      data: {
        nombre: nombre.trim(),
        rol: rol || 'otro',
        tipoCompensacion: tipoCompensacion || 'ars',
        monto: parseFloat(monto || 0),
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        notas: notas?.trim() || null,
      },
    })
    return NextResponse.json(persona, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear persona' }, { status: 500 })
  }
}