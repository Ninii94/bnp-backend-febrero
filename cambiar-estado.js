// cambiar-estado-beneficios.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { BeneficioBeneficiario } from './models/BeneficioBeneficiario.js';

dotenv.config();

async function cambiarEstadoBeneficios() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Cambiar todos los beneficios activos a pendiente_activacion
    const resultado = await BeneficioBeneficiario.updateMany(
      { estado: 'activo' },
      { 
        $set: { 
          estado: 'pendiente_activacion',
          fecha_activacion: null
        }
      }
    );
    
    console.log(`✅ Cambiados ${resultado.modifiedCount} beneficios a pendiente_activacion`);
    
    // Verificar el cambio
    const pendientes = await BeneficioBeneficiario.countDocuments({ estado: 'pendiente_activacion' });
    const activos = await BeneficioBeneficiario.countDocuments({ estado: 'activo' });
    
    console.log(`Pendientes de activación: ${pendientes}`);
    console.log(`Activos: ${activos}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
    process.exit(0);
  }
}

cambiarEstadoBeneficios();