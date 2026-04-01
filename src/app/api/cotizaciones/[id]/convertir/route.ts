import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getSession } from '@/src/lib/auth-api'

interface Rol { personaNombre: string; tarifaHora: number; horas: number }

function calcCosto(rolesJson: string): number {
  const roles: Rol[] = JSON.parse(rolesJson || '[]')
  return roles.reduce((s, r) => s + r.tarifaHora * r.horas, 0)
}

function calcPrecio(costo: number, margen: number, modoMargen: string): number {
  if (modoMargen === 'markup') return costo * (1 + margen)
  return margen < 1 ? costo / (1 - margen) : costo
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        items:   { orderBy: { orden: 'asc' } },
        cliente: { select: { id: true, nombre: true } },
      },
    })

    if (!cot) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (!cot.clienteId) return NextResponse.json({ error: 'La cotización necesita un cliente para convertirse en venta' }, { status: 400 })

    // Calcular total (aplica descuento por ítem y descuento global)
    let precioTotal = 0
    const costosData: { descripcion: string; monto: number; personaNombre: string | null; personaId: string | null }[] = []

    for (const item of cot.items) {
      const costo        = calcCosto(item.roles)
      const precio       = calcPrecio(costo, item.margen, item.modoMargen)
      const precioConDesc = precio * (1 - item.descuento)
      precioTotal += precioConDesc

      // Primer rol como responsable del costo
      const roles: Rol[] = JSON.parse(item.roles || '[]')
      const primerRol = roles[0]

      // Buscar persona por nombre
      const persona = primerRol
        ? await prisma.persona.findFirst({ where: { nombre: primerRol.personaNombre, activo: true } })
        : null

      costosData.push({
        descripcion:   item.descripcion,
        monto:         Math.round(costo * cot.tipoCambio * 100) / 100, // Costo en ARS
        personaNombre: primerRol?.personaNombre || null,
        personaId:     persona?.id || null,
      })
    }

    // Aplicar descuento global al precio total
    precioTotal = precioTotal * (1 - cot.descuentoGlobal)
    // Convertir a ARS
    const precioTotalARS = Math.round(precioTotal * cot.tipoCambio)

    // Detectar tipo de servicio predominante
    const tipos = cot.items.map(i => i.tipoServicio)
    const tiposPorFrecuencia: Record<string, number> = {}
    tipos.forEach(t => { tiposPorFrecuencia[t] = (tiposPorFrecuencia[t] || 0) + 1 })
    const tipoServicio = Object.entries(tiposPorFrecuencia).sort((a, b) => b[1] - a[1])[0]?.[0] || 'otro'

    const venta = await prisma.venta.create({
      data: {
        clienteId:      cot.clienteId,
        nombreProyecto: cot.nombre,
        tipoServicio,
        precioTotal:    precioTotalARS,
        pagoInicial:    0,
        cantidadCuotas: 0,
        valorCuota:     0,
        estado:         'activo',
        costos: { create: costosData },
      },
      include: {
        cliente: { select: { nombre: true } },
        costos:  true,
      },
    })

    // Marcar cotizacion como aceptada (si no lo estaba ya)
    await prisma.cotizacion.update({
      where: { id },
      data:  { estado: 'aceptada' },
    })

    return NextResponse.json({ venta, ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al convertir' }, { status: 500 })
  }
}