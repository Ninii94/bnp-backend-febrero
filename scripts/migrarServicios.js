// scripts/migrateServiceIds.js
import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';
import { Aliado } from '../models/Aliado.js';
import { Servicio } from '../models/Servicio.js';
import dotenv from 'dotenv';

dotenv.config();

// Mapeo de IDs antiguos a nuevos basados en nombres
const mapeoIdsPorNombre = {
  // Servicios de Beneficiario
  'financiamiento_senas': 'Financiamiento de seña',
  'certificados_boletos': 'Certificado de boletos aéreos',
  'plan_reembolso': 'Reembolso de costos',
  
  // Servicios de Aliado
  'financiamiento_pagos': 'Financiamiento de pagos inicial',
  // 'certificados_boletos' ya está arriba y se reutiliza
  'plan_reembolso_membresia': 'Reembolso de costos de membresía'
};

async function migrateServiceIds() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conectado a MongoDB');
    
    // Obtener todos los servicios para tener sus IDs
    const servicios = await Servicio.find();
    console.log(`Se encontraron ${servicios.length} servicios en la base de datos`);
    
    // Crear un mapeo de nombre a ID
    const nombreToId = {};
    for (const servicio of servicios) {
      nombreToId[servicio.nombre] = servicio._id.toString();
    }
    
    console.log('Mapeo de nombres a IDs:', nombreToId);
    
    // Crear un mapeo de IDs antiguos a nuevos
    const idAntiguo_a_idNuevo = {};
    for (const [idAntiguo, nombre] of Object.entries(mapeoIdsPorNombre)) {
      if (nombreToId[nombre]) {
        idAntiguo_a_idNuevo[idAntiguo] = nombreToId[nombre];
      }
    }
    
    console.log('Mapeo de IDs antiguos a nuevos:', idAntiguo_a_idNuevo);
    
    // Función auxiliar para migrar servicios
    const migrarServicios = (serviciosActuales) => {
      if (!Array.isArray(serviciosActuales)) return [];
      
      return serviciosActuales.map(idServicio => {
        // Si es un string del antiguo formato, convertirlo
        if (typeof idServicio === 'string' && idAntiguo_a_idNuevo[idServicio]) {
          return idAntiguo_a_idNuevo[idServicio];
        }
        return idServicio;
      });
    };
    
    // Migrar beneficiarios
    const beneficiarios = await Beneficiario.find({ 
      servicios: { $exists: true, $type: 'array' } 
    });
    console.log(`Se encontraron ${beneficiarios.length} beneficiarios con servicios`);
    
    let beneficiariosActualizados = 0;
    for (const beneficiario of beneficiarios) {
      const serviciosMigrados = migrarServicios(beneficiario.servicios);
      if (JSON.stringify(serviciosMigrados) !== JSON.stringify(beneficiario.servicios)) {
        await Beneficiario.updateOne(
          { _id: beneficiario._id },
          { $set: { servicios: serviciosMigrados } }
        );
        beneficiariosActualizados++;
      }
    }
    
    // Migrar aliados
    const aliados = await Aliado.find({ 
      servicios: { $exists: true, $type: 'array' } 
    });
    console.log(`Se encontraron ${aliados.length} aliados con servicios`);
    
    let aliadosActualizados = 0;
    for (const aliado of aliados) {
      const serviciosMigrados = migrarServicios(aliado.servicios);
      if (JSON.stringify(serviciosMigrados) !== JSON.stringify(aliado.servicios)) {
        await Aliado.updateOne(
          { _id: aliado._id },
          { $set: { servicios: serviciosMigrados } }
        );
        aliadosActualizados++;
      }
    }
    
    console.log(`Migración completada:`);
    console.log(`- Beneficiarios actualizados: ${beneficiariosActualizados}`);
    console.log(`- Aliados actualizados: ${aliadosActualizados}`);
    
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    // Cerrar la conexión
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
  }
}

// Ejecutar la migración
migrateServiceIds();