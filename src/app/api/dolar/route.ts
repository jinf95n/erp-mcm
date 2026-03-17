// src/app/api/dolar/route.ts
// Retorna cotización del dólar oficial argentino (dolarapi.com)

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 3600 }, // cache 1 hora
    })
    if (!res.ok) throw new Error('API no disponible')
    const data = await res.json()
    return NextResponse.json({
      compra: data.compra,
      venta: data.venta,
      promedio: +((data.compra + data.venta) / 2).toFixed(2),
      fecha: data.fechaActualizacion,
    })
  } catch {
    return NextResponse.json(
      { compra: null, venta: null, promedio: null, fecha: null, error: 'No disponible' },
      { status: 200 }
    )
  }
}