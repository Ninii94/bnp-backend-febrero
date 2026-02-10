import CodigoService from '../services/CodigoService.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Usuario } from '../models/Usuario.js';
 import { BeneficioBeneficiario } from '../models/BeneficioBeneficiario.js';
 import { Servicio } from '../models/Servicio.js';
import { 
    registrarCodigoGenerado, 
  registrarCodigoActivado,
  registrarCodigoReactivado 
} from '../middleware/bitacoraHelpers.js';
class CodigoController {
  // Generar un nuevo código (por pérdida)
  static async generarNuevoCodigo(req, res) {
    try {
      console.log("Solicitud de generación de código recibida:", req.body);
      const { beneficiarioId, motivo } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      // Asegúrate de que motivo sea una cadena y no un objeto
      const motivoString = motivo || 'PERDIDA';
      
      // Pasar una cadena vacía como detalles, no un objeto
      const resultado = await CodigoService.generarNuevoCodigo(
        beneficiarioId, 
        motivoString,
        'Generado por API'
      );
      
      console.log("Código generado exitosamente:", resultado);

      try {
  const beneficiario = await Beneficiario.findById(beneficiarioId);
  await registrarCodigoGenerado({
    beneficiario_nombre: beneficiario.nombre && beneficiario.apellido 
      ? `${beneficiario.nombre} ${beneficiario.apellido}`
      : 'Beneficiario',
    beneficiario_id: beneficiario._id,
    beneficiario_codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
    codigo_generado: resultado.codigo?.value,
    motivo: motivoString,
    monto_reembolso: resultado.codigo?.monto?.valor || 0
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}

      

      res.status(200).json({
        mensaje: 'Código generado exitosamente',
        datos: resultado
      });
    } catch (error) {
      console.error("Error en generarNuevoCodigo:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Crear nuevo código (método administrativo)
  static async crearNuevoCodigo(req, res) {
    try {
      console.log("Solicitud de creación de código recibida:", req.body);
      const { beneficiarioId, motivo, detalles } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      // Pasar una cadena como detalles
      const resultado = await CodigoService.generarNuevoCodigo(
        beneficiarioId, 
        motivo || 'CREACION',
        detalles || 'Creado manualmente por administrador'
      );
      
      console.log("Código creado exitosamente:", resultado);
      
      res.status(200).json({
        mensaje: 'Código creado exitosamente',
        datos: resultado
      });
    } catch (error) {
      console.error("Error en crearNuevoCodigo:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Verificar un código
  static async verificarCodigo(req, res) {
    try {
      console.log("Solicitud de verificación de código recibida:", req.body);
      const { codigo } = req.body;
      
      if (!codigo || typeof codigo !== 'string') {
        return res.status(400).json({ 
          valido: false, 
          mensaje: 'Se requiere un código válido para verificar' 
        });
      }
      
      console.log('Verificando código:', codigo);
      
      // Buscar beneficiario con este código y poblar el usuario_id
      const beneficiario = await Beneficiario.findOne({
        $or: [
          { 'codigo.value': codigo },
          { llave_unica: codigo },
          { codigo: codigo }
        ]
      }).populate('usuario_id');
      
      if (!beneficiario) {
        return res.status(404).json({
          valido: false,
          mensaje: 'El código proporcionado no es válido o no existe'
        });
      }
      
      // Verificar si el código está activo
      if (!beneficiario.codigo?.activo) {
        return res.status(400).json({
          valido: false,
          mensaje: 'El código existe pero no está activo'
        });
      }
      
      // Obtener información del usuario si no se obtuvo con populate
      let nombreUsuario = 'N/A';
      let usuario = null;
      
      if (beneficiario.usuario_id) {
        if (typeof beneficiario.usuario_id === 'object' && beneficiario.usuario_id !== null) {
          // Si ya se pobló con populate
          nombreUsuario = beneficiario.usuario_id.nombre_usuario || 'N/A';
          usuario = beneficiario.usuario_id;
        } else {
          // Si solo tenemos el ID, buscamos el usuario
          try {
            usuario = await Usuario.findById(beneficiario.usuario_id);
            if (usuario) {
              nombreUsuario = usuario.nombre_usuario || 'N/A';
            }
          } catch (error) {
            console.error('Error al obtener usuario:', error);
          }
        }
      }
      
      console.log('Usuario encontrado:', nombreUsuario);
      
      // Calcular el tiempo restante para activación
      let tiempoRestante = 0;
      let estadoActivacion = 'PENDIENTE';
      
      if (beneficiario.codigo?.fecha_activacion) {
        const fechaActivacion = new Date(beneficiario.codigo.fecha_activacion);
        const ahora = new Date();
        
        if (ahora >= fechaActivacion) {
          estadoActivacion = 'ACTIVADO';
          tiempoRestante = 0;
        } else {
          // Calcular días restantes
          const diferenciaMilisegundos = fechaActivacion - ahora;
          tiempoRestante = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
        }
        
        // Verificar si ya está cobrado
        if (beneficiario.codigo?.estado_activacion === 'COBRADO') {
          estadoActivacion = 'COBRADO';
        }
      }
      
      // Crear objeto de respuesta con la estructura que espera el frontend
      const respuesta = {
        valido: true,
        beneficiario: {
          id: beneficiario._id,
          nombre: beneficiario.nombre || '',
          usuario: nombreUsuario,
          codigo: codigo,
          estado: beneficiario.codigo?.activo ? 'Activo' : 'Inactivo',
          estado_activacion: estadoActivacion,
          fecha_activacion: beneficiario.codigo?.fecha_activacion || null,
          fecha_creacion: beneficiario.codigo?.fecha_creacion || null,
          tiempo_restante: tiempoRestante,
          monto: beneficiario.codigo?.monto?.valor || 0
        }
      };
      
      console.log('Respuesta de verificación:', respuesta);
      res.status(200).json(respuesta);
    } catch (error) {
      console.error('Error al verificar código:', error);
      res.status(500).json({
        valido: false,
        mensaje: 'Error interno al verificar código'
      });
    }
  }
  
  // Reactivar código - MODIFICADO PARA SINCRONIZACIÓN
  static async reactivarCodigo(req, res) {
    try {
      console.log('Solicitud de reactivación recibida:', req.body);
      const { beneficiarioId } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      // Reactivar el código usando el servicio existente
      const resultado = await CodigoService.reactivarCodigo(beneficiarioId);

      // NUEVO: Sincronizar con beneficio Refund360
      try {
        console.log('Sincronizando reactivación con beneficio Refund360...');
        
        // Buscar si existe una colección de beneficios (ajusta según tu modelo)
        const mongoose = await import('mongoose');
        
  
        const { BeneficioBeneficiario } = await import('../models/BeneficioBeneficiario.js');
        const { Servicio } = await import('../models/Servicio.js');
        
        const servicioRefund360 = await Servicio.findOne({
          $or: [
            { nombre: 'Reembolso de costos' },
            { nombre: 'Refund360' }
          ]
        });

        if (servicioRefund360) {
          let beneficioRefund360 = await BeneficioBeneficiario.findOne({
            beneficiario_id: beneficiarioId,
            servicio_id: servicioRefund360._id,
            estado: 'inactivo'
          });

          if (beneficioRefund360) {
            beneficioRefund360.estado = 'activo';
            beneficioRefund360.fecha_activacion = new Date();
            beneficioRefund360.fecha_desactivacion = null;
            beneficioRefund360.motivo_desactivacion = null;
            beneficioRefund360.razon_personalizada = null;
            beneficioRefund360.notas_adicionales = 'Reactivado automáticamente por sincronización con código';

            await beneficioRefund360.save();
            console.log('Beneficio Refund360 reactivado automáticamente');
          }
        }
      
        // Por ahora solo loggear la sincronización hasta que tengas los modelos correctos
        console.log('Sincronización con Refund360 verificar');
        
      } catch (errorSinc) {
        console.error('Error en sincronización con beneficio:', errorSinc);
        // No fallar la reactivación del código por error de sincronización
      }
      
      console.log("Código reactivado:", resultado);
      try {
  const beneficiario = await Beneficiario.findById(beneficiarioId);
  await registrarCodigoReactivado({
    beneficiario_nombre: beneficiario.nombre && beneficiario.apellido 
      ? `${beneficiario.nombre} ${beneficiario.apellido}`
      : 'Beneficiario',
    beneficiario_id: beneficiario._id,
    beneficiario_codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
    codigo_reactivado: resultado.codigo?.value,
    motivo: 'Reactivación por solicitud'
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}
      
      res.status(200).json({
        mensaje: 'Código reactivado exitosamente',
        beneficiario: resultado
      });
    } catch (error) {
      console.error('Error detallado en reactivarCodigo:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Desactivar un código - MODIFICADO PARA SINCRONIZACIÓN
  static async desactivarCodigo(req, res) {
    try {
      console.log("Solicitud de desactivación de código recibida:", req.body);
      const { beneficiarioId } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }

      // Desactivar el código usando el servicio existente
      const resultado = await CodigoService.desactivarCodigo(beneficiarioId);

      // NUEVO: Sincronizar con beneficio Refund360
      try {
        console.log('Sincronizando desactivación con beneficio Refund360...');
        
        const { BeneficioBeneficiario } = await import('../models/BeneficioBeneficiario.js');
        const { Servicio } = await import('../models/Servicio.js');
        
        const servicioRefund360 = await Servicio.findOne({
          $or: [
            { nombre: 'Reembolso de costos' },
            { nombre: 'Refund360' }
          ]
        });

        if (servicioRefund360) {
          const beneficioRefund360 = await BeneficioBeneficiario.findOne({
            beneficiario_id: beneficiarioId,
            servicio_id: servicioRefund360._id,
            estado: 'activo'
          });

          if (beneficioRefund360) {
            beneficioRefund360.estado = 'inactivo';
            beneficioRefund360.fecha_desactivacion = new Date();
            beneficioRefund360.motivo_desactivacion = 'Desactivación automática por código';
            beneficioRefund360.razon_personalizada = 'Código desactivado desde panel administrativo';
            beneficioRefund360.notas_adicionales = 'Sincronización automática con sistema de códigos';

            await beneficioRefund360.save();
            console.log('Beneficio Refund360 desactivado automáticamente');
          }
        }
     
        // Por ahora solo loggear la sincronización hasta que tengas los modelos correctos
        console.log('Sincronización con Refund360 pendiente - ajustar modelos según tu estructura');
        
      } catch (errorSinc) {
        console.error('Error en sincronización con beneficio:', errorSinc);
        // No fallar la desactivación del código por error de sincronización
      }
      
      console.log("Código desactivado:", resultado);
      
      res.status(200).json({
        mensaje: 'Código desactivado exitosamente',
        beneficiario: resultado
      });
    } catch (error) {
      console.error("Error en desactivarCodigo:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Actualizar monto
  static async actualizarMonto(req, res) {
    try {
      console.log("Solicitud de actualización de monto recibida:", req.body);
      const { beneficiarioId, nuevoMonto, montoData } = req.body;
      
      // Revisar dos posibles formatos de datos (para mayor compatibilidad)
      const montoFinal = nuevoMonto !== undefined ? 
        nuevoMonto : 
        (montoData?.valor !== undefined ? montoData.valor : undefined);
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      if (montoFinal === undefined) {
        return res.status(400).json({ error: 'El monto es requerido' });
      }
      
      // Verificar que el monto sea un número válido
      if (isNaN(parseFloat(montoFinal))) {
        return res.status(400).json({ error: 'El monto debe ser un número válido' });
      }
      
      console.log("Actualizando monto a:", parseFloat(montoFinal));
      const resultado = await CodigoService.actualizarMonto(beneficiarioId, parseFloat(montoFinal));
      
      console.log("Monto actualizado:", resultado);
      
      res.status(200).json({
        mensaje: 'Monto actualizado exitosamente',
        beneficiario: resultado
      });
    } catch (error) {
      console.error("Error en actualizarMonto:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Actualizar fecha de activación
  static async actualizarFechaActivacion(req, res) {
    try {
      console.log("Solicitud de actualización de fecha recibida:", req.body);
      const { beneficiarioId, nuevaFecha, fechaData } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      // Procesar diferentes formatos de entrada
      let fechaObj;
      
      if (nuevaFecha) {
        // Si se proporcionó una fecha directamente
        fechaObj = new Date(nuevaFecha);
      } else if (fechaData && fechaData.anios) {
        // Si se proporcionaron años a partir de ahora
        fechaObj = new Date();
        fechaObj.setFullYear(fechaObj.getFullYear() + parseInt(fechaData.anios));
      } else {
        // Fecha predeterminada (25 años a partir de ahora)
        fechaObj = new Date();
        fechaObj.setFullYear(fechaObj.getFullYear() + 25);
      }
      
      if (isNaN(fechaObj.getTime())) {
        return res.status(400).json({ error: 'La fecha proporcionada no es válida' });
      }
      
      console.log("Actualizando fecha de activación a:", fechaObj);
      const resultado = await CodigoService.actualizarFechaActivacion(beneficiarioId, fechaObj);
      
      console.log("Fecha actualizada:", resultado);
      
      res.status(200).json({
        mensaje: 'Fecha de activación actualizada exitosamente',
        beneficiario: resultado
      });
    } catch (error) {
      console.error("Error en actualizarFechaActivacion:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  // Marcar como cobrado
  static async marcarComoCobrado(req, res) {
    try {
      console.log("Solicitud para marcar código como cobrado:", req.body);
      const { beneficiarioId } = req.body;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }
      
      const resultado = await CodigoService.marcarComoCobrado(beneficiarioId);
      
      console.log("Código marcado como cobrado:", resultado);
      
      res.status(200).json({
        mensaje: 'Código marcado como cobrado exitosamente',
        beneficiario: resultado
      });
    } catch (error) {
      console.error("Error en marcarComoCobrado:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // NUEVO: Método para verificar sincronización
  static async verificarSincronizacion(req, res) {
    try {
      const { beneficiarioId } = req.params;
      
      if (!beneficiarioId) {
        return res.status(400).json({ error: 'El ID del beneficiario es requerido' });
      }

      // Obtener información del código
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      if (!beneficiario) {
        return res.status(404).json({ error: 'Beneficiario no encontrado' });
      }

      // Por ahora, solo mostrar info del código hasta que tengas los modelos correctos
      const estadoCodigo = beneficiario.codigo?.activo ? 'activo' : 'inactivo';
      
      res.status(200).json({
        beneficiarioId,
        codigo: {
          existe: !!beneficiario.codigo?.value,
          valor: beneficiario.codigo?.value,
          activo: beneficiario.codigo?.activo,
          estado: estadoCodigo,
          monto: beneficiario.codigo?.monto?.valor || 0,
          fecha_activacion: beneficiario.codigo?.fecha_activacion,
          fecha_creacion: beneficiario.codigo?.fecha_creacion
        },
        mensaje: 'Información del código obtenida correctamente'
      });

    } catch (error) {
      console.error('Error al verificar sincronización:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default CodigoController;