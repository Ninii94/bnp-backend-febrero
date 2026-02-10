// migrations/migrate-to-new-benefits-system.js
import mongoose from 'mongoose';
import { Servicio } from '../models/Servicio.js';
import { BeneficioBeneficiario } from '../models/BeneficioBeneficiario.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Usuario } from '../models/Usuario.js';

// Script de migración para el nuevo sistema de beneficios
export async function migrateToNewBenefitsSystem() {
  console.log('🚀 === INICIANDO MIGRACIÓN AL NUEVO SISTEMA DE BENEFICIOS ===');
  
  try {
    // 1. Actualizar servicios existentes con nuevos nombres y configuración
    console.log('📝 Paso 1: Actualizando servicios existentes...');
    
    // Actualizar "Certificado de boletos aéreos" a "Vouchers Flyback"
    await Servicio.updateOne(
      { nombre: 'Certificado de boletos aéreos' },
      {
        $set: {
          nombre: 'Vouchers Flyback',
          descripcion: 'Vouchers de $500 USD para boletos aéreos. Renovable hasta 10 veces (1 por año).',
          estado: 'pendiente_activacion',
          'configuracion.voucher_config': {
            valor_individual: 500,
            limite_renovaciones: 10,
            renovacion_anual: true
          }
        }
      }
    );
    console.log('✅ Servicio "Vouchers Flyback" actualizado');

    // Actualizar servicio de Reembolso de costos
    await Servicio.updateOne(
      { nombre: 'Reembolso de costos' },
      {
        $set: {
          estado: 'pendiente_activacion',
          'configuracion.reembolso_config': {
            anos_reembolso: 25,
            porcentaje_prima: 5.75
          }
        }
      }
    );
    console.log('✅ Servicio "Reembolso de costos" actualizado');

    // Actualizar servicio de Financiamiento de seña
    await Servicio.updateOne(
      { nombre: 'Financiamiento de seña' },
      {
        $set: {
          estado: 'pendiente_activacion',
          'configuracion.financiamiento_config': {
            tasa_interes: 7,
            max_mensualidades: 6
          }
        }
      }
    );
    console.log('✅ Servicio "Financiamiento de seña" actualizado');

    // 2. Crear registros BeneficioBeneficiario para beneficiarios existentes con servicios
    console.log('📝 Paso 2: Creando registros individuales de beneficios...');
    
    const beneficiarios = await Beneficiario.find({ 
      servicios: { $exists: true, $not: { $size: 0 } } 
    }).populate('usuario_id', 'nombre_usuario');

    console.log(`📊 Encontrados ${beneficiarios.length} beneficiarios con servicios`);

    let beneficiosCreados = 0;
    let beneficiosExistentes = 0;

    for (const beneficiario of beneficiarios) {
      if (!beneficiario.servicios || beneficiario.servicios.length === 0) continue;

      console.log(`👤 Procesando beneficiario: ${beneficiario.nombre} ${beneficiario.apellido}`);

      for (const servicioId of beneficiario.servicios) {
        try {
          // Buscar el servicio para obtener su nombre
          let servicio = await Servicio.findById(servicioId);
          
          // Si no se encuentra por ID, buscar por nombre (compatibilidad con IDs antiguos)
          if (!servicio) {
            const ID_ANTIGUO_A_NOMBRE = {
              'financiamiento_senas': 'Financiamiento de seña',
              'certificados_boletos': 'Vouchers Flyback',
              'plan_reembolso': 'Reembolso de costos',
              'financiamiento_pagos': 'Financiamiento de seña',
              'plan_reembolso_membresia': 'Reembolso de costos'
            };
            
            const nombreServicio = ID_ANTIGUO_A_NOMBRE[servicioId];
            if (nombreServicio) {
              servicio = await Servicio.findOne({ nombre: nombreServicio });
            }
          }

          if (!servicio) {
            console.log(`⚠️ Servicio no encontrado: ${servicioId}`);
            continue;
          }

          // Verificar si ya existe el registro
          const existingBeneficio = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicio._id
          });

          if (existingBeneficio) {
            console.log(`⚡ Beneficio ya existe: ${servicio.nombre}`);
            beneficiosExistentes++;
            continue;
          }

          // Crear nuevo registro de beneficio
          const nuevoBeneficio = new BeneficioBeneficiario({
            beneficiarioId: beneficiario._id,
            servicioId: servicio._id,
            servicioNombre: servicio.nombre,
            estado: 'pendiente_activacion', // Por defecto pendiente
            creado_por: beneficiario.usuario_id?._id || null,
            
            // Inicializar datos específicos según el tipo
            ...(servicio.nombre === 'Vouchers Flyback' && {
              voucher_data: {
                saldo_actual: 500,
                vouchers_usados: 0,
                renovaciones_utilizadas: 0,
                historial_uso: []
              }
            }),
            
            ...(servicio.nombre === 'Reembolso de costos' && {
              reembolso_data: {
                estado_prima: 'pendiente'
              }
            }),
            
            ...(servicio.nombre === 'Financiamiento de seña' && {
              financiamiento_data: {
                mensualidades_pagadas: 0,
                historial_pagos: []
              }
            }),
            
            historial_estados: [{
              estado_anterior: null,
              estado_nuevo: 'pendiente_activacion',
              motivo: 'Migración automática desde sistema anterior',
              procesado_por: beneficiario.usuario_id?._id || null
            }]
          });

          await nuevoBeneficio.save();
          console.log(`✅ Beneficio creado: ${servicio.nombre} para ${beneficiario.nombre}`);
          beneficiosCreados++;

        } catch (error) {
          console.error(`❌ Error procesando servicio ${servicioId}:`, error);
        }
      }
    }

    console.log(`📊 Resumen de migración:`);
    console.log(`   - Beneficios creados: ${beneficiosCreados}`);
    console.log(`   - Beneficios existentes: ${beneficiosExistentes}`);

    // 3. Crear índices necesarios
    console.log('📝 Paso 3: Creando índices...');
    
    try {
      await mongoose.connection.collection('beneficiobeneficiarios').createIndex(
        { beneficiarioId: 1, servicioId: 1 }, 
        { unique: true, background: true }
      );
      console.log('✅ Índice único creado en beneficiobeneficiarios');
    } catch (indexError) {
      console.log('⚠️ Índice ya existe o error al crear:', indexError.message);
    }

    // 4. Estadísticas finales
    console.log('📝 Paso 4: Generando estadísticas...');
    
    const totalBeneficios = await BeneficioBeneficiario.countDocuments();
    const beneficiosPendientes = await BeneficioBeneficiario.countDocuments({ estado: 'pendiente_activacion' });
    const beneficiosActivos = await BeneficioBeneficiario.countDocuments({ estado: 'activo' });

    const estadisticasPorTipo = await BeneficioBeneficiario.aggregate([
      {
        $group: {
          _id: '$servicioNombre',
          total: { $sum: 1 },
          pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente_activacion'] }, 1, 0] } },
          activos: { $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] } }
        }
      }
    ]);

    console.log('📊 === ESTADÍSTICAS FINALES ===');
    console.log(`Total de beneficios: ${totalBeneficios}`);
    console.log(`Pendientes de activación: ${beneficiosPendientes}`);
    console.log(`Activos: ${beneficiosActivos}`);
    console.log('\nPor tipo de beneficio:');
    estadisticasPorTipo.forEach(stat => {
      console.log(`  ${stat._id}:`);
      console.log(`    - Total: ${stat.total}`);
      console.log(`    - Pendientes: ${stat.pendientes}`);
      console.log(`    - Activos: ${stat.activos}`);
    });

    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
    
    return {
      success: true,
      beneficios_creados: beneficiosCreados,
      beneficios_existentes: beneficiosExistentes,
      total_beneficios: totalBeneficios,
      estadisticas: estadisticasPorTipo
    };

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

// Función para ejecutar la migración desde línea de comandos
async function runMigration() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tu_database');
    console.log('🔌 Conectado a MongoDB');
    
    // Ejecutar migración
    const resultado = await migrateToNewBenefitsSystem();
    
    console.log('\n✅ Migración ejecutada exitosamente');
    console.log('Resultado:', JSON.stringify(resultado, null, 2));
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export default migrateToNewBenefitsSystem;