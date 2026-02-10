// server/migrate-to-atlas.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const localUri = 'mongodb://localhost:27017';
const atlasUri = process.env.MONGODB_URI;
const dbName = 'bnp_db';

async function migrateAllCollections() {
  const localClient = new MongoClient(localUri);
  const atlasClient = new MongoClient(atlasUri);
  
  try {
    console.log('🔄 Conectando a bases de datos...');
    await localClient.connect();
    await atlasClient.connect();
    console.log('✅ Conectado a ambas bases de datos');
    
    const localDb = localClient.db(dbName);
    const atlasDb = atlasClient.db(dbName);
    
    // Obtener todas las colecciones automáticamente
    const collections = await localDb.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    console.log(`📋 Colecciones encontradas: ${collectionNames.join(', ')}`);
    
    for (const collectionName of collectionNames) {
      console.log(`\n🔄 Migrando ${collectionName}...`);
      
      // Obtener datos de local
      const localCollection = localDb.collection(collectionName);
      const documents = await localCollection.find({}).toArray();
      
      if (documents.length > 0) {
        // Insertar en Atlas
        const atlasCollection = atlasDb.collection(collectionName);
        
        // Verificar si la colección ya existe y tiene datos
        const existingCount = await atlasCollection.countDocuments();
        
        if (existingCount > 0) {
          console.log(`⚠️  ${collectionName} ya tiene ${existingCount} documentos. Saltando...`);
          continue;
        }
        
        await atlasCollection.insertMany(documents);
        console.log(`✅ ${documents.length} documentos migrados a ${collectionName}`);
      } else {
        console.log(`⚠️  No hay documentos en ${collectionName}`);
      }
    }
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await localClient.close();
    await atlasClient.close();
    console.log('🔒 Conexiones cerradas');
  }
}

// Ejecutar la migración
migrateAllCollections();