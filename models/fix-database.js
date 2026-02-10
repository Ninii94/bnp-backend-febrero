// fix-database.js - Guardar como archivo separado y ejecutar con Node.js
import mongoose from 'mongoose';
import { Beneficiario } from './models/Beneficiario.js';

async function fixDatabase() {
  try {
    console.log('Conectando a la base de datos...');
    // Usar tu cadena de conexión real
    await mongoose.connect('mongodb://localhost:27017/bnp_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conexión exitosa a la base de datos');
    
    // Paso 1: Intentar eliminar los índices problemáticos
    try {
      console.log('Intentando eliminar el índice llave_unica_1...');
      await mongoose.connection.db.collection('beneficiarios').dropIndex('llave_unica_1');
      console.log('Índice llave_unica_1 eliminado correctamente');
    } catch (error) {
      console.log('No se pudo eliminar el índice llave_unica_1 o no existe:', error.message);
    }
    
    try {
      console.log('Intentando eliminar el índice codigo.value_1...');
      await mongoose.connection.db.collection('beneficiarios').dropIndex('codigo.value_1');
      console.log('Índice codigo.value_1 eliminado correctamente');
    } catch (error) {
      console.log('No se pudo eliminar el índice codigo.value_1 o no existe:', error.message);
    }
    
    // Paso 2: Ejecutar el método de sincronización
    console.log('Sincronizando campos llave_unica y codigo.value en todos los registros...');
    const resultado = await Beneficiario.sincronizarCodigosLlaves();
    console.log(resultado);
    
    // Paso 3: Crear nuevos índices sparse (que ignoran documentos con campos nulos o no existentes)
    console.log('Creando nuevos índices con propiedad sparse=true...');
    
    await mongoose.connection.db.collection('beneficiarios').createIndex(
      { llave_unica: 1 }, 
      { unique: true, sparse: true, name: 'llave_unica_1_sparse' }
    );
    console.log('Índice llave_unica_1_sparse creado correctamente');
    
    await mongoose.connection.db.collection('beneficiarios').createIndex(
      { 'codigo.value': 1 }, 
      { unique: true, sparse: true, name: 'codigo_value_1_sparse' }
    );
    console.log('Índice codigo_value_1_sparse creado correctamente');
    
    console.log('Verificando índices existentes...');
    const indexes = await mongoose.connection.db.collection('beneficiarios').indexes();
    console.log('Índices actuales:', indexes);
    
    console.log('Proceso completado exitosamente');
  } catch (error) {
    console.error('Error durante la corrección de la base de datos:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de la base de datos');
  }
}

// Ejecutar la función
fixDatabase();