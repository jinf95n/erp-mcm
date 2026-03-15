// src/app/api/auth/login/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar password
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Crear token JWT
    const token = jwt.sign(
      {
        userId: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Responder con token y datos del usuario (sin password)
    return NextResponse.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
