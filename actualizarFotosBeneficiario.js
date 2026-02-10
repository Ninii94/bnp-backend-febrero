// Script para actualizar beneficiarios con fotos sin ruta
// Este script agrega las rutas faltantes a las fotos de identificación

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Definir el esquema directamente en el script para evitar problemas de importación
const beneficiarioSchema = new mongoose.Schema({}, { strict: false });
const Beneficiario = mongoose.model('Beneficiario', beneficiarioSchema);

const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;

async function actualizarFotosBeneficiarios() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar beneficiarios con fotos sin ruta
    const beneficiariosConFotos = await Beneficiario.find({
      $or: [
        { 'foto_identificacion_beneficiario.nombre': { $exists: true } },
        { 'foto_identificacion_pareja.nombre': { $exists: true } }
      ]
    });

    console.log(`\n📊 Encontrados ${beneficiariosConFotos.length} beneficiarios con fotos`);

    let actualizados = 0;
    let sinCambios = 0;

    for (const beneficiario of beneficiariosConFotos) {
      let necesitaActualizar = false;

      // Verificar foto del beneficiario
      if (beneficiario.foto_identificacion_beneficiario?.nombre && 
          !beneficiario.foto_identificacion_beneficiario.ruta) {
        
        // Construir la ruta basada en el nombre del archivo
        const nombre = beneficiario.foto_identificacion_beneficiario.nombre;
        beneficiario.foto_identificacion_beneficiario.ruta = 
          `${CLOUDINARY_BASE_URL}beneficiarios/identificacion/${nombre}`;
        
        console.log(`  📸 Agregando ruta a foto de beneficiario ${beneficiario.nombre}`);
        necesitaActualizar = true;
      }

      // Verificar foto de pareja
      if (beneficiario.foto_identificacion_pareja?.nombre && 
          !beneficiario.foto_identificacion_pareja.ruta) {
        
        const nombre = beneficiario.foto_identificacion_pareja.nombre;
        beneficiario.foto_identificacion_pareja.ruta = 
          `${CLOUDINARY_BASE_URL}beneficiarios/parejas/${nombre}`;
        
        console.log(`  💑 Agregando ruta a foto de pareja de ${beneficiario.nombre}`);
        necesitaActualizar = true;
      }

      if (necesitaActualizar) {
        await beneficiario.save();
        actualizados++;
        console.log(`  ✅ Beneficiario ${beneficiario.nombre} actualizado\n`);
      } else {
        sinCambios++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMEN:');
    console.log('='.repeat(60));
    console.log(`  ✅ Beneficiarios actualizados: ${actualizados}`);
    console.log(`  ℹ️  Sin cambios necesarios: ${sinCambios}`);
    console.log(`  📊 Total procesados: ${beneficiariosConFotos.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Desconectado de MongoDB');
  }
}

// Ejecutar el script
actualizarFotosBeneficiarios();