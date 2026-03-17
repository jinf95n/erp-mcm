// src/app/api/cobros/route.ts
// Fix #7: al registrar cobro de mantenimiento se generan distribuciones para dev y socios

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

async function generarDistribucionesMantenimiento(
  cobroId: string,
  mantenimientoId: string,
  montoTotal: number
) {
  const mantenimiento = await prisma.mantenimiento.findUnique({
    where: { id: mantenimientoId },
  })
  if (!mantenimiento) return

  const socios = await prisma.persona.findMany({ where: { rol: 'socio', activo: true } })
  const sociosNombres = socios.length > 0 ? socios.map(s => s.nombre) : ['Juan', 'Carlos']

  const costoDev   = mantenimiento.costoDesarrollador || 0
  const gananciaAg = montoTotal - costoDev

  const data: Array<{
    descripcion: string
    monto: number
    tipo: string
    estado: string
    personaId: string | null
    personaNombre: string | null
    notas: string
  }> = []

  // Costo del desarrollador
  if (costoDev > 0) {
    const devNombre  = mantenimiento.desarrolladorNombre || 'Juan'
    const devPersona = await prisma.persona.findFirst({
      where: { nombre: devNombre, activo: true },
    })
    data.push({
      descripcion:   `Dev — ${mantenimiento.descripcion}`,
      monto:         costoDev,
      tipo:          'costo',
      estado:        'pendiente',
      personaId:     devPersona?.id || null,
      personaNombre: devNombre,
      notas:         `cobro:${cobroId}`,
    })
  }

  // Ganancia de agencia dividida entre socios
  if (gananciaAg > 0.01) {
    const montoPorSocio = Math.round((gananciaAg / sociosNombres.length) * 100) / 100
    for (const nombre of sociosNombres) {
      const persona = socios.find(s => s.nombre === nombre)
      data.push({
        descripcion:   `Ganancia mant. — ${mantenimiento.descripcion}`,
        monto:         montoPorSocio,
        tipo:          'ganancia',
        estado:        'pendiente',
        personaId:     persona?.id || null,
        personaNombre: nombre,
        notas:         `cobro:${cobroId}`,
      })
    }
  }

  if (data.length > 0) {
    await prisma.distribucion.createMany({ data })
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { mantenimientoId, monto, fecha, notas } = body

    if (!mantenimientoId) {
      return NextResponse.json({ error: 'mantenimientoId requerido' }, { status: 400 })
    }

    const mantenimiento = await prisma.mantenimiento.findUnique({ where: { id: mantenimientoId } })
    if (!mantenimiento) {
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })
    }

    const montoFinal = parseFloat(monto || mantenimiento.montoMensual)

    const cobro = await prisma.cobroMantenimiento.create({
      data: {
        mantenimientoId,
        monto: montoFinal,
        fecha: fecha ? new Date(fecha) : new Date(),
        notas: notas?.trim() || null,
      },
    })

    // Generar distribuciones para dev y socios
    await generarDistribucionesMantenimiento(cobro.id, mantenimientoId, montoFinal)

    return NextResponse.json(cobro, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar cobro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // Eliminar distribuciones asociadas por nota
    await prisma.distribucion.deleteMany({
      where: { notas: { contains: id } },
    })
    await prisma.cobroMantenimiento.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar cobro' }, { status: 500 })
  }
}