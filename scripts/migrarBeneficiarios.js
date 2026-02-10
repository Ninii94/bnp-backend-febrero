import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Función para generar un código único
async function generarCodigoUnico() {
  let isUnique = false;
  let codigoGenerado = '';
  
  // Intentar hasta encontrar un código único
  while (!isUnique) {
    // Formato: BNP-XXXX-YYYY (donde X son letras y Y son números)
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numeros = '23456789';
    
    let codigo = 'BNP-';
    
    // Generar 4 letras aleatorias
    for (let i = 0; i < 4; i++) {
      codigo += letras.charAt(Math.floor(Math.random() * letras.length));
    }
    
    codigo += '-';
    
    // Generar 4 números aleatorios
    for (let i = 0; i < 4; i++) {
      codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
    
    codigoGenerado = codigo;
    
    // Comprobar si ya existe
    const existente = await Beneficiario.findOne({ 'codigo.value': codigoGenerado });
    if (!existente) {
      isUnique = true;
    }
  }
  
  return codigoGenerado;
}

// Función para migrar beneficiarios existentes
async function migrarBeneficiarios() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conectado a MongoDB');
    
    // Buscar todos los beneficiarios que no tienen código
    const beneficiariosSinCodigo = await Beneficiario.find({
      $or: [
        { codigo: { $exists: false } },
        { 'codigo.value': { $exists: false } },
        { 'codigo.value': null }
      ]
    });
    
    console.log(`Se encontraron ${beneficiariosSinCodigo.length} beneficiarios sin código`);
    
    // Generar y asignar códigos únicos
    let actualizados = 0;
    
    for (const beneficiario of beneficiariosSinCodigo) {
      // Generar un nuevo código único
      const nuevoCodigoValue = await generarCodigoUnico();
      
      // Actualizar el beneficiario
      beneficiario.codigo = {
        value: nuevoCodigoValue,
        fecha_creacion: new Date(),
        historial: [{
          codigo_anterior: null,
          motivo: 'CREACION',
          costo: 0,
          pagado: true
        }],
        activo: true
      };
      
      await beneficiario.save();
      actualizados++;
      
      console.log(`[${actualizados}/${beneficiariosSinCodigo.length}] Código ${nuevoCodigoValue} asignado a ${beneficiario.nombre} ${beneficiario.apellido || ''}`);
    }
    
    console.log(`Migración completada. Se actualizaron ${actualizados} beneficiarios.`);
    
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
  }
}

// Ejecutar la migración
migrarBeneficiarios();