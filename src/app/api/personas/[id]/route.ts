// src/app/api/personas/[id]/route.ts

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
  const persona = await prisma.persona.findUnique({ where: { id } })
  if (!persona) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(persona)
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
    const { nombre, rol, tipoCompensacion, monto, email, telefono, notas, activo } = body
    const persona = await prisma.persona.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(rol !== undefined && { rol }),
        ...(tipoCompensacion !== undefined && { tipoCompensacion }),
        ...(monto !== undefined && { monto: parseFloat(monto) }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
        ...(notas !== undefined && { notas: notas?.trim() || null }),
        ...(activo !== undefined && { activo }),
      },
    })
    return NextResponse.json(persona)
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
    await prisma.persona.update({ where: { id }, data: { activo: false } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al desactivar persona' }, { status: 500 })
  }
}