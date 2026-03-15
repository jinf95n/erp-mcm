export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  sitioWeb?: string | null;
  vendedor: string;
  notas?: string | null;
  activo: boolean;
}

export interface Venta {
  id: string;
  nombreProyecto: string;
  tipoServicio: string;
  precioTotal: number;
  pagoInicial: number;
  cantidadCuotas: number;
  valorCuota: number;
  costoDesarrollador: number;
  costoPM: number;
  comisionVendedor: number;
  estado: string;
  clienteId: string;
  cliente?: Cliente;
  pagos?: Pago[];
}

export interface Pago {
  id: string;
  monto: number;
  fecha: Date | string;
  tipoPago: string;
  notas?: string | null;
  ventaId: string;
  venta?: Venta;
}

export interface DashboardMetrics {
  ingresosDelMes: number;
  ingresosTotales: number;
  pagosPendientes: number;
  gananciaAgencia: number;
  totalDesarrolladores: number;
  totalPMs: number;
  totalComisiones: number;
  proyectosActivos: number;
  clientesActivos: number;
  ingresosPorMes: { mes: string; ingresos: number }[];
}