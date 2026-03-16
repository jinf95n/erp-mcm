// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@agencia.com' },
    update: {},
    create: {
      email: 'admin@agencia.com',
      password: hashedPassword,
      nombre: 'Admin',
      rol: 'admin',
    },
  });
  console.log('✅ Usuario admin creado:', admin.email);

  const hashedPassword2 = await bcrypt.hash('socio123', 10);
  const socio = await prisma.usuario.upsert({
    where: { email: 'socio@agencia.com' },
    update: {},
    create: {
      email: 'socio@agencia.com',
      password: hashedPassword2,
      nombre: 'Socio',
      rol: 'socio',
    },
  });
  console.log('✅ Usuario socio creado:', socio.email);

  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Juan Pérez',
      empresa: 'Empresa Demo SRL',
      email: 'juan@empresademo.com',
      telefono: '+54 9 11 1234-5678',
      sitioWeb: 'https://empresademo.com',
      vendedor: 'Carlos',
      notas: 'Cliente de prueba para demo del sistema',
    },
  });
  console.log('✅ Cliente de ejemplo creado:', cliente.nombre);

  const venta = await prisma.venta.create({
    data: {
      nombreProyecto: 'Sitio Web Corporativo',
      tipoServicio: 'web',
      precioTotal: 500000,
      pagoInicial: 150000,
      cantidadCuotas: 3,
      valorCuota: 116666.67,
      estado: 'activo',
      clienteId: cliente.id,
      costos: {
        create: [
          { descripcion: 'Desarrollo', monto: 78000, personaNombre: 'Juan' },
          { descripcion: 'PM', monto: 28000, personaNombre: 'Carlos' },
          { descripcion: 'Comisión vendedor', monto: 100000, personaNombre: 'Carlos' },
        ],
      },
      pagos: {
        create: {
          monto: 150000,
          tipoPago: 'inicial',
          notas: 'Pago inicial del proyecto',
        },
      },
    },
  });
  console.log('✅ Venta de ejemplo creada:', venta.nombreProyecto);

  console.log('\n🎉 Seed completado!');
  console.log('\n📧 Credenciales:');
  console.log('   admin@agencia.com / admin123');
  console.log('   socio@agencia.com / socio123\n');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
