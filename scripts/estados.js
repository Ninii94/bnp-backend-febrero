// ============================================
// Script: Verificar y Crear Estados
// Base de Datos: MongoDB
// ============================================

// PASO 1: Conectar a tu base de datos MongoDB
// Puedes ejecutar esto en MongoDB Compass, Studio 3T, o mongo shell

// ============================================
// VERIFICAR ESTADOS EXISTENTES
// ============================================

// Ver todos los estados actuales
db.estados.find().pretty()

// Ver solo los nombres de estados
db.estados.find({}, { nombre: 1, activo: 1, _id: 1 })

// Verificar si existe "Activo"
db.estados.findOne({ nombre: 'Activo' })

// Verificar si existe "Pendiente de Verificación"
db.estados.findOne({ nombre: 'Pendiente de Verificación' })


// ============================================
// CREAR ESTADOS SI NO EXISTEN
// ============================================

// Estado: Pendiente de Verificación
db.estados.updateOne(
  { nombre: 'Pendiente de Verificación' },
  {
    $setOnInsert: {
      nombre: 'Pendiente de Verificación',
      descripcion: 'Beneficiario creado pero sin contrato firmado',
      color: '#F59E0B', // Amber
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
)

// Estado: Activo
db.estados.updateOne(
  { nombre: 'Activo' },
  {
    $setOnInsert: {
      nombre: 'Activo',
      descripcion: 'Beneficiario con contrato firmado y activo',
      color: '#10B981', // Green
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
)

// Estado: Inactivo
db.estados.updateOne(
  { nombre: 'Inactivo' },
  {
    $setOnInsert: {
      nombre: 'Inactivo',
      descripcion: 'Beneficiario temporalmente inactivo',
      color: '#6B7280', // Gray
      activo: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
)

// Estado: Bloqueado
db.estados.updateOne(
  { nombre: 'Bloqueado' },
  {
    $setOnInsert: {
      nombre: 'Bloqueado',
      descripcion: 'Beneficiario bloqueado por motivos administrativos',
      color: '#EF4444', // Red
      activo: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
)


// ============================================
// VERIFICAR CREACIÓN
// ============================================

// Ver todos los estados creados
db.estados.find().pretty()

// Contar estados
db.estados.countDocuments()


// ============================================
// OBTENER IDs DE ESTADOS (Para usar en código)
// ============================================

// Guardar el ObjectId del estado "Activo"
const estadoActivo = db.estados.findOne({ nombre: 'Activo' })
print('Estado Activo ID:', estadoActivo._id)

// Guardar el ObjectId del estado "Pendiente"
const estadoPendiente = db.estados.findOne({ nombre: 'Pendiente de Verificación' })
print('Estado Pendiente ID:', estadoPendiente._id)


// ============================================
// SCRIPT NODE.JS (Alternativo)
// ============================================

/*
// Ejecutar este script con: node crear-estados.js

import mongoose from 'mongoose';
import { Estado } from './models/Estado.js';

async function crearEstados() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Definir estados
    const estados = [
      {
        nombre: 'Pendiente de Verificación',
        descripcion: 'Beneficiario creado pero sin contrato firmado',
        color: '#F59E0B',
        activo: true,
      },
      {
        nombre: 'Activo',
        descripcion: 'Beneficiario con contrato firmado y activo',
        color: '#10B981',
        activo: true,
      },
      {
        nombre: 'Inactivo',
        descripcion: 'Beneficiario temporalmente inactivo',
        color: '#6B7280',
        activo: false,
      },
      {
        nombre: 'Bloqueado',
        descripcion: 'Beneficiario bloqueado por motivos administrativos',
        color: '#EF4444',
        activo: false,
      },
    ];

    // Crear estados si no existen
    for (const estadoData of estados) {
      const existe = await Estado.findOne({ nombre: estadoData.nombre });
      
      if (!existe) {
        const nuevoEstado = await Estado.create(estadoData);
        console.log(`✅ Estado creado: ${nuevoEstado.nombre} (${nuevoEstado._id})`);
      } else {
        console.log(`⏭️  Estado ya existe: ${existe.nombre} (${existe._id})`);
      }
    }

    console.log('\n📊 Resumen de estados:');
    const todosEstados = await Estado.find();
    todosEstados.forEach(estado => {
      console.log(`  - ${estado.nombre} (${estado._id})`);
    });

    console.log('\n✅ Proceso completado');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

crearEstados();
*/


// ============================================
// ACTUALIZAR BENEFICIARIOS EXISTENTES
// ============================================

// Si tienes beneficiarios sin estado, asignarles "Pendiente"
const estadoPendienteId = db.estados.findOne({ nombre: 'Pendiente de Verificación' })._id

db.beneficiarios.updateMany(
  { estado_id: { $exists: false } },
  { 
    $set: { 
      estado_id: estadoPendienteId,
      verificado: false
    } 
  }
)

print('Beneficiarios actualizados:', db.beneficiarios.countDocuments({ estado_id: estadoPendienteId }))


// ============================================
// QUERIES ÚTILES PARA DEBUG
// ============================================

// Ver beneficiarios por estado
db.beneficiarios.aggregate([
  {
    $lookup: {
      from: 'estados',
      localField: 'estado_id',
      foreignField: '_id',
      as: 'estado'
    }
  },
  {
    $unwind: '$estado'
  },
  {
    $group: {
      _id: '$estado.nombre',
      cantidad: { $sum: 1 }
    }
  }
])


// Ver beneficiarios sin estado
db.beneficiarios.find({ estado_id: { $exists: false } }).count()


// Ver beneficiarios activos
const estadoActivoId = db.estados.findOne({ nombre: 'Activo' })._id
db.beneficiarios.find({ estado_id: estadoActivoId }).count()


// Ver último beneficiario creado
db.beneficiarios.find().sort({ createdAt: -1 }).limit(1).pretty()


// ============================================
// EXPORTAR DATOS (Para backup)
// ============================================

// En terminal (fuera de mongo shell):
// mongoexport --db=tu_database --collection=estados --out=estados_backup.json


// ============================================
// IMPORTAR ESTADOS (Desde backup)
// ============================================

// En terminal:
// mongoimport --db=tu_database --collection=estados --file=estados_backup.json


// ============================================
// LIMPIAR ESTADOS DUPLICADOS (Si hay)
// ============================================

db.estados.aggregate([
  {
    $group: {
      _id: '$nombre',
      ids: { $push: '$_id' },
      count: { $sum: 1 }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]).forEach(doc => {
  // Mantener el primero, eliminar duplicados
  const idsToRemove = doc.ids.slice(1)
  db.estados.deleteMany({ _id: { $in: idsToRemove } })
  print('Duplicados eliminados para:', doc._id)
})


print('\n✅ Script completado');