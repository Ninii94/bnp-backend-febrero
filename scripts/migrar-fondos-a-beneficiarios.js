
import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';

const migrarFondosABeneficiarios = async () => {
  try {
    console.log('🔄 === INICIANDO MIGRACIÓN DE FONDOS ===');
    
    // Importar modelo de Fondo (el anterior)
    let Fondo;
    try {
      const fondoModule = await import('../models/Fondo.js');
      Fondo = fondoModule.Fondo;
    } catch (error) {
      console.log('⚠️ Modelo Fondo no encontrado (normal si ya se eliminó)');
      console.log('⚠️ Si tienes fondos en una colección separada, ajustar este script');
      return;
    }
    
    // Buscar todos los fondos existentes
    const fondosExistentes = await Fondo.find();
    console.log(`📊 Fondos encontrados para migrar: ${fondosExistentes.length}`);
    
    let migradosExitosos = 0;
    let errores = 0;
    
    for (const fondo of fondosExistentes) {
      try {
        console.log(`\n🔄 Migrando fondo: ${fondo._id}`);
        console.log(`   Beneficiario ID: ${fondo.beneficiarioId}`);
        
        // Buscar el beneficiario correspondiente
        const beneficiario = await Beneficiario.findById(fondo.beneficiarioId);
        
        if (!beneficiario) {
          console.log(`❌ Beneficiario no encontrado: ${fondo.beneficiarioId}`);
          errores++;
          continue;
        }
        
        // Verificar si ya tiene fondo integrado
        if (beneficiario.fondo && beneficiario.fondo.activo) {
          console.log(`⚠️ Beneficiario ya tiene fondo integrado, saltando...`);
          continue;
        }
        
        // Migrar datos del fondo al beneficiario
        beneficiario.fondo = {
          activo: true,
          equipoId: fondo.equipoId,
          montoInicial: fondo.montoInicial || 500,
          montoActual: fondo.montoActual || 500,
          fechaActivacion: fondo.fechaActivacion,
          fechaVencimiento: fondo.fechaVencimiento,
          validezDias: fondo.validezDias || 365,
          estado: fondo.estado || 'activo',
          motivoBloqueo: fondo.motivoBloqueo,
          montoReactivacion: fondo.montoReactivacion || 0,
          montoRenovacion: fondo.montoRenovacion || 500,
          fechaBloqueo: fondo.fechaBloqueo,
          fechaRenovacion: fondo.fechaRenovacion,
          fechaUltimaRenovacion: fondo.fechaUltimaRenovacion,
          tiempoSuspendido: fondo.tiempoSuspendido || 0,
          historial: fondo.historial || [],
          fechaCreacion: fondo.createdAt || fondo.fechaCreacion || new Date()
        };
        
        // Guardar beneficiario con fondo integrado
        await beneficiario.save();
        
        console.log(`✅ Fondo migrado exitosamente`);
        console.log(`   Estado: ${beneficiario.fondo.estado}`);
        console.log(`   Monto: $${beneficiario.fondo.montoActual}`);
        
        migradosExitosos++;
        
      } catch (error) {
        console.error(`❌ Error migrando fondo ${fondo._id}:`, error.message);
        errores++;
      }
    }
    
    console.log('\n🎉 === MIGRACIÓN COMPLETADA ===');
    console.log(`✅ Fondos migrados exitosamente: ${migradosExitosos}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesados: ${fondosExistentes.length}`);
    
    // Opcional: Eliminar colección de fondos antiguos (comentado por seguridad)
    // console.log('\n⚠️ NOTA: Para eliminar la colección antigua de fondos, ejecutar:');
    // console.log('   await mongoose.connection.db.dropCollection("fondos");');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
};

// Script para crear fondo de prueba para un beneficiario específico
const crearFondoPrueba = async (beneficiarioId, equipoId = null) => {
  try {
    console.log(`🧪 Creando fondo de prueba para beneficiario: ${beneficiarioId}`);
    
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      console.log('❌ Beneficiario no encontrado');
      return;
    }
    
    // Buscar un usuario del equipo si no se especifica
    if (!equipoId) {
      const { Usuario } = await import('../models/Usuario.js');
      const usuarioEquipo = await Usuario.findOne({ tipo: 'equipo_bnp', activo: true });
      equipoId = usuarioEquipo?._id;
    }
    
    if (!equipoId) {
      console.log('❌ No se pudo encontrar un usuario del equipo BNP');
      return;
    }
    
    // Activar fondo usando el método del modelo
    const resultado = beneficiario.activarFondo(equipoId, 1500, 365);
    
    // Guardar beneficiario
    await beneficiario.save();
    
    console.log('✅ Fondo de prueba creado exitosamente:');
    console.log('   Beneficiario:', beneficiario.nombre, beneficiario.apellido);
    console.log('   Monto inicial:', resultado.montoInicial);
    console.log('   Fecha vencimiento:', resultado.fechaVencimiento.toLocaleDateString());
    console.log('   Estado:', resultado.estado);
    
    return resultado;
    
  } catch (error) {
    console.error('❌ Error creando fondo de prueba:', error);
  }
};

// Script para verificar migración
const verificarMigracion = async () => {
  try {
    console.log('🔍 === VERIFICANDO MIGRACIÓN ===');
    
    const beneficiariosConFondo = await Beneficiario.find({ 'fondo.activo': true });
    const beneficiariosSinFondo = await Beneficiario.find({ 
      $or: [
        { fondo: { $exists: false } },
        { 'fondo.activo': false },
        { 'fondo.activo': { $exists: false } }
      ]
    });
    
    console.log(`📊 Beneficiarios con fondo activo: ${beneficiariosConFondo.length}`);
    console.log(`📊 Beneficiarios sin fondo: ${beneficiariosSinFondo.length}`);
    
    // Mostrar algunos ejemplos
    console.log('\n✅ Ejemplos de beneficiarios con fondo:');
    beneficiariosConFondo.slice(0, 3).forEach((b, i) => {
      console.log(`${i + 1}. ${b.nombre} ${b.apellido} - Estado: ${b.fondo.estado} - Saldo: $${b.fondo.montoActual}`);
    });
    
    if (beneficiariosSinFondo.length > 0) {
      console.log('\n⚠️ Ejemplos de beneficiarios sin fondo:');
      beneficiariosSinFondo.slice(0, 3).forEach((b, i) => {
        console.log(`${i + 1}. ${b.nombre} ${b.apellido} - ID: ${b._id}`);
      });
    }
    
    return {
      conFondo: beneficiariosConFondo.length,
      sinFondo: beneficiariosSinFondo.length,
      beneficiariosSinFondo: beneficiariosSinFondo.map(b => ({
        id: b._id,
        nombre: `${b.nombre} ${b.apellido}`,
        codigo: b.codigo?.value
      }))
    };
    
  } catch (error) {
    console.error('❌ Error verificando migración:', error);
  }
};

// Función para usar en endpoints de debug
const crearFondoParaBeneficiario = async (beneficiarioId, montoInicial = 1500, equipoId = null) => {
  try {
    console.log(`🏗️ Creando fondo para beneficiario: ${beneficiarioId}`);
    
    // Buscar beneficiario
    let beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      // Buscar por usuario_id
      beneficiario = await Beneficiario.findOne({ usuario_id: beneficiarioId });
    }
    
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }
    
    // Verificar si ya tiene fondo
    if (beneficiario.fondo && beneficiario.fondo.activo) {
      throw new Error('El beneficiario ya tiene un fondo activo');
    }
    
    // Buscar usuario del equipo si no se especifica
    if (!equipoId) {
      const { Usuario } = await import('../models/Usuario.js');
      const usuarioEquipo = await Usuario.findOne({ tipo: 'equipo_bnp', activo: true });
      equipoId = usuarioEquipo?._id;
    }
    
    if (!equipoId) {
      throw new Error('No se pudo encontrar un usuario del equipo BNP');
    }
    
    // Activar fondo
    const resultado = beneficiario.activarFondo(equipoId, montoInicial, 365);
    
    // Guardar
    await beneficiario.save();
    
    console.log('✅ Fondo creado exitosamente');
    return {
      beneficiario: {
        id: beneficiario._id,
        nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
        codigo: beneficiario.codigo?.value
      },
      fondo: resultado
    };
    
  } catch (error) {
    console.error('❌ Error creando fondo:', error);
    throw error;
  }
};

export { 
  migrarFondosABeneficiarios,
  crearFondoPrueba,
  verificarMigracion,
  crearFondoParaBeneficiario
};