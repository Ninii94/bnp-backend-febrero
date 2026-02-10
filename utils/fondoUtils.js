import { FondoReintegro } from '../models/FondoReintegro.js';
import cron from 'node-cron';

// Función para crear o activar fondo inicial
export const crearFondoInicial = async (beneficiarioId, usuarioActivador, monto = 500) => {
  try {
    let fondo = await FondoReintegro.findOne({ beneficiario_id: beneficiarioId });
    
    if (!fondo) {
      fondo = new FondoReintegro({
        beneficiario_id: beneficiarioId,
        saldo: monto,
        monto_inicial: monto,
        activado_por: usuarioActivador,
        fecha_aniversario_original: new Date()
      });
      
      fondo.historial_transacciones.push({
        tipo: 'activacion',
        monto: monto,
        saldo_anterior: 0,
        saldo_nuevo: monto,
        motivo: 'Activación inicial del fondo',
        realizado_por: usuarioActivador
      });
      
      await fondo.save();
      console.log(`✅ Fondo inicial creado para beneficiario ${beneficiarioId}`);
    }
    
    return fondo;
  } catch (error) {
    console.error('Error creando fondo inicial:', error);
    throw error;
  }
};

// Función para renovar fondos automáticamente
export const renovarFondosVencidos = async () => {
  try {
    const fechaActual = new Date();
    
    // Buscar fondos que deben renovarse (fecha aniversario)
    const fondosParaRenovar = await FondoReintegro.find({
      activo: true,
      bloqueado: false,
      fecha_aniversario_original: {
        $lte: new Date(fechaActual.getTime() - 365 * 24 * 60 * 60 * 1000) // Hace un año o más
      }
    });
    
    for (const fondo of fondosParaRenovar) {
      // Verificar si ya pasó el aniversario
      const proximoAniversario = new Date(fondo.fecha_aniversario_original);
      proximoAniversario.setFullYear(fechaActual.getFullYear());
      
      if (fechaActual >= proximoAniversario) {
        fondo.renovarAnual();
        await fondo.save();
        console.log(`📅 Fondo renovado para beneficiario ${fondo.beneficiario_id}`);
      }
    }
    
    console.log(`✅ Proceso de renovación completado. ${fondosParaRenovar.length} fondos procesados`);
  } catch (error) {
    console.error('Error en renovación automática:', error);
  }
};

// Función para notificar fondos próximos a vencer
export const notificarFondosProximosAVencer = async () => {
  try {
    const fondos = await FondoReintegro.find({
      activo: true,
      bloqueado: false
    }).populate('beneficiario_id', 'nombre apellido correo');
    
    const fondosProximosAVencer = fondos.filter(fondo => fondo.proximoAVencer());
    
    for (const fondo of fondosProximosAVencer) {
      // Aquí podrías implementar envío de emails o notificaciones
      console.log(`⚠️ Fondo próximo a vencer: ${fondo.beneficiario_id.nombre} ${fondo.beneficiario_id.apellido}`);
      
      // Ejemplo de estructura para notificación:
      const notificacion = {
        destinatario: fondo.beneficiario_id.correo,
        asunto: 'Tu servicio de certificados aéreos vence pronto',
        mensaje: `Hola ${fondo.beneficiario_id.nombre}, tu servicio vence el ${fondo.fecha_expiracion.toLocaleDateString()}. Saldo restante: ${fondo.saldo}`,
        tipo: 'vencimiento_proximo'
      };
      
      // Implementar envío de notificación aquí
      // await enviarNotificacion(notificacion);
    }
    
    console.log(`📧 ${fondosProximosAVencer.length} notificaciones de vencimiento enviadas`);
  } catch (error) {
    console.error('Error enviando notificaciones:', error);
  }
};

// Programar tareas automáticas
export const iniciarTareasAutomaticas = () => {
  // Renovar fondos diariamente a las 2:00 AM
  cron.schedule('0 2 * * *', () => {
    console.log('🔄 Ejecutando renovación automática de fondos...');
    renovarFondosVencidos();
  });
  
  // Notificar fondos próximos a vencer diariamente a las 9:00 AM
  cron.schedule('0 9 * * *', () => {
    console.log('📬 Enviando notificaciones de vencimiento...');
    notificarFondosProximosAVencer();
  });
  
  console.log('⏰ Tareas automáticas configuradas');
};

// Exportar utilidades
export default {
  crearFondoInicial,
  renovarFondosVencidos,
  notificarFondosProximosAVencer,
  iniciarTareasAutomaticas
};

// utils/validadores.js - VALIDADORES PARA EL SISTEMA
export const validarMedioPago = (datos) => {
  const { tipo, nombre_metodo, detalles } = datos;
  
  if (!tipo || !nombre_metodo) {
    return { valido: false, error: 'Tipo y nombre son requeridos' };
  }
  
  const tiposValidos = ['tarjeta_credito', 'tarjeta_debito', 'transferencia_bancaria', 'paypal', 'otro'];
  if (!tiposValidos.includes(tipo)) {
    return { valido: false, error: 'Tipo de medio de pago inválido' };
  }
  
  // Validaciones específicas por tipo
  switch (tipo) {
    case 'tarjeta_credito':
    case 'tarjeta_debito':
      if (!detalles?.numero_tarjeta || !detalles?.nombre_titular) {
        return { valido: false, error: 'Número de tarjeta y titular son requeridos' };
      }
      break;
      
    case 'transferencia_bancaria':
      if (!detalles?.nombre_banco || !detalles?.numero_cuenta) {
        return { valido: false, error: 'Banco y número de cuenta son requeridos' };
      }
      break;
      
    case 'paypal':
      if (!detalles?.email_paypal) {
        return { valido: false, error: 'Email de PayPal es requerido' };
      }
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(detalles.email_paypal)) {
        return { valido: false, error: 'Email de PayPal inválido' };
      }
      break;
  }
  
  return { valido: true };
};

export const validarSolicitudCertificado = (datos, fondo) => {
  const { tipo_reintegro, monto_original, monto_solicitado } = datos;
  
  if (!tipo_reintegro || !monto_original) {
    return { valido: false, error: 'Tipo de reintegro y monto original son requeridos' };
  }
  
  if (!['100%', 'parcial'].includes(tipo_reintegro)) {
    return { valido: false, error: 'Tipo de reintegro inválido' };
  }
  
  const montoOriginal = parseFloat(monto_original);
  if (isNaN(montoOriginal) || montoOriginal <= 0) {
    return { valido: false, error: 'Monto original debe ser un número positivo' };
  }
  
  let montoFinal = montoOriginal;
  if (tipo_reintegro === 'parcial') {
    if (!monto_solicitado) {
      return { valido: false, error: 'Monto solicitado es requerido para reintegro parcial' };
    }
    montoFinal = parseFloat(monto_solicitado);
    if (isNaN(montoFinal) || montoFinal <= 0) {
      return { valido: false, error: 'Monto solicitado debe ser un número positivo' };
    }
    if (montoFinal > montoOriginal) {
      return { valido: false, error: 'Monto solicitado no puede exceder el monto original' };
    }
  }
  
  // Validar contra el fondo
  if (fondo) {
    if (fondo.bloqueado) {
      return { valido: false, error: 'Tu servicio está bloqueado', codigo: 'SERVICIO_BLOQUEADO' };
    }
    
    if (!fondo.activo || fondo.estaVencido()) {
      return { valido: false, error: 'Tu servicio no está activo o ha vencido', codigo: 'SERVICIO_NO_ACTIVO' };
    }
    
    if (fondo.saldo < montoFinal) {
      return { 
        valido: false, 
        error: `Saldo insuficiente. Disponible: ${fondo.saldo.toFixed(2)}`, 
        codigo: 'SALDO_INSUFICIENTE' 
      };
    }
  }
  
  return { valido: true, monto_final: montoFinal };
};

// Función para limpiar datos sensibles antes de enviar al frontend
export const limpiarDatosSensibles = (datos) => {
  if (Array.isArray(datos)) {
    return datos.map(item => limpiarDatosSensibles(item));
  }
  
  if (typeof datos === 'object' && datos !== null) {
    const datosLimpios = { ...datos };
    
    // Eliminar campos sensibles
    delete datosLimpios.password;
    delete datosLimpios.__v;
    
    // Limpiar datos de medios de pago
    if (datosLimpios.detalles && datosLimpios.tipo) {
      if (datosLimpios.tipo.includes('tarjeta')) {
        // Solo mostrar últimos 4 dígitos de tarjetas
        if (datosLimpios.detalles.numero_tarjeta && datosLimpios.detalles.numero_tarjeta.length > 4) {
          datosLimpios.detalles.numero_tarjeta = '****' + datosLimpios.detalles.numero_tarjeta.slice(-4);
        }
      }
      if (datosLimpios.tipo === 'transferencia_bancaria') {
        // Enmascarar número de cuenta
        if (datosLimpios.detalles.numero_cuenta && datosLimpios.detalles.numero_cuenta.length > 4) {
          const cuenta = datosLimpios.detalles.numero_cuenta;
          datosLimpios.detalles.numero_cuenta = cuenta.slice(0, 2) + '****' + cuenta.slice(-2);
        }
      }
    }
    
    return datosLimpios;
  }
  
  return datos;
};