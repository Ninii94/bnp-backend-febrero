
import mongoose from 'mongoose';
import { Servicio } from '../models/Servicio.js';
import dotenv from 'dotenv';

dotenv.config();

const servicios = [
  //  Beneficiario
  {
    nombre: 'Financiamiento de seña',
    descripcion: 'Servicio de financiamiento para señas',
    tipoUsuario: 'beneficiario'
  },
  {
    nombre: 'Certificado de boletos aéreos',
    descripcion: 'Servicio de certificados para vuelos',
    tipoUsuario: 'ambos' // Este servicio aplica a ambos tipos
  },
  {
    nombre: 'Reembolso de costos',
    descripcion: 'Servicio de reembolso de costos',
    tipoUsuario: 'beneficiario'
  },
  
  //  Aliado
  {
    nombre: 'Financiamiento de pagos inicial',
    descripcion: 'Servicio de financiamiento para pagos iniciales',
    tipoUsuario: 'aliado'
  },
  {
    nombre: 'Reembolso de costos de membresía',
    descripcion: 'Servicio de reembolso de costos de membresía',
    tipoUsuario: 'aliado'
  }
];

async function initServicios() {
  try {
   
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conectado a MongoDB');
  
    for (const servicio of servicios) {
      // Verificar si ya existe por nombre
      const existingServicio = await Servicio.findOne({ nombre: servicio.nombre });
      
      if (existingServicio) {
        // Actualizar si existe
        await Servicio.updateOne({ _id: existingServicio._id }, servicio);
        console.log(`Servicio actualizado: ${servicio.nombre}`);
      } else {
        // Crear si no existe
        await Servicio.create(servicio);
        console.log(`Servicio creado: ${servicio.nombre}`);
      }
    }
    
    console.log('Inicialización de servicios completada');
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
  }
}


initServicios();