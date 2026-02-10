
import { Beneficiario } from '../models/Beneficiario.js';
import mongoose from 'mongoose';

class CodigoService {
  static async generarNuevoCodigo(beneficiarioId, motivo = 'PERDIDA', detalles = '') {
    try {
    
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
    
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      const nuevoCodigoValue = await this.generarCodigoUnico();
      
   
      const codigoAnterior = beneficiario.codigo?.value || null;
      
     
      if (!beneficiario.codigo) {
        beneficiario.codigo = {
          value: nuevoCodigoValue,
          fecha_creacion: new Date(),
          fecha_activacion: new Date(new Date().setFullYear(new Date().getFullYear() + 25)),
          monto: {
            valor: 0,
            moneda: 'USD'
          },
          estado_activacion: 'PENDIENTE',
          historial: [],
          activo: true
        };
      } else {
     
        beneficiario.codigo.value = nuevoCodigoValue;
      }
      
    
      beneficiario.codigo.activo = true;
      beneficiario.llave_unica = nuevoCodigoValue;
      
      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }
      
      // Asegurarnos que detalles sea un string
      const detallesString = typeof detalles === 'string' ? detalles : 'Generación de nuevo código';
      
      beneficiario.codigo.historial.push({
        codigo_anterior: codigoAnterior,
        fecha_cambio: new Date(),
        motivo: motivo,
        detalles: detallesString
      });
      
      // Guardar los cambios
      await beneficiario.save();
      
      return {
        beneficiario,
        codigo: nuevoCodigoValue
      };
    } catch (error) {
      console.error('Error generando nuevo código:', error);
      throw error;
    }
  }
  
  // Generar un código único
  static async generarCodigoUnico() {
    try {
      let isUnique = false;
      let codigoGenerado = '';
      let intentos = 0;
      const maxIntentos = 10;
      
      while (!isUnique && intentos < maxIntentos) {
        const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const numeros = '23456789';
        
        let codigo = 'BNP-';
        
        for (let i = 0; i < 4; i++) {
          codigo += letras.charAt(Math.floor(Math.random() * letras.length));
        }
        
        codigo += '-';
        
        for (let i = 0; i < 4; i++) {
          codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
        }
        
        codigoGenerado = codigo;
        intentos++;
        
        // Verificar que no exista en ninguno de los dos campos
        const existente = await Beneficiario.findOne({
          $or: [
            { llave_unica: codigoGenerado },
            { 'codigo.value': codigoGenerado }
          ]
        });
        
        if (!existente) {
          isUnique = true;
        }
      }
      
      if (!isUnique) {
        throw new Error('No se pudo generar un código único después de múltiples intentos');
      }
      
      return codigoGenerado;
    } catch (error) {
      console.error('Error generando código único:', error);
      throw error;
    }
  }
  
  // Verificar un código
  static async verificarCodigo(codigo) {
    try {
      // Buscar por el campo 'codigo.value'
      const beneficiario = await Beneficiario.findOne({ 
        'codigo.value': codigo, 
        'codigo.activo': true 
      }).populate('estado_id').populate('aliado_id');
      
      if (!beneficiario) {
        return {
          valido: false,
          mensaje: 'Código no válido o inactivo'
        };
      }
      
      return {
        valido: true,
        beneficiario: {
          id: beneficiario._id,
          nombre: beneficiario.nombre,
          apellido: beneficiario.apellido,
          documento: beneficiario.documento,
          codigo: beneficiario.codigo.value,
          estado: beneficiario.estado_id ? beneficiario.estado_id.nombre : 'N/A',
          aliado: beneficiario.aliado_id ? beneficiario.aliado_id.nombre : 'N/A',
          fecha_activacion: beneficiario.codigo.fecha_activacion
        }
      };
    } catch (error) {
      console.error('Error verificando código:', error);
      throw error;
    }
  }
  
  // Actualizar monto
  static async actualizarMonto(beneficiarioId, nuevoMonto) {
    try {
      // Verificar que el beneficiarioId es válido
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
      // Buscar al beneficiario
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      // Verificar que existe el objeto codigo
      if (!beneficiario.codigo) {
        throw new Error('El beneficiario no tiene un código configurado');
      }
      
      // Actualizar el monto
      if (!beneficiario.codigo.monto) {
        beneficiario.codigo.monto = {
          valor: nuevoMonto,
          moneda: 'USD'
        };
      } else {
        beneficiario.codigo.monto.valor = nuevoMonto;
      }
      
      // Guardar los cambios
      await beneficiario.save();
      
      return beneficiario;
    } catch (error) {
      console.error('Error actualizando monto:', error);
      throw error;
    }
  }
  
  // Actualizar fecha de activación
  static async actualizarFechaActivacion(beneficiarioId, nuevaFecha = new Date()) {
    try {
      // Verificar que el beneficiarioId es válido
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
      // Buscar al beneficiario
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      // Verificar que existe el objeto codigo
      if (!beneficiario.codigo) {
        throw new Error('El beneficiario no tiene un código configurado');
      }
      
      // Actualizar la fecha de activación
      beneficiario.codigo.fecha_activacion = nuevaFecha;
      
      // Añadir al historial
      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }
      
      beneficiario.codigo.historial.push({
        fecha_cambio: new Date(),
        motivo: 'OTRO',
        detalles: 'Actualización de fecha de activación'
      });
      
      // Guardar los cambios
      await beneficiario.save();
      
      return beneficiario;
    } catch (error) {
      console.error('Error actualizando fecha de activación:', error);
      throw error;
    }
  }
  
  // Marcar como cobrado
  static async marcarComoCobrado(beneficiarioId) {
    try {
      // Verificar que el beneficiarioId es válido
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
      // Buscar al beneficiario
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      // Verificar que existe el objeto codigo
      if (!beneficiario.codigo) {
        throw new Error('El beneficiario no tiene un código configurado');
      }
      
      // Marcar como cobrado
      beneficiario.codigo.estado_activacion = 'COBRADO';
      
      // Añadir al historial
      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }
      
      beneficiario.codigo.historial.push({
        fecha_cambio: new Date(),
        motivo: 'COBRO',
        detalles: 'Código marcado como cobrado'
      });
      
      // Guardar los cambios
      await beneficiario.save();
      
      return beneficiario;
    } catch (error) {
      console.error('Error marcando como cobrado:', error);
      throw error;
    }
  }
  
  // Desactivar un código
  static async desactivarCodigo(beneficiarioId) {
    try {
      // Verificar que el beneficiarioId es válido
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
      // Buscar al beneficiario
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      // Verificar que existe el objeto codigo
      if (!beneficiario.codigo) {
        throw new Error('El beneficiario no tiene un código configurado');
      }
      
      // Desactivar el código
      beneficiario.codigo.activo = false;
      
      // Cambiar estado de reembolso a CANCELADO si estaba PENDIENTE o ACTIVADO
      if (beneficiario.codigo.estado_activacion === 'PENDIENTE' || 
          beneficiario.codigo.estado_activacion === 'ACTIVADO') {
        beneficiario.codigo.estado_activacion = 'CANCELADO';
        beneficiario.codigo.motivoCancelacion = 'DESACTIVACION';
        beneficiario.codigo.fechaCancelacion = new Date();
      }
      
      // Añadir al historial
      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }
      
      beneficiario.codigo.historial.push({
        fecha_cambio: new Date(),
        motivo: 'OTRO',
        detalles: 'Código desactivado'
      });
      
      // Guardar los cambios
      await beneficiario.save();
      
      return beneficiario;
    } catch (error) {
      console.error('Error desactivando código:', error);
      throw error;
    }
  }
  
 // Reactivar un código (mejorado)

static async reactivarCodigo(beneficiarioId) {
  try {
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }
    
    if (!beneficiario.codigo) {
      throw new Error('El beneficiario no tiene un código asignado');
    }
    
    // Verificar que el código esté desactivado
    if (beneficiario.codigo.activo) {
      throw new Error('El código ya está activo');
    }
    
    // Reactivar el código
    beneficiario.codigo.activo = true;
    
    // Establecer la fecha de reactivación como fecha actual
    const fechaReactivacion = new Date();
    
    // Calcular la nueva fecha de activación (25 años después de la reactivación)
    const fechaActivacion = new Date(fechaReactivacion);
    fechaActivacion.setFullYear(fechaActivacion.getFullYear() + 25);
    
    // Actualizar las fechas
    beneficiario.codigo.fecha_reactivacion = fechaReactivacion;
    beneficiario.codigo.fecha_activacion = fechaActivacion;
    
    // Si el código estaba cancelado, cambiar el estado a PENDIENTE
    if (beneficiario.codigo.estado_activacion === 'CANCELADO') {
      beneficiario.codigo.estado_activacion = 'PENDIENTE';
      // Limpiar datos de cancelación
      beneficiario.codigo.motivoCancelacion = undefined;
      beneficiario.codigo.fechaCancelacion = undefined;
    }
    
    // Agregar al historial
    if (!beneficiario.codigo.historial) {
      beneficiario.codigo.historial = [];
    }
    
    beneficiario.codigo.historial.push({
      fecha_cambio: new Date(),
      motivo: 'REACTIVACION',
      detalles: `Código reactivado. Nueva fecha de activación establecida para: ${fechaActivacion.toLocaleDateString('es-ES')} (25 años desde la reactivación: ${fechaReactivacion.toLocaleDateString('es-ES')})`
    });
    
    await beneficiario.save();
    
    console.log(`Código reactivado para beneficiario ${beneficiarioId}. Nueva fecha de activación: ${fechaActivacion.toLocaleDateString('es-ES')}`);
    
    return beneficiario;
  } catch (error) {
    console.error('Error en reactivarCodigo:', error);
    throw error;
  }
}
  // Cancelar reembolso
  static async cancelarReembolso(beneficiarioId, motivo) {
    try {
      // Verificar que el beneficiarioId es válido
      if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
        throw new Error('ID de beneficiario inválido');
      }
      
      // Buscar al beneficiario
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      
      if (!beneficiario) {
        throw new Error('No se encontró el beneficiario');
      }
      
      // Verificar que existe el objeto codigo
      if (!beneficiario.codigo) {
        throw new Error('El beneficiario no tiene un código configurado');
      }
      
      // Verificar que el código no esté ya cancelado o cobrado
      if (beneficiario.codigo.estado_activacion === 'CANCELADO') {
        throw new Error('El código ya está cancelado');
      }
      
      if (beneficiario.codigo.estado_activacion === 'COBRADO') {
        throw new Error('No se puede cancelar un código ya cobrado');
      }
      
      // Cancelar el código
      beneficiario.codigo.estado_activacion = 'CANCELADO';
      beneficiario.codigo.motivoCancelacion = motivo;
      beneficiario.codigo.fechaCancelacion = new Date();
      beneficiario.codigo.activo = false;
      
      // Añadir al historial
      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }
      
      beneficiario.codigo.historial.push({
        fecha_cambio: new Date(),
        motivo: 'CANCELACION',
        detalles: `Reembolso cancelado. Motivo: ${motivo}`
      });
      
      // Guardar los cambios
      await beneficiario.save();
      
      return beneficiario;
    } catch (error) {
      console.error('Error cancelando reembolso:', error);
      throw error;
    }
  }
}

export default CodigoService;