// SCRIPT DE LIMPIEZA - Ejecutar una sola vez
// Guarda esto como: server/scripts/limpiar-contratos.js

import mongoose from 'mongoose';
import { ContratoBeneficiario } from './models/ContratoBeneficiario.js';
import dotenv from 'dotenv';

dotenv.config();

async function limpiarContratos() {
  try {
    console.log('🔧 === INICIANDO LIMPIEZA DE CONTRATOS ===');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar contratos con problemas
    console.log('\n1️⃣ Buscando contratos con problemas...');
    
    const contratosEnviados = await ContratoBeneficiario.find({
      estado: 'enviado'
    }).populate('beneficiario_id aliado_id');

    console.log(`   Encontrados ${contratosEnviados.length} contratos enviados`);

    // 2. Revisar cada contrato
    let problemasEncontrados = 0;
    let corregidos = 0;

    for (const contrato of contratosEnviados) {
      const problemas = [];
      
      // Verificar beneficiario
      if (!contrato.beneficiario_id) {
        problemas.push('Beneficiario no existe');
      }
      
      // Verificar aliado
      if (!contrato.aliado_id) {
        problemas.push('Aliado no existe');
      }
      
      // Verificar token
      if (!contrato.token_firma || contrato.token_firma.length < 10) {
        problemas.push('Token inválido');
      }
      
      // Verificar PDF
      if (!contrato.pdf_terminos || !contrato.pdf_terminos.url) {
        problemas.push('PDF faltante');
      }

      if (problemas.length > 0) {
        problemasEncontrados++;
        console.log(`\n   ⚠️ Contrato ${contrato.numero_contrato}:`);
        problemas.forEach(p => console.log(`      - ${p}`));
        
        // OPCIÓN A: Mover a estado borrador para reenviar
        console.log('      🔄 Moviendo a borrador para reenvío...');
        contrato.estado = 'borrador';
        contrato.token_firma = null;
        contrato.fecha_envio = null;
        await contrato.save();
        corregidos++;
        console.log('      ✅ Corregido - listo para reenviar');
      }
    }

    console.log('\n📊 === RESUMEN ===');
    console.log(`   Total contratos revisados: ${contratosEnviados.length}`);
    console.log(`   Problemas encontrados: ${problemasEncontrados}`);
    console.log(`   Contratos corregidos: ${corregidos}`);
    
    if (corregidos > 0) {
      console.log('\n✅ Los contratos corregidos están ahora en estado "borrador"');
      console.log('   Puedes reenviarlos desde el panel de aliado');
    }

    // 3. Listar contratos enviados válidos
    console.log('\n2️⃣ Contratos enviados válidos:');
    const contratosValidos = await ContratoBeneficiario.find({
      estado: 'enviado',
      token_firma: { $exists: true, $ne: null }
    }).populate('beneficiario_id', 'nombre apellido correo');

    for (const contrato of contratosValidos) {
      console.log(`\n   ✅ ${contrato.numero_contrato}`);
      console.log(`      Beneficiario: ${contrato.beneficiario_id?.nombre} ${contrato.beneficiario_id?.apellido}`);
      console.log(`      Email: ${contrato.beneficiario_id?.correo}`);
      console.log(`      Token: ${contrato.token_firma}`);
      console.log(`      Link: http://localhost:5173/firmar-contrato-beneficiario/${contrato.token_firma}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    process.exit(1);
  }
}

// Ejecutar
limpiarContratos();