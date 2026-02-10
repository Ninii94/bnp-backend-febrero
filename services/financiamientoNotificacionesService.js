import Financiamiento from '../models/Financiamiento.js';
import { Beneficiario } from '../models/Beneficiario.js';
import emailjs from '@emailjs/nodejs';

// ===== CONFIGURACIÓN DE EMAILJS PARA FINANCIAMIENTOS =====
const EMAILJS_CONFIG = {
  serviceId: 'service_kxb9m4s',      
  templateId: 'template_jx9ki4h',    
  publicKey: 'YnTJfg1hrkxkj_umn',
  privateKey: 'VlMx2Txj_54mvDOz_xw-f'
};
// ==========================================================

export class FinanciamientoNotificacionesService {
  
  /**
   * Verificar cuotas próximas a vencer (ejecutar diariamente)
   */
  static async verificarVencimientosProximos() {
    console.log('[NOTIF-FIN] === VERIFICANDO VENCIMIENTOS PRÓXIMOS ===');
    
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      manana.setHours(23, 59, 59, 999);

      const financiamientos = await Financiamiento.find({
        estadoGeneral: 'Activo'
      }).populate('beneficiario');

      console.log(`[NOTIF-FIN] Financiamientos activos encontrados: ${financiamientos.length}`);

      let notificacionesEnviadas = 0;
      let errores = 0;

      for (const financiamiento of financiamientos) {
        const cuotasProximasAVencer = financiamiento.cuotas.filter(cuota => {
          const fechaVencimiento = new Date(cuota.fechaVencimiento);
          fechaVencimiento.setHours(0, 0, 0, 0);
          
          return (
            cuota.estado !== 'Pagado' &&
            fechaVencimiento.getTime() === manana.getTime()
          );
        });

        if (cuotasProximasAVencer.length > 0) {
          console.log(`[NOTIF-FIN] ${cuotasProximasAVencer.length} cuota(s) por vencer para: ${financiamiento.beneficiario.nombre}`);
          
          for (const cuota of cuotasProximasAVencer) {
            try {
              await this.enviarNotificacionVencimiento(financiamiento, cuota);
              notificacionesEnviadas++;
            } catch (error) {
              console.error(`[NOTIF-FIN] Error enviando notificación:`, error);
              errores++;
            }
          }
        }
      }

      console.log(`[NOTIF-FIN] ✅ Proceso completado: ${notificacionesEnviadas} enviadas, ${errores} errores`);
      
      return {
        success: true,
        notificacionesEnviadas,
        errores
      };

    } catch (error) {
      console.error('[NOTIF-FIN] ❌ Error en verificación:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar notificación de vencimiento individual usando EmailJS
   */
  static async enviarNotificacionVencimiento(financiamiento, cuota) {
    const beneficiario = financiamiento.beneficiario;
    
    console.log(`[NOTIF-FIN] Enviando notificación a: ${beneficiario.correo}`);

    // Obtener usuario para nombre de usuario
    let nombreUsuario = beneficiario.nombre;
    if (beneficiario.usuario_id) {
      try {
        const { Usuario } = await import('../models/Usuario.js');
        const usuario = await Usuario.findById(beneficiario.usuario_id);
        if (usuario) {
          nombreUsuario = usuario.nombre_usuario || beneficiario.nombre;
        }
      } catch (error) {
        console.error('[NOTIF-FIN] Error obteniendo usuario:', error);
      }
    }

    const montoTotal = cuota.monto + (cuota.intereseMoratorio || 0);
    const fechaVencimiento = new Date(cuota.fechaVencimiento);
    const fechaFormateada = fechaVencimiento.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Parámetros para EmailJS
    const templateParams = {
       email: beneficiario.correo,
      beneficiario_nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`,
      fecha_vencimiento: fechaFormateada,
      numero_cuota: cuota.numero,
      total_cuotas: financiamiento.numeroPagos,
      moneda: financiamiento.moneda,
      monto_total: montoTotal.toFixed(2),
      nombre_usuario: nombreUsuario
    };

    try {
      // CAMBIO IMPORTANTE: Usar privateKey en lugar de publicKey
      const response = await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams,
        {
          publicKey: EMAILJS_CONFIG.publicKey,
          privateKey: EMAILJS_CONFIG.privateKey  // ← AGREGAR ESTO
        }
      );

      console.log('[NOTIF-FIN] ✅ Email enviado exitosamente:', response.status);

      // Actualizar última notificación
      if (!financiamiento.notificaciones) {
        financiamiento.notificaciones = {};
      }
      financiamiento.notificaciones.ultimoEnvio = new Date();
      await financiamiento.save();

      console.log(`[NOTIF-FIN] ✅ Notificación enviada a: ${beneficiario.correo}`);
      
    } catch (error) {
      console.error('[NOTIF-FIN] ❌ Error enviando email:', error);
      throw error;
    }
  }

  /**
   * Verificar y notificar cuotas vencidas (con mora)
   */
  static async verificarCuotasVencidas() {
    console.log('[NOTIF-FIN] === VERIFICANDO CUOTAS VENCIDAS ===');
    
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const financiamientos = await Financiamiento.find({
        estadoGeneral: 'Activo'
      }).populate('beneficiario');

      let notificacionesEnviadas = 0;

      for (const financiamiento of financiamientos) {
        const cuotasVencidas = financiamiento.cuotas.filter(cuota => {
          const fechaVencimiento = new Date(cuota.fechaVencimiento);
          fechaVencimiento.setHours(0, 0, 0, 0);
          
          return (
            cuota.estado !== 'Pagado' &&
            fechaVencimiento < hoy
          );
        });

        if (cuotasVencidas.length > 0) {
          cuotasVencidas.forEach(cuota => {
            if (cuota.estado === 'En espera de pago') {
              cuota.estado = 'Moroso';
            }
            
            const diasVencidos = Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24));
            const mesesVencidos = Math.floor(diasVencidos / 30);
            
            if (mesesVencidos > 0) {
              let montoConMora = cuota.monto;
              for (let i = 0; i < mesesVencidos; i++) {
                montoConMora += (montoConMora * (cuota.tasaMoratoria || 3)) / 100;
              }
              cuota.intereseMoratorio = montoConMora - cuota.monto;
            }
          });

          await financiamiento.save();
          notificacionesEnviadas++;
        }
      }

      console.log(`[NOTIF-FIN] ✅ ${notificacionesEnviadas} financiamientos actualizados`);

    } catch (error) {
      console.error('[NOTIF-FIN] ❌ Error verificando vencidas:', error);
    }
  }
}