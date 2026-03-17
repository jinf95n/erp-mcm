// prisma/seed.ts
// Fix #1: cliente con upsert — no duplica si se corre 2 veces
// Fix #8: pago inicial genera distribuciones waterfall

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ── Usuarios ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@agencia.com' },
    update: {},
    create: { email: 'admin@agencia.com', password: hashedPassword, nombre: 'Admin', rol: 'admin' },
  });

  const hashedPassword2 = await bcrypt.hash('socio123', 10);
  await prisma.usuario.upsert({
    where: { email: 'socio@agencia.com' },
    update: {},
    create: { email: 'socio@agencia.com', password: hashedPassword2, nombre: 'Socio', rol: 'socio' },
  });
  console.log('✅ Usuarios listos');

  // ── Personas ───────────────────────────────────────────────────────────────
  // Fix #1: buscar antes de crear para no duplicar
  let juan = await prisma.persona.findFirst({ where: { nombre: 'Juan' } });
  if (!juan) {
    juan = await prisma.persona.create({
      data: { nombre: 'Juan', rol: 'dev', tipoCompensacion: 'ars', monto: 78000, notas: 'Desarrollador / Socio' },
    });
  }

  let carlos = await prisma.persona.findFirst({ where: { nombre: 'Carlos' } });
  if (!carlos) {
    carlos = await prisma.persona.create({
      data: { nombre: 'Carlos', rol: 'socio', tipoCompensacion: 'porcentaje', monto: 20, notas: 'CEO / PM / Vendedor / Socio' },
    });
  }
  console.log('✅ Personas listas:', juan.nombre, carlos.nombre);

  // ── Cliente demo ───────────────────────────────────────────────────────────
  // Fix #1: buscar primero, crear solo si no existe
  let cliente = await prisma.cliente.findFirst({ where: { email: 'juan@empresademo.com' } });
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        nombre:   'Juan Pérez',
        empresa:  'Empresa Demo SRL',
        email:    'juan@empresademo.com',
        telefono: '+54 9 11 1234-5678',
        sitioWeb: 'https://empresademo.com',
        vendedor: 'Carlos',
        notas:    'Cliente de prueba para demo del sistema',
      },
    });
    console.log('✅ Cliente demo creado:', cliente.nombre);
  } else {
    console.log('ℹ️ Cliente demo ya existe, saltando...');
  }

  // ── Venta demo ─────────────────────────────────────────────────────────────
  const ventaExistente = await prisma.venta.findFirst({
    where: { clienteId: cliente.id, nombreProyecto: 'Sitio Web Corporativo' },
  });

  if (!ventaExistente) {
    const costosDef = [
      { descripcion: 'Desarrollo',        monto: 78000,  personaNombre: 'Juan',   personaId: juan.id   },
      { descripcion: 'PM',                monto: 28000,  personaNombre: 'Carlos', personaId: carlos.id },
      { descripcion: 'Comisión vendedor', monto: 100000, personaNombre: 'Carlos', personaId: carlos.id },
    ];

    // Crear venta sin pago anidado para tener el ID del pago disponible
    const venta = await prisma.venta.create({
      data: {
        nombreProyecto: 'Sitio Web Corporativo',
        tipoServicio:   'web',
        precioTotal:    500000,
        pagoInicial:    150000,
        cantidadCuotas: 3,
        valorCuota:     116666.67,
        estado:         'activo',
        clienteId:      cliente.id,
        costos: { create: costosDef },
      },
      include: { costos: true },
    });

    // Fix #8: crear pago inicial y generar distribuciones waterfall
    const pago = await prisma.pago.create({
      data: { ventaId: venta.id, monto: 150000, tipoPago: 'inicial', notas: 'Pago inicial del proyecto' },
    });

    // Waterfall: $150k cubre Desarrollo $78k + PM $28k + parte Comisión $44k → ganancia $0
    let restante = 150000;
    const distribData = [];
    for (const costo of venta.costos) {
      const cubierto = Math.min(restante, costo.monto);
      restante -= cubierto;
      if (cubierto > 0.01) {
        distribData.push({
          ventaId:       venta.id,
          pagoId:        pago.id,
          descripcion:   costo.descripcion,
          monto:         cubierto,
          tipo:          'costo',
          estado:        'pendiente',
          personaId:     costo.personaId,
          personaNombre: costo.personaNombre,
        });
      }
    }
    if (restante > 0.01) {
      for (const socio of [{ id: juan.id, nombre: 'Juan' }, { id: carlos.id, nombre: 'Carlos' }]) {
        distribData.push({
          ventaId:       venta.id,
          pagoId:        pago.id,
          descripcion:   'Ganancia agencia',
          monto:         Math.round((restante / 2) * 100) / 100,
          tipo:          'ganancia',
          estado:        'pendiente',
          personaId:     socio.id,
          personaNombre: socio.nombre,
        });
      }
    }
    if (distribData.length > 0) {
      await prisma.distribucion.createMany({ data: distribData });
    }

    console.log('✅ Venta demo creada con distribuciones:', venta.nombreProyecto);
  } else {
    console.log('ℹ️ Venta demo ya existe, saltando...');
  }

  console.log('\n🎉 Seed completado!');
  console.log('📧 admin@agencia.com / admin123');
  console.log('📧 socio@agencia.com / socio123\n');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });