// src/lib/waterfall.ts
// Función compartida para cálculo waterfall (cubre costos en orden con lo cobrado)

export function calcWaterfall(
  totalPagado: number,
  costos: { monto: number }[]
) {
  let restante = totalPagado
  const cobrado = costos.map(c => {
    const cubierto = Math.min(restante, c.monto)
    restante -= cubierto
    return cubierto
  })
  return { cobrado, ganancia: restante }
}