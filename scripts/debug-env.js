// debug-env.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== DEBUG DE VARIABLES DE ENTORNO ===');

// 1. Verificar ubicación actual
console.log('\n1. UBICACIÓN ACTUAL:');
console.log('Directorio actual:', process.cwd());
console.log('Directorio del script:', __dirname);

// 2. Buscar archivos .env
console.log('\n2. BUSCANDO ARCHIVOS .env:');
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '../..', '.env')
];

possibleEnvPaths.forEach((envPath, index) => {
  const exists = fs.existsSync(envPath);
  console.log(`${index + 1}. ${envPath} - ${exists ? '✅ EXISTE' : '❌ NO EXISTE'}`);
  
  if (exists) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      console.log(`   Contenido (${lines.length} líneas):`);
      lines.forEach(line => {
        const [key] = line.split('=');
        console.log(`   - ${key}`);
      });
    } catch (error) {
      console.log(`   Error leyendo archivo: ${error.message}`);
    }
  }
});

// 3. Variables de entorno actuales
console.log('\n3. VARIABLES DE ENTORNO ACTUALES:');
const cloudinaryVars = Object.keys(process.env).filter(key => key.startsWith('CLOUDINARY'));
if (cloudinaryVars.length > 0) {
  cloudinaryVars.forEach(key => {
    console.log(`${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
  });
} else {
  console.log('❌ No se encontraron variables CLOUDINARY_*');
}

// 4. Test manual de carga
console.log('\n4. TEST MANUAL DE CARGA:');
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('Contenido completo del .env:');
    console.log(content);
  }
} catch (error) {
  console.log('Error:', error.message);
}