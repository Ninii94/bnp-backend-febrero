// Script de diagnóstico - Verificar beneficiario en MongoDB
// Ejecutar: node verificar_beneficiario.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const beneficiarioSchema = new mongoose.Schema({}, { strict: false });
const Beneficiario = mongoose.model('Beneficiario', beneficiarioSchema);

async function verificarBeneficiario() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Buscar el beneficiario específico
    const beneficiarioId = '693b403a8585faefb3c99862';
    
    console.log(`📋 Buscando beneficiario: ${beneficiarioId}\n`);
    
    const beneficiario = await Beneficiario.findById(beneficiarioId).lean();
    
    if (!beneficiario) {
      console.log('❌ Beneficiario no encontrado');
      return;
    }
    
    console.log('✅ Beneficiario encontrado\n');
    
    console.log('='.repeat(60));
    console.log('📊 INFORMACIÓN DEL BENEFICIARIO');
    console.log('='.repeat(60));
    
    console.log('\n🧑 DATOS BÁSICOS:');
    console.log(`  Nombre: ${beneficiario.nombre} ${beneficiario.apellido}`);
    console.log(`  Correo: ${beneficiario.correo}`);
    console.log(`  Teléfono: ${beneficiario.telefono}`);
    console.log(`  Idioma: ${beneficiario.idioma_preferencia}`);
    
    console.log('\n💑 PAREJA:');
    if (beneficiario.pareja) {
      console.log('  Estructura completa:', JSON.stringify(beneficiario.pareja, null, 2));
      console.log(`  Nombre: ${beneficiario.pareja.nombre || 'NO TIENE'}`);
      console.log(`  Apellido: ${beneficiario.pareja.apellido || 'NO TIENE'}`);
      console.log(`  Correo: ${beneficiario.pareja.correo || 'NO TIENE'}`);
      console.log(`  Teléfono: ${beneficiario.pareja.telefono || 'NO TIENE'}`);
      console.log(`  nombre_completo: ${beneficiario.pareja.nombre_completo || 'NO TIENE'}`);
    } else {
      console.log('  ❌ Sin información de pareja');
    }
    
    console.log('\n📸 FOTO BENEFICIARIO:');
    if (beneficiario.foto_identificacion_beneficiario) {
      console.log('  Estructura completa:', JSON.stringify(beneficiario.foto_identificacion_beneficiario, null, 2));
      console.log(`  Nombre: ${beneficiario.foto_identificacion_beneficiario.nombre || 'NO TIENE'}`);
      console.log(`  Ruta: ${beneficiario.foto_identificacion_beneficiario.ruta || '❌ NO TIENE RUTA'}`);
      console.log(`  Tipo: ${beneficiario.foto_identificacion_beneficiario.tipo || 'NO TIENE'}`);
      console.log(`  Tamaño: ${beneficiario.foto_identificacion_beneficiario.tamaño || 'NO TIENE'}`);
      console.log(`  public_id: ${beneficiario.foto_identificacion_beneficiario.public_id || 'NO TIENE'}`);
    } else {
      console.log('  ❌ Sin foto de beneficiario');
    }
    
    console.log('\n📸 FOTO PAREJA:');
    if (beneficiario.foto_identificacion_pareja) {
      console.log('  Estructura completa:', JSON.stringify(beneficiario.foto_identificacion_pareja, null, 2));
      console.log(`  Nombre: ${beneficiario.foto_identificacion_pareja.nombre || 'NO TIENE'}`);
      console.log(`  Ruta: ${beneficiario.foto_identificacion_pareja.ruta || '❌ NO TIENE RUTA'}`);
      console.log(`  Tipo: ${beneficiario.foto_identificacion_pareja.tipo || 'NO TIENE'}`);
      console.log(`  Tamaño: ${beneficiario.foto_identificacion_pareja.tamaño || 'NO TIENE'}`);
      console.log(`  public_id: ${beneficiario.foto_identificacion_pareja.public_id || 'NO TIENE'}`);
    } else {
      console.log('  ❌ Sin foto de pareja');
    }
    
    console.log('\n🏢 UBICACIÓN:');
    console.log(`  Sucursal: ${beneficiario.sucursal || 'NO TIENE'}`);
    console.log(`  Aliado ID: ${beneficiario.aliado_id || 'NO TIENE'}`);
    
    console.log('\n📅 FECHAS:');
    console.log(`  Creado: ${beneficiario.createdAt || beneficiario.fecha_creacion}`);
    console.log(`  Actualizado: ${beneficiario.updatedAt}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNÓSTICO COMPLETO');
    console.log('='.repeat(60));
    
    // Verificar si las fotos tienen ruta
    const fotoBeneRuta = beneficiario.foto_identificacion_beneficiario?.ruta;
    const fotoParejaRuta = beneficiario.foto_identificacion_pareja?.ruta;
    
    console.log('\n🔍 RESUMEN:');
    console.log(`  Pareja tiene nombre: ${beneficiario.pareja?.nombre ? 'SÍ ✅' : 'NO ❌'}`);
    console.log(`  Pareja tiene apellido: ${beneficiario.pareja?.apellido ? 'SÍ ✅' : 'NO ❌'}`);
    console.log(`  Foto beneficiario tiene ruta: ${fotoBeneRuta ? 'SÍ ✅' : 'NO ❌'}`);
    console.log(`  Foto pareja tiene ruta: ${fotoParejaRuta ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (!fotoBeneRuta || !fotoParejaRuta) {
      console.log('\n⚠️  PROBLEMA CONFIRMADO:');
      console.log('   Las fotos NO tienen campo "ruta" en la base de datos.');
      console.log('   Solución: Ejecutar el script actualizar_fotos_beneficiarios.js');
    }
    
    if (!beneficiario.pareja?.nombre && !beneficiario.pareja?.apellido) {
      console.log('\n⚠️  PROBLEMA CONFIRMADO:');
      console.log('   La pareja NO tiene nombre ni apellido, solo correo/teléfono.');
      console.log('   Solución: El backend debe usar correo como fallback en nombre_completo.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Desconectado de MongoDB');
  }
}

verificarBeneficiario();