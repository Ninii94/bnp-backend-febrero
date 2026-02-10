// scripts/migrarFinanciamientos.js
// Script para migrar financiamientos existentes al nuevo formato con desglose

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Financiamiento from '../models/Financiamiento.js';

// Cargar variables de entorno
dotenv.config();

async function migrarFinanciamientos() {
  try {
    console.log('🔄 Iniciando migración de financiamientos...');

    // Conectar a la base de datos
    console.log('📡 Conectando a MongoDB...');
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bnp';
    
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado a MongoDB exitosamente');

    const financiamientos = await Financiamiento.find({});
    console.log(`📊 Total de financiamientos encontrados: ${financiamientos.length}`);

    if (financiamientos.length === 0) {
      console.log('⚠️  No hay financiamientos para migrar');
      return;
    }

    let actualizados = 0;
    let errores = 0;

    for (const financiamiento of financiamientos) {
      try {
        let necesitaActualizacion = false;

        // Verificar si el financiamiento necesita migración
        const cuotasSinDesglose = financiamiento.cuotas.filter(c => 
          !c.montoPrincipal || !c.montoInteres
        );

        if (cuotasSinDesglose.length > 0) {
          console.log(`\n📝 Migrando financiamiento ${financiamiento._id}`);
          console.log(`   Beneficiario: ${financiamiento.beneficiario}`);
          console.log(`   Cuotas sin desglose: ${cuotasSinDesglose.length}`);

          // Calcular el desglose por cuota
          const montoIntereses = financiamiento.montoIntereses || 
            (financiamiento.montoFinanciado * financiamiento.tasaInteres / 100);
          
          const capitalPorCuota = financiamiento.montoFinanciado / financiamiento.numeroPagos;
          const interesPorCuota = montoIntereses / financiamiento.numeroPagos;

          console.log(`   Capital por cuota: ${capitalPorCuota.toFixed(2)}`);
          console.log(`   Interés por cuota: ${interesPorCuota.toFixed(2)}`);

          // Actualizar cada cuota
          financiamiento.cuotas.forEach(cuota => {
            if (!cuota.montoPrincipal) {
              cuota.montoPrincipal = capitalPorCuota;
            }
            if (!cuota.montoInteres) {
              cuota.montoInteres = interesPorCuota;
            }

            // Si la cuota ya está pagada pero no tiene desglose, asignarlo
            if (cuota.estado === 'Pagado') {
              if (!cuota.montoPrincipalPagado) {
                cuota.montoPrincipalPagado = capitalPorCuota;
              }
              if (!cuota.montoInteresPagado) {
                cuota.montoInteresPagado = interesPorCuota;
              }
              if (!cuota.montoMoratorioPagado) {
                cuota.montoMoratorioPagado = cuota.intereseMoratorio || 0;
              }
            }
          });

          // Asegurar que tiene montoIntereses
          if (!financiamiento.montoIntereses) {
            financiamiento.montoIntereses = montoIntereses;
          }

          necesitaActualizacion = true;
        }

        // Verificar campos de enganche
        if (!financiamiento.porcentajeEngancheBNP) {
          console.log(`   🔧 Agregando campos de enganche...`);
          financiamiento.porcentajeEngancheBNP = 20;
          financiamiento.montoEngancheBNP = financiamiento.montoFinanciado;
          financiamiento.porcentajeEngancheBeneficiario = 10;
          financiamiento.montoEngancheBeneficiario = 
            (financiamiento.costoMembresia + financiamiento.costoContratoCierre) * 0.1;
          necesitaActualizacion = true;
        }

        if (necesitaActualizacion) {
          await financiamiento.save();
          actualizados++;
          console.log(`   ✅ Financiamiento actualizado exitosamente`);
        }

      } catch (error) {
        console.error(`   ❌ Error al migrar financiamiento ${financiamiento._id}:`, error.message);
        errores++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log('='.repeat(60));
    console.log(`Total procesados: ${financiamientos.length}`);
    console.log(`✅ Actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`⏭️  Sin cambios: ${financiamientos.length - actualizados - errores}`);
    console.log('='.repeat(60));

    console.log('\n✨ Migración completada exitosamente');

  } catch (error) {
    console.error('💥 Error fatal en la migración:', error);
    process.exit(1);
  } finally {
    console.log('\n🔌 Cerrando conexión a MongoDB...');
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar la migración
migrarFinanciamientos();

export default migrarFinanciamientos;