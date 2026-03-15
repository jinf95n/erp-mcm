// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const now = new Date();
    const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Obtener todas las ventas
    const ventas = await prisma.venta.findMany({
      include: {
        pagos: true,
        cliente: true,
      },
    });

    // Pagos del mes actual
    const pagosDelMes = await prisma.pago.findMany({
      where: {
        fecha: {
          gte: primerDiaMes,
          lte: ultimoDiaMes,
        },
      },
    });

    // Todos los pagos
    const todosPagos = await prisma.pago.findMany();

    // Calcular ingresos del mes
    const ingresosDelMes = pagosDelMes.reduce((sum, pago) => sum + pago.monto, 0);

    // Calcular ingresos totales
    const ingresosTotales = todosPagos.reduce((sum, pago) => sum + pago.monto, 0);

    // Calcular total a pagar a devs, PMs y vendedores
    let totalDesarrolladores = 0;
    let totalPMs = 0;
    let totalComisiones = 0;
    let gananciaAgencia = 0;

    ventas.forEach((venta) => {
      const totalPagado = venta.pagos.reduce((sum, pago) => sum + pago.monto, 0);
      const porcentajePagado = totalPagado / venta.precioTotal;

      // Calcular proporcionalmente según lo pagado
      totalDesarrolladores += venta.costoDesarrollador * porcentajePagado;
      totalPMs += venta.costoPM * porcentajePagado;
      totalComisiones += venta.comisionVendedor * porcentajePagado;
    });

    // Ganancia = ingresos - (devs + PMs + comisiones)
    gananciaAgencia = ingresosTotales - (totalDesarrolladores + totalPMs + totalComisiones);

    // Calcular pagos pendientes
    const pagosPendientes = ventas.reduce((sum, venta) => {
      const totalPagado = venta.pagos.reduce((sumPagos, pago) => sumPagos + pago.monto, 0);
      return sum + (venta.precioTotal - totalPagado);
    }, 0);

    // Proyectos activos
    const proyectosActivos = ventas.filter((v) => v.estado === 'activo').length;

    // Clientes activos
    const clientesActivos = await prisma.cliente.count({
      where: { activo: true },
    });

    // Ingresos por mes (últimos 6 meses)
    const ingresosPorMes = [];
    for (let i = 5; i >= 0; i--) {
      const mesDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesSiguiente = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const pagosDelPeriodo = todosPagos.filter((pago) => {
        const fechaPago = new Date(pago.fecha);
        return fechaPago >= mesDate && fechaPago <= mesSiguiente;
      });

      const totalMes = pagosDelPeriodo.reduce((sum, pago) => sum + pago.monto, 0);

      ingresosPorMes.push({
        mes: mesDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
        ingresos: totalMes,
      });
    }

    return NextResponse.json({
      ingresosDelMes,
      ingresosTotales,
      pagosPendientes,
      gananciaAgencia,
      totalDesarrolladores,
      totalPMs,
      totalComisiones,
      proyectosActivos,
      clientesActivos,
      ingresosPorMes,
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    return NextResponse.json(
      { error: 'Error al cargar métricas' },
      { status: 500 }
    );
  }
}
