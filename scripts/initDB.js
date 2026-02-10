// server/scripts/initDB.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Usuario, Aliado, Beneficiario, Servicio, CertificadoVuelo } from '../models/index.js';

// Configurar rutas para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error cargando el archivo .env:', result.error);
  process.exit(1);
}

// Verificar que tenemos la variable MONGODB_URI
if (!process.env.MONGODB_URI) {
  console.error('Error: La variable MONGODB_URI no está definida en el archivo .env');
  process.exit(1);
}

console.log('Usando MONGODB_URI:', process.env.MONGODB_URI);

const initializeDB = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Limpiar las colecciones existentes
    await Promise.all([
      Usuario.deleteMany({}),
      Aliado.deleteMany({}),
      Beneficiario.deleteMany({}),
      Servicio.deleteMany({}),
      CertificadoVuelo.deleteMany({})
    ]);
    console.log('Colecciones limpiadas');

    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('password123', 10);

    const usuarios = await Usuario.create([
      {
        nombre_usuario: 'admin_bnp',
        contrasena: hashedPassword,
        correo: 'admin@bnp.com',
        tipo: 'equipo_bnp',
        activo: true
      },
      {
        nombre_usuario: 'aliado1',
        contrasena: hashedPassword,
        correo: 'aliado1@test.com',
        tipo: 'aliado',
        activo: true
      },
      {
        nombre_usuario: 'beneficiario1',
        contrasena: hashedPassword,
        correo: 'beneficiario1@test.com',
        tipo: 'beneficiario',
        activo: true
      }
    ]);
    console.log('Usuarios creados');

    // Crear servicios
    const servicios = await Servicio.create([
      {
        nombre: 'Financiamiento de seña',
        descripcion: 'Servicio de financiamiento para señas'
      },
      {
        nombre: 'Certificado de boletos aéreos',
        descripcion: 'Servicio de certificados para vuelos'
      },
      {
        nombre: 'Reembolso de costos',
        descripcion: 'Servicio de reembolso de costos de membresía'
      }
    ]);
    console.log('Servicios creados');

    // Crear un aliado
    const aliado = await Aliado.create({
      nombre: 'Agencia de Viajes Test',
      info_contacto: 'contacto@agenciatest.com',
      inicio_contrato: new Date(),
      fin_contrato: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      cantidad_ventas: 0,
      metricas_rendimiento: 0
    });
    console.log('Aliado creado');

    // Crear un beneficiario
    const beneficiario = await Beneficiario.create({
      nombre: 'Juan Pérez',
      llave_unica: 'BNP-2024-001',
      fecha_creacion: new Date()
    });
    console.log('Beneficiario creado');

    // Crear un certificado de vuelo
    await CertificadoVuelo.create({
      beneficiario_id: beneficiario._id,
      numero_certificado: 'CERT-2024-001',
      fecha_emision: new Date(),
      fecha_vencimiento: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 meses
      detalles_vuelo: 'Pendiente de reserva'
    });
    console.log('Certificado de vuelo creado');

    console.log('Base de datos inicializada con éxito');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  }
};

initializeDB();