// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear usuario admin
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

  // Crear usuario socio
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

  // Crear cliente de ejemplo
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Juan Pérez',
      empresa: 'Empresa Demo SRL',
      email: 'juan@empresademo.com',
      telefono: '+54 9 11 1234-5678',
      sitioWeb: 'https://empresademo.com',
      vendedor: 'María González',
      notas: 'Cliente de prueba para demo del sistema',
    },
  });

  console.log('✅ Cliente de ejemplo creado:', cliente.nombre);

  // Crear venta de ejemplo
  const venta = await prisma.venta.create({
    data: {
      nombreProyecto: 'Sitio Web Corporativo',
      tipoServicio: 'web',
      precioTotal: 500000,
      pagoInicial: 150000,
      cantidadCuotas: 3,
      valorCuota: 116666.67,
      costoDesarrollador: 195000,
      costoPM: 70000,
      comisionVendedor: 200000,
      estado: 'activo',
      clienteId: cliente.id,
    },
  });

  console.log('✅ Venta de ejemplo creada:', venta.nombreProyecto);

  // Crear pago inicial
  const pago = await prisma.pago.create({
    data: {
      monto: 150000,
      tipoPago: 'inicial',
      ventaId: venta.id,
      notas: 'Pago inicial del proyecto',
    },
  });

  console.log('✅ Pago de ejemplo creado: $', pago.monto);

  console.log('\n🎉 Seed completado!');
  console.log('\n📧 Credenciales de acceso:');
  console.log('   Admin: admin@agencia.com / admin123');
  console.log('   Socio: socio@agencia.com / socio123\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
