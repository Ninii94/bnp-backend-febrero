// scripts/initEstados.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { join } from 'path';
import { Estado } from '../models/Estado.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bnp_db';

const estados = [
  // para Beneficiarios
  {
    nombre: 'Activo',
    tipo: 'BENEFICIARIO',
    codigo: 'BENEFICIARIO_ACTIVO'
  },
  {
    nombre: 'Inactivo',
    tipo: 'BENEFICIARIO',
    codigo: 'BENEFICIARIO_INACTIVO'
  },
  {
    nombre: 'Pendiente de Verificación',
    tipo: 'BENEFICIARIO',
    codigo: 'BENEFICIARIO_PENDIENTE'
  },
  {
    nombre: 'Bloqueado',
    tipo: 'BENEFICIARIO',
    codigo: 'BENEFICIARIO_BLOQUEADO'
  },
  
  // para Aliados
  {
    nombre: 'Activo',
    tipo: 'ALIADO',
    codigo: 'ALIADO_ACTIVO'
  },
  {
    nombre: 'Inactivo',
    tipo: 'ALIADO',
    codigo: 'ALIADO_INACTIVO'
  },
  {
    nombre: 'Suspendido',
    tipo: 'ALIADO',
    codigo: 'ALIADO_SUSPENDIDO'
  },
  {
    nombre: 'En Revisión',
    tipo: 'ALIADO',
    codigo: 'ALIADO_EN_REVISION'
  },

  // para Sucursales
  {
    nombre: 'Activa',
    tipo: 'SUCURSAL',
    codigo: 'SUCURSAL_ACTIVA'
  },
  {
    nombre: 'Inactiva',
    tipo: 'SUCURSAL',
    codigo: 'SUCURSAL_INACTIVA'
  },
  {
    nombre: 'En mantenimiento',
    tipo: 'SUCURSAL',
    codigo: 'SUCURSAL_MANTENIMIENTO'
  },
  {
    nombre: 'Pendiente de verificación',
    tipo: 'SUCURSAL',
    codigo: 'SUCURSAL_PENDIENTE'
  }
];

async function initEstados() {
  try {
    console.log('URI de MongoDB:', MONGODB_URI);
    console.log('Conectando a MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('Conexión exitosa a MongoDB');
    
    // Eliminar la colección de estados
    await mongoose.connection.db.dropCollection('estados').catch(err => {
      if (err.code !== 26) { // 26 es el código de error cuando la colección no existe
        console.log('Error al eliminar colección:', err);
      }
    });
    console.log('Colección de estados eliminada (si existía)');
    
    // Insertar nuevos estados
    const result = await Estado.insertMany(estados, { ordered: false });
    console.log('Estados inicializados correctamente');
    console.log(`${result.length} estados insertados`);
    
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar estados:', error);
    if (error.writeErrors) {
      console.log('Detalles de los errores:');
      error.writeErrors.forEach(err => {
        console.log(`- ${err.err.errmsg}`);
      });
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

initEstados();