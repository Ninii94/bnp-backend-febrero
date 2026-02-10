import mongoose from 'mongoose';

// Script de actualización masiva - MÁS RÁPIDO
// Actualiza todos los beneficiarios de una vez

async function actualizarBeneficiariosMasivo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'tu_connection_string_aqui');
    
    console.log('🚀 Iniciando actualización masiva...');
    
    // Actualizar todos los usuarios tipo beneficiario de una sola vez
    const resultado = await mongoose.connection.db.collection('usuarios').updateMany(
      {
        tipo: 'beneficiario',
        $or: [
          { bienvenida_completada: { $ne: true } },
          { bienvenida_completada: { $exists: false } }
        ]
      },
      {
        $set: {
          bienvenida_completada: true,
          'opciones_bienvenida.opcion_seleccionada': 'estoy_bien',
          'opciones_bienvenida.fecha_completada': new Date()
        }
      }
    );
    
    console.log(`✅ Actualización completada:`);
    console.log(`   - Documentos encontrados: ${resultado.matchedCount}`);
    console.log(`   - Documentos modificados: ${resultado.modifiedCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado');
  }
}

actualizarBeneficiariosMasivo();