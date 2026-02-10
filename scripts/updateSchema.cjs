// Versión CommonJS del script updateSchema para mayor compatibilidad
// Guarda este archivo como updateSchema.cjs y ejecútalo con node

const mongoose = require('mongoose');

// ========= CONFIGURACIÓN =========
// Reemplaza esto con tu cadena de conexión a MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/bnp_db';
// =================================

// Conectar a MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
  updateSchema();
}).catch(err => {
  console.error('Error al conectar a MongoDB:', err);
  process.exit(1);
});

// Definir el esquema de Beneficiario si no está registrado
let Beneficiario;
try {
  // Intenta obtener el modelo existente
  Beneficiario = mongoose.model('Beneficiario');
} catch (e) {
  // Si no existe, crea un modelo básico para la migración
  console.log('Creando modelo de Beneficiario para migración...');
  const beneficiarioSchema = new mongoose.Schema({
    // Campos mínimos necesarios
    nombre: String,
    apellido: String,
    genero: String,
    estado_civil: String,
    telefono: String,
    nacionalidad: String,
    direccion: String,
    // Los nuevos campos a añadir
    fecha_nacimiento: Date,
    pais: String,
    estado_provincia: String,
    ciudad: String
  }, { 
    strict: false // Para permitir otros campos que no estén definidos en el esquema
  });
  
  Beneficiario = mongoose.model('Beneficiario', beneficiarioSchema);
}

async function updateSchema() {
  try {
    // 1. Verificar el esquema actual
    console.log('Verificando esquema actual...');
    console.log('Campos en el esquema:');
    Object.keys(Beneficiario.schema.paths).forEach(path => {
      console.log(`- ${path}: ${Beneficiario.schema.paths[path].instance}`);
    });
    
    const hasFechaNacimiento = 'fecha_nacimiento' in Beneficiario.schema.paths;
    const hasPais = 'pais' in Beneficiario.schema.paths;
    const hasEstadoProvincia = 'estado_provincia' in Beneficiario.schema.paths;
    const hasCiudad = 'ciudad' in Beneficiario.schema.paths;
    
    console.log('\nVerificación de campos nuevos:');
    console.log('- fecha_nacimiento:', hasFechaNacimiento ? 'SÍ' : 'NO');
    console.log('- pais:', hasPais ? 'SÍ' : 'NO');
    console.log('- estado_provincia:', hasEstadoProvincia ? 'SÍ' : 'NO');
    console.log('- ciudad:', hasCiudad ? 'SÍ' : 'NO');
    
    // 2. Si algunos campos no existen, agregarlos al esquema
    if (!hasFechaNacimiento || !hasPais || !hasEstadoProvincia || !hasCiudad) {
      console.log('\nActualizando esquema con los campos faltantes...');
      
      // Tener en cuenta que esto solo funciona si estamos usando el mismo esquema
      if (!hasFechaNacimiento) {
        Beneficiario.schema.add({
          fecha_nacimiento: { type: Date }
        });
        console.log('- Añadido campo fecha_nacimiento');
      }
      
      if (!hasPais) {
        Beneficiario.schema.add({
          pais: { type: String, trim: true }
        });
        console.log('- Añadido campo pais');
      }
      
      if (!hasEstadoProvincia) {
        Beneficiario.schema.add({
          estado_provincia: { type: String, trim: true }
        });
        console.log('- Añadido campo estado_provincia');
      }
      
      if (!hasCiudad) {
        Beneficiario.schema.add({
          ciudad: { type: String, trim: true }
        });
        console.log('- Añadido campo ciudad');
      }
      
      console.log('\nEsquema actualizado con éxito');
    } else {
      console.log('\nEl esquema ya tiene todos los campos necesarios');
    }
    
    // 3. Actualizar la colección directamente con la API de MongoDB
    console.log('\nActualizando documentos existentes...');
    
    // Obtener el nombre de la colección desde el modelo
    const collectionName = Beneficiario.collection.name;
    console.log(`Nombre de la colección: ${collectionName}`);
    
    // Actualizar usando la API directa de MongoDB
    const updateResult = await mongoose.connection.db.collection(collectionName).updateMany(
      { 
        $or: [
          { pais: { $exists: false } },
          { estado_provincia: { $exists: false } },
          { ciudad: { $exists: false } },
          { fecha_nacimiento: { $exists: false } }
        ]
      },
      { 
        $set: { 
          pais: '',
          estado_provincia: '',
          ciudad: '',
          fecha_nacimiento: null
        } 
      }
    );
    
    console.log(`Documentos actualizados: ${updateResult.modifiedCount} de ${updateResult.matchedCount}`);
    
    // 4. Verificar un documento de ejemplo
    const ejemplo = await Beneficiario.findOne();
    
    if (ejemplo) {
      console.log('\nDocumento de ejemplo actualizado:');
      console.log('- _id:', ejemplo._id);
      console.log('- nombre:', ejemplo.nombre);
      console.log('- apellido:', ejemplo.apellido);
      console.log('- fecha_nacimiento:', ejemplo.fecha_nacimiento);
      console.log('- pais:', ejemplo.pais);
      console.log('- estado_provincia:', ejemplo.estado_provincia);
      console.log('- ciudad:', ejemplo.ciudad);
    } else {
      console.log('\nNo se encontraron documentos en la colección');
    }
    
    console.log('\n¡Migración completada con éxito!');
    
    // Desconectar de MongoDB
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la actualización del esquema:', error);
    // Intentar desconectar
    try {
      await mongoose.disconnect();
      console.log('Desconectado de MongoDB');
    } catch (disconnectError) {
      console.error('Error al desconectar de MongoDB:', disconnectError);
    }
    process.exit(1);
  }
}