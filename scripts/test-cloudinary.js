// test-cloudinary.js
// Ejecutar con: node test-cloudinary.js

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Función de test
async function testCloudinary() {
  console.log('=== INICIANDO TEST DE CLOUDINARY ===');
  
  // 1. Verificar variables de entorno
  console.log('\n1. VERIFICANDO VARIABLES DE ENTORNO:');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
  console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.log('❌ ERROR: Faltan variables de entorno de Cloudinary');
    return;
  }
  
  // 2. Configurar Cloudinary
  console.log('\n2. CONFIGURANDO CLOUDINARY:');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  
  const config = cloudinary.config();
  console.log('Config aplicada:', {
    cloud_name: config.cloud_name,
    api_key: config.api_key ? 'SET' : 'NOT SET',
    api_secret: config.api_secret ? 'SET' : 'NOT SET'
  });
  
  // 3. Test de imagen simple
  console.log('\n3. TEST DE IMAGEN SIMPLE:');
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  try {
    console.log('Subiendo imagen de prueba...');
    const result = await cloudinary.uploader.upload(testBase64, {
      folder: 'test',
      public_id: `test_${Date.now()}`
    });
    
    console.log('✅ SUCCESS: Imagen subida correctamente');
    console.log('URL:', result.secure_url);
    console.log('Public ID:', result.public_id);
    
    // 4. Test con imagen más realista
    console.log('\n4. TEST CON IMAGEN JPEG SIMULADA:');
    const jpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    
    const jpegResult = await cloudinary.uploader.upload(jpegBase64, {
      folder: 'beneficiarios/test',
      public_id: `jpeg_test_${Date.now()}`,
      transformation: [
        {
          width: 800,
          height: 600,
          crop: 'limit',
          quality: 'auto:good',
          format: 'jpg'
        }
      ]
    });
    
    console.log('✅ SUCCESS: Imagen JPEG subida correctamente');
    console.log('URL:', jpegResult.secure_url);
    console.log('Public ID:', jpegResult.public_id);
    
    console.log('\n=== TEST COMPLETADO EXITOSAMENTE ===');
    console.log('Cloudinary está funcionando correctamente en tu entorno.');
    
  } catch (error) {
    console.log('\n❌ ERROR EN TEST:');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    
    if (error.error) {
      console.log('Cloudinary error details:', error.error);
    }
    
    if (error.http_code) {
      console.log('HTTP status code:', error.http_code);
    }
    
    console.log('Stack trace:', error.stack);
  }
}

// Ejecutar test
testCloudinary().catch(console.error);