
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Beneficiario } from './models/Beneficiario.js';
import { Servicio } from './models/Servicio.js';
import { BeneficioBeneficiario } from './models/BeneficioBeneficiario.js';

// Cargar variables de entorno
dotenv.config();

async function conectarDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function verificarDatosExistentes() {
  console.log('\n=== VERIFICACIÓN INICIAL ===');
  
  // Verificar beneficiarios con servicios
  const beneficiariosConServicios = await Beneficiario.countDocuments({
    servicios: { $exists: true, $ne: [] }
  });
  console.log(`Beneficiarios con servicios: ${beneficiariosConServicios}`);
  
  // Verificar beneficios existentes en BeneficioBeneficiario
  const beneficiosExistentes = await BeneficioBeneficiario.countDocuments({});
  console.log(`Registros existentes en BeneficioBeneficiario: ${beneficiosExistentes}`);
  
  // Verificar servicios disponibles
  const serviciosCount = await Servicio.countDocuments({});
  console.log(`Total servicios disponibles: ${serviciosCount}`);
  
  return { beneficiariosConServicios, beneficiosExistentes, serviciosCount };
}

async function migrarBeneficios() {
  console.log('\n=== INICIANDO MIGRACIÓN ===');
  
  let migrados = 0;
  let errores = 0;
  let beneficiariosProcessed = 0;
  let duplicados = 0;

  try {
    // Obtener todos los beneficiarios con servicios
    const beneficiarios = await Beneficiario.find({
      servicios: { $exists: true, $ne: [] }
    }).populate('servicios');

    console.log(`\nProcesando ${beneficiarios.length} beneficiarios...\n`);

    for (const beneficiario of beneficiarios) {
      beneficiariosProcessed++;
      console.log(`[${beneficiariosProcessed}/${beneficiarios.length}] Procesando: ${beneficiario.nombre} ${beneficiario.apellido || ''}`);
      console.log(`ID: ${beneficiario._id}`);
      console.log(`Usuario ID: ${beneficiario.usuario_id}`);
      console.log(`Servicios: ${beneficiario.servicios.length}`);

      // Procesar cada servicio del beneficiario
      for (const servicioId of beneficiario.servicios) {
        try {
          // Verificar si ya existe el beneficio
          const beneficioExistente = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicioId
          });

          if (beneficioExistente) {
            console.log(`  ⚠️ Ya existe beneficio para servicio: ${servicioId}`);
            duplicados++;
            continue;
          }

          // Buscar información del servicio
          const servicio = await Servicio.findById(servicioId);
          
          if (!servicio) {
            console.log(`  ❌ Servicio no encontrado: ${servicioId}`);
            errores++;
            continue;
          }

          // Crear nuevo registro en BeneficioBeneficiario
          const nuevoBeneficio = new BeneficioBeneficiario({
            beneficiarioId: beneficiario._id,
            servicioId: servicio._id,
            servicioNombre: servicio.nombre,
            estado: 'activo', // Asumir que servicios existentes están activos
            fecha_activacion: beneficiario.fecha_creacion || new Date('2024-01-01'),
            creado_por: beneficiario.usuario_id || new mongoose.Types.ObjectId(),
            actualizado_por: beneficiario.usuario_id || new mongoose.Types.ObjectId(),
            
            // Configuración inicial según tipo de servicio
            ...(servicio.nombre.toLowerCase().includes('voucher') || 
               servicio.nombre.toLowerCase().includes('certificado') ? {
              voucher_data: {
                saldo_actual: 500,
                vouchers_usados: 0,
                renovaciones_utilizadas: 0,
                proxima_renovacion_disponible: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // +1 año
              }
            } : {}),
            
            ...(servicio.nombre.toLowerCase().includes('reembolso') ? {
              reembolso_data: {
                monto_a_reembolsar: 10000, // Valor por defecto
                prima_pagada: 575, // 5.75% de 10000
                estado_prima: 'pagada'
              }
            } : {}),
            
            ...(servicio.nombre.toLowerCase().includes('financiamiento') ? {
              financiamiento_data: {
                monto_financiado: 5000, // Valor por defecto
                monto_con_intereses: 5350, // +7%
                saldo_actual: 5350,
                mensualidades_pagadas: 0,
                valor_mensualidad: 891.67, // 5350/6
                proxima_mensualidad: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
              }
            } : {}),

            // Historial inicial
            historial_estados: [{
              estado_anterior: 'pendiente_activacion',
              estado_nuevo: 'activo',
              fecha_cambio: beneficiario.fecha_creacion || new Date('2024-01-01'),
              motivo: 'Migración automática desde servicios existentes',
              procesado_por: beneficiario.usuario_id || new mongoose.Types.ObjectId()
            }]
          });

          await nuevoBeneficio.save();
          migrados++;
          
          console.log(`  ✅ Migrado: ${servicio.nombre}`);

        } catch (error) {
          console.log(`  ❌ Error migrando servicio ${servicioId}:`, error.message);
          errores++;
        }
      }

      console.log(''); // Línea en blanco para separar beneficiarios
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    return { migrados, errores, beneficiariosProcessed, duplicados };
  }

  return { migrados, errores, beneficiariosProcessed, duplicados };
}

async function verificarMigracion() {
  console.log('\n=== VERIFICACIÓN POST-MIGRACIÓN ===');
  
  const beneficiosCreados = await BeneficioBeneficiario.countDocuments({});
  console.log(`Total beneficios en BeneficioBeneficiario: ${beneficiosCreados}`);
  
  // Verificar algunos ejemplos
  const ejemplos = await BeneficioBeneficiario.find({})
    .populate('beneficiarioId', 'nombre apellido')
    .populate('servicioId', 'nombre')
    .limit(5);
  
  console.log('\nEjemplos de beneficios migrados:');
  ejemplos.forEach((beneficio, index) => {
    console.log(`${index + 1}. ${beneficio.beneficiarioId?.nombre} ${beneficio.beneficiarioId?.apellido} -> ${beneficio.servicioNombre} (${beneficio.estado})`);
  });

  // Estadísticas por estado
  const estadisticas = await BeneficioBeneficiario.aggregate([
    {
      $group: {
        _id: '$estado',
        count: { $sum: 1 }
      }
    }
  ]);
  
  console.log('\nDistribución por estado:');
  estadisticas.forEach(stat => {
    console.log(`${stat._id}: ${stat.count}`);
  });
}

async function ejecutarMigracion() {
  console.log('🚀 INICIANDO SCRIPT DE MIGRACIÓN DE BENEFICIOS');
  console.log('='.repeat(60));
  
  try {
    // Conectar a la base de datos
    await conectarDB();
    
    // Verificar datos existentes
    const verificacion = await verificarDatosExistentes();
    
    if (verificacion.beneficiariosConServicios === 0) {
      console.log('⚠️ No hay beneficiarios con servicios para migrar');
      return;
    }
    
    if (verificacion.beneficiosExistentes > 0) {
      console.log(`⚠️ Ya existen ${verificacion.beneficiosExistentes} registros en BeneficioBeneficiario`);
      console.log('La migración continuará y omitirá duplicados');
    }
    
    // Confirmar migración
    console.log('\n¿Continuar con la migración? (Presiona Ctrl+C para cancelar)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ejecutar migración
    const resultado = await migrarBeneficios();
    
    // Mostrar resultados
    console.log('\n=== RESULTADOS DE LA MIGRACIÓN ===');
    console.log(`Beneficiarios procesados: ${resultado.beneficiariosProcessed}`);
    console.log(`Beneficios migrados: ${resultado.migrados}`);
    console.log(`Duplicados omitidos: ${resultado.duplicados}`);
    console.log(`Errores: ${resultado.errores}`);
    
    if (resultado.migrados > 0) {
      await verificarMigracion();
    }
    
    console.log('\n✅ MIGRACIÓN COMPLETADA');
    
  } catch (error) {
    console.error('❌ Error fatal durante la migración:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
    process.exit(0);
  }
}

// Ejecutar el script
ejecutarMigracion();