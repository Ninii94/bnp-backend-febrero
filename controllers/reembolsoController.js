import { Beneficiario } from '../models/Beneficiario.js';
import mongoose from 'mongoose';
import { Usuario } from '../models/Usuario.js';
import { Reembolso } from '../models/Reembolso.js';
import { 
  registrarCodigoGenerado,
  registrarCodigoActivado,
  registrarCodigoReactivado 
} from '../middleware/bitacoraHelpers.js';

/**
 * Generar un código único para reembolsos de boletos aéreos
 * @private
 * @returns {Promise<string>} - Código único generado
 */
const generarCodigoReembolsoUnico = async () => {
  let isUnique = false;
  let codigoGenerado = '';
  let intentos = 0;
  const maxIntentos = 10;
   
  while (!isUnique && intentos < maxIntentos) {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numeros = '23456789';
       
    let codigo = 'AIR-';
       
    for (let i = 0; i < 3; i++) {
      codigo += letras.charAt(Math.floor(Math.random() * letras.length));
    }
       
    codigo += '-';
       
    for (let i = 0; i < 4; i++) {
      codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
       
    codigoGenerado = codigo;
    
    intentos++;
       
    // Verificar que no exista en ningún beneficiario
    const existente = await Beneficiario.findOne({
      'codigo_reembolso.codigo': codigoGenerado
    });
    
    if (!existente) {
      isUnique = true;
    }
  }
  
  if (!isUnique) {
    throw new Error('No se pudo generar un código de reembolso único después de múltiples intentos');
  }
   
  return codigoGenerado;
};

/**
 * Crear un nuevo código de reembolso para un beneficiario
 * @route POST /api/reembolsos/beneficiarios/:beneficiarioId
 */
export const crearCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { monto, moneda, servicios_aplicables, vigencia_dias, observaciones } = req.body;
    
    // 1. ACTUALIZACIÓN: Registra más información para depuración
    console.log('Creando reembolso para usuario ID:', beneficiarioId);
    console.log('Usuario autenticado:', req.usuario ? req.usuario._id : 'No disponible');
    console.log('Datos recibidos:', { monto, moneda, servicios_aplicables, vigencia_dias, observaciones });
    
    // 2. ACTUALIZACIÓN: Validación de ObjectId
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      console.error('ID de usuario no válido:', beneficiarioId);
      return res.status(400).json({ 
        exito: false,
        mensaje: 'ID de usuario no válido' 
      });
    }
    
    // 3. ACTUALIZACIÓN: Validar datos requeridos
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ 
        exito: false,
        mensaje: 'Se requiere un monto válido' 
      });
    }
    
    // 4. ACTUALIZACIÓN: Si servicios_aplicables no está definido, usar ['vuelo']
    const servicios = servicios_aplicables && Array.isArray(servicios_aplicables) && servicios_aplicables.length > 0 
      ? servicios_aplicables 
      : ['vuelo'];
    
    // 5. ACTUALIZACIÓN: Buscar usuario con manejo mejorado de errores
    const usuario = await Usuario.findById(beneficiarioId);
    if (!usuario) {
      console.error('Usuario no encontrado con ID:', beneficiarioId);
      
      // Intentar verificar si existe como Beneficiario para diagnóstico
      const existeComoBeneficiario = await mongoose.model('Beneficiario').findById(beneficiarioId).catch(() => null);
      
      if (existeComoBeneficiario) {
        console.log('NOTA: El ID existe como Beneficiario pero no como Usuario');
        return res.status(404).json({ 
          exito: false,
          mensaje: 'ID encontrado como Beneficiario pero no como Usuario. Verificar las colecciones utilizadas.' 
        });
      }
      
      return res.status(404).json({ 
        exito: false,
        mensaje: 'Usuario no encontrado' 
      });
    }
    
    console.log('Usuario encontrado:', usuario.nombre_usuario);
    
    
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + (parseInt(vigencia_dias) || 30));
    
    // 7. ACTUALIZACIÓN: Verificar si el usuario autenticado está disponible
    const usuarioAutenticadoId = req.usuario ? req.usuario._id : null;
    if (!usuarioAutenticadoId) {
      console.warn('Usuario autenticado no disponible. Usando ID alternativo.');
      // Usar el ID del usuario que está creando el reembolso como fallback
      req.usuario = { _id: new mongoose.Types.ObjectId() };
    }
    
    // 8. ACTUALIZACIÓN: Generar código único
    let codigoUnico;
    try {
      // Si tienes una función generarCodigoUnico
      codigoUnico = await generarCodigoUnico();
    } catch (error) {
      // Función de fallback para generar código
      codigoUnico = 'AIR-' + 
        Math.random().toString(36).substring(2, 5).toUpperCase() + '-' + 
        Math.floor(1000 + Math.random() * 9000);
    }
    
    // 9. ACTUALIZACIÓN: Crear reembolso con manejo mejorado de errores
    const nuevoReembolso = new Reembolso({
      usuario_id: beneficiarioId,
      codigo: codigoUnico,
      monto: parseFloat(monto),
      moneda: moneda || 'USD',
      servicios_aplicables: servicios,
      activo: true,
      expirado: false,
      fecha_creacion: new Date(),
      fecha_expiracion: fechaExpiracion,
      observaciones: observaciones || '',
      creado_por: req.usuario._id,
      historial: [{
        accion: 'CREACION',
        fecha: new Date(),
        usuario: req.usuario._id,
        detalles: 'Creación de código de reembolso para boleto aéreo'
      }]
    });
    
    console.log('Nuevo reembolso a guardar:', {
      codigo: nuevoReembolso.codigo,
      usuario_id: nuevoReembolso.usuario_id,
      monto: nuevoReembolso.monto,
      creado_por: nuevoReembolso.creado_por
    });
    
    // Guardar reembolso
    await nuevoReembolso.save();
    
    // BITÁCORA: Registrar generación de código
    await registrarCodigoGenerado({
      beneficiario_nombre: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.nombre_usuario,
      beneficiario_id: usuario._id,
      beneficiario_codigo: codigoUnico,
      motivo: 'CREACION_REEMBOLSO_AEREO'
    }, req);
    
    // 10. ACTUALIZACIÓN: Respuesta exitosa con más información
    res.status(201).json({
      exito: true,
      mensaje: 'Código de reembolso creado exitosamente',
      reembolso: {
        _id: nuevoReembolso._id,
        codigo: nuevoReembolso.codigo,
        usuario: {
          _id: usuario._id,
          nombre_usuario: usuario.nombre_usuario,
          correo: usuario.correo
        },
        monto: nuevoReembolso.monto,
        moneda: nuevoReembolso.moneda,
        servicios_aplicables: nuevoReembolso.servicios_aplicables,
        fecha_expiracion: nuevoReembolso.fecha_expiracion,
        fecha_creacion: nuevoReembolso.fecha_creacion
      }
    });
  } catch (error) {
    console.error('Error detallado al crear reembolso:', error);
    res.status(500).json({ 
      exito: false,
      mensaje: 'Error al crear reembolso',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
/**
 * Obtener detalles de un código de reembolso
 * @route GET /api/reembolsos/beneficiarios/:beneficiarioId
 */
export const obtenerCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId)
      .populate('codigo_reembolso.creado_por', 'nombre_usuario correo')
      .populate('usuario_id', 'nombre_usuario correo');
    
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.status(404).json({
        exito: false,
        mensaje: 'El beneficiario no tiene un código de reembolso asignado'
      });
    }
    
    // Verificar si el código ha expirado
    const expirado = beneficiario.isCodigoReembolsoExpirado();
    
    // Calcular tiempo restante
    const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
    
    res.json({
      exito: true,
      codigo: beneficiario.codigo_reembolso,
      expirado,
      tiempoRestante,
      beneficiario: {
        id: beneficiario._id,
        nombre: beneficiario.nombre,
        apellido: beneficiario.apellido,
        usuario: beneficiario.usuario_id ? {
          id: beneficiario.usuario_id._id,
          nombre_usuario: beneficiario.usuario_id.nombre_usuario,
          correo: beneficiario.usuario_id.correo
        } : null
      }
    });
    
  } catch (error) {
    console.error('Error al obtener código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener código de reembolso',
      error: error.message
    });
  }
};

/**
* Obtener historial de un código de reembolso
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const obtenerHistorialCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    console.log(`Obteniendo historial para usuario/beneficiario ID: ${beneficiarioId}`);
    
    // Primero intentar buscar en modelo Reembolso (nuevo sistema)
    let reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId })
      .populate('usuario_id', 'nombre_usuario correo nombre apellido')
      .populate({
        path: 'historial.usuario',
        select: 'nombre_usuario correo nombre apellido',
        model: 'Usuario'  // Especificar explícitamente el modelo
      })
      .lean();
    
    // Si no se encuentra en Reembolso, buscar en modelo Beneficiario (sistema antiguo)
    if (!reembolso) {
      console.log('No se encontró reembolso en modelo Reembolso, buscando en Beneficiario...');
      
      const beneficiario = await Beneficiario.findById(beneficiarioId)
        .populate({
          path: 'codigo_reembolso.historial.usuario',
          select: 'nombre_usuario correo nombre apellido',
          model: 'Usuario'  // Especificar explícitamente el modelo
        })
        .lean();
      
      if (!beneficiario || !beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
        return res.status(404).json({
          exito: false,
          mensaje: 'No se encontró código de reembolso para este usuario/beneficiario'
        });
      }
      
      // Adaptar estructura para mantener consistencia en la respuesta
      reembolso = {
        codigo: beneficiario.codigo_reembolso.codigo,
        historial: beneficiario.codigo_reembolso.historial || []
      };
    }
    
    // Extraer historial y ordenar por fecha (más reciente primero)
    const historial = reembolso.historial || [];
    historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    console.log(`Encontrados ${historial.length} registros de historial`);
    
    // Mapear registros para añadir el nombre de usuario formateado
    const historialFormateado = historial.map(item => {
      // Determinar nombre de usuario según disponibilidad de datos
      let nombreUsuario = 'Sistema';
      
      if (item.usuario) {
        if (typeof item.usuario === 'string') {
          nombreUsuario = `Usuario (ID: ${item.usuario.substring(0, 6)}...)`;
        } else if (item.usuario.nombre_usuario) {
          nombreUsuario = item.usuario.nombre_usuario;
        } else if (item.usuario.nombre || item.usuario.apellido) {
          nombreUsuario = `${item.usuario.nombre || ''} ${item.usuario.apellido || ''}`.trim();
        } else {
          // Intentar extraer el ID como fallback
          const userId = item.usuario._id ? item.usuario._id.toString() : '';
          if (userId) {
            nombreUsuario = `Usuario (ID: ${userId.substring(0, 6)}...)`;
          }
        }
      }
      
      return {
        _id: item._id,
        accion: item.accion,
        fecha: item.fecha,
        fecha_formateada: new Date(item.fecha).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        usuario: item.usuario,
        usuario_nombre: nombreUsuario,
        detalles: item.detalles || ''
      };
    });
    
    // Verificar si hay datos para depuración
    console.log('Muestra de primer registro de historial:', 
      historialFormateado.length > 0 ? 
        JSON.stringify(historialFormateado[0], null, 2).substring(0, 200) + '...' : 
        'No hay registros'
    );
    
    // Enviar respuesta con el historial formateado
    res.json({
      exito: true,
      codigo: reembolso.codigo,
      historial: historialFormateado
    });
    
  } catch (error) {
    console.error('Error al obtener historial de código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener historial de código de reembolso',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
/**
 * Activar/Desactivar un código de reembolso
 * @route PATCH /api/reembolsos/beneficiarios/:beneficiarioId/estado
 */
export const cambiarEstadoCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { activo } = req.body;
    
    if (activo === undefined) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Se requiere el parámetro "activo" (true/false)'
      });
    }
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId)
      .populate('usuario_id', 'nombre_usuario nombre apellido');
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.status(404).json({
        exito: false,
        mensaje: 'El beneficiario no tiene un código de reembolso asignado'
      });
    }
    
    // Verificar si el código ha expirado
    const expirado = beneficiario.isCodigoReembolsoExpirado();
    if (expirado && activo) {
      return res.status(400).json({
        exito: false,
        mensaje: 'No se puede activar un código expirado'
      });
    }
    
    // Actualizar estado
    beneficiario.codigo_reembolso.activo = activo;
    
    // Registrar en historial
    beneficiario.codigo_reembolso.historial.push({
      accion: activo ? 'ACTIVACION' : 'DESACTIVACION',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: activo ? 'Activación de código de reembolso' : 'Desactivación de código de reembolso'
    });
    
    // Guardar cambios
    await beneficiario.save();
    
    // BITÁCORA: Registrar activación (solo si se activa)
    if (activo) {
      await registrarCodigoActivado({
        beneficiario_nombre: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim() || 
          (beneficiario.usuario_id ? beneficiario.usuario_id.nombre_usuario : 'Sin nombre'),
        beneficiario_id: beneficiario._id,
        beneficiario_codigo: beneficiario.codigo_reembolso.codigo,
        monto_reembolso: beneficiario.codigo_reembolso.monto?.valor || 0,
        prima_pagada: 0
      }, req);
    }
    
    res.json({
      exito: true,
      mensaje: `Código de reembolso ${activo ? 'activado' : 'desactivado'} exitosamente`,
      codigo: beneficiario.codigo_reembolso
    });
    
  } catch (error) {
    console.error('Error al cambiar estado de código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al cambiar estado de código de reembolso',
      error: error.message
    });
  }
};

/**
 * Editar propiedades de un código de reembolso
 * @route PUT /api/reembolsos/beneficiarios/:beneficiarioId
 */
export const editarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { 
      monto, 
      moneda,
      servicios_aplicables, 
      vigencia_dias,
      observaciones
    } = req.body;
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.status(404).json({
        exito: false,
        mensaje: 'El beneficiario no tiene un código de reembolso asignado'
      });
    }
    
    // Registrar los cambios que se van a realizar
    const cambios = [];
    
    // Actualizar monto si se proporciona
    if (monto !== undefined && monto !== null) {
      if (isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
        return res.status(400).json({
          exito: false, 
          mensaje: 'El monto debe ser un número positivo'
        });
      }
      
      beneficiario.codigo_reembolso.monto.valor = parseFloat(monto);
      cambios.push(`monto: ${monto}`);
    }
    
    // Actualizar moneda si se proporciona
    if (moneda !== undefined && moneda !== null) {
      beneficiario.codigo_reembolso.monto.moneda = moneda;
      cambios.push(`moneda: ${moneda}`);
    }
    
    // Actualizar servicios aplicables si se proporcionan
    if (servicios_aplicables && Array.isArray(servicios_aplicables)) {
      beneficiario.codigo_reembolso.servicios_aplicables = servicios_aplicables;
      cambios.push(`servicios: ${servicios_aplicables.join(', ')}`);
    }
    
    // Actualizar fecha de expiración si se proporciona vigencia_dias
    if (vigencia_dias !== undefined && vigencia_dias !== null) {
      if (isNaN(parseInt(vigencia_dias)) || parseInt(vigencia_dias) <= 0) {
        return res.status(400).json({
          exito: false,
          mensaje: 'La vigencia debe ser un número positivo de días'
        });
      }
      
      const fechaActual = new Date();
      const nuevaFechaExpiracion = new Date();
      nuevaFechaExpiracion.setDate(fechaActual.getDate() + parseInt(vigencia_dias));
      
      beneficiario.codigo_reembolso.fecha_expiracion = nuevaFechaExpiracion;
      cambios.push(`vigencia: ${vigencia_dias} días (hasta ${nuevaFechaExpiracion.toISOString().split('T')[0]})`);
    }
    
    // Actualizar observaciones si se proporcionan
    if (observaciones !== undefined) {
      beneficiario.codigo_reembolso.observaciones = observaciones;
      cambios.push('observaciones actualizadas');
    }
    
    // Si no hay cambios, retornar error
    if (cambios.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'No se proporcionaron datos para actualizar'
      });
    }
    
    // Registrar en historial
    beneficiario.codigo_reembolso.historial.push({
      accion: 'MODIFICACION',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: `Modificación de propiedades: ${cambios.join(', ')}`
    });
    
    // Guardar cambios
    await beneficiario.save();
    
    // Verificar si el código ha expirado
    const expirado = beneficiario.isCodigoReembolsoExpirado();
    
    // Calcular tiempo restante
    const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
    
    res.json({
      exito: true,
      mensaje: 'Código de reembolso actualizado exitosamente',
      codigo: beneficiario.codigo_reembolso,
      expirado,
      tiempoRestante,
      cambios_realizados: cambios
    });
    
  } catch (error) {
    console.error('Error al editar código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al editar código de reembolso',
      error: error.message
    });
  }
};

/**
 * Eliminar código de reembolso
 * @route DELETE /api/reembolsos/beneficiarios/:beneficiarioId
 */
export const eliminarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.status(404).json({
        exito: false,
        mensaje: 'El beneficiario no tiene un código de reembolso asignado'
      });
    }
    
    // Guardar el código para el mensaje de respuesta
    const codigoEliminado = beneficiario.codigo_reembolso.codigo;
    
    // Eliminar código de reembolso
    beneficiario.codigo_reembolso = undefined;
    
    // Guardar cambios
    await beneficiario.save();
    
    res.json({
      exito: true,
      mensaje: 'Código de reembolso eliminado exitosamente',
      codigo_eliminado: codigoEliminado
    });
    
  } catch (error) {
    console.error('Error al eliminar código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al eliminar código de reembolso',
      error: error.message
    });
  }
};

/**
 * Generar un nuevo código de reembolso (reemplazando el anterior)
 * @route POST /api/reembolsos/beneficiarios/:beneficiarioId/regenerar
 */
export const regenerarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId)
      .populate('usuario_id', 'nombre_usuario nombre apellido');
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }
    
    // Conservar valores del código anterior si existe
    const montoAnterior = beneficiario.codigo_reembolso?.monto?.valor || 500;
    const monedaAnterior = beneficiario.codigo_reembolso?.monto?.moneda || 'USD';
    const serviciosAnteriores = beneficiario.codigo_reembolso?.servicios_aplicables || ['vuelo'];
    const codigoAnterior = beneficiario.codigo_reembolso?.codigo || null;
    const observacionesAnteriores = beneficiario.codigo_reembolso?.observaciones || '';
    
    // Generar nuevo código
    const nuevoCodigo = await generarCodigoReembolsoUnico();
    
    // Crear fecha de expiración (1 año desde hoy)
    const fechaExpiracion = new Date();
    fechaExpiracion.setFullYear(fechaExpiracion.getFullYear() + 1);
    
    // Crear nuevo objeto de código de reembolso
    beneficiario.codigo_reembolso = {
      codigo: nuevoCodigo,
      monto: {
        valor: montoAnterior,
        moneda: monedaAnterior
      },
      activo: true,
      creado_por: req.usuario._id,
      fecha_creacion: new Date(),
      fecha_expiracion: fechaExpiracion,
      servicios_aplicables: serviciosAnteriores,
      observaciones: observacionesAnteriores,
      historial: [{
        accion: 'CREACION',
        fecha: new Date(),
        usuario: req.usuario._id,
        detalles: codigoAnterior ? 
          `Regeneración de código. Código anterior: ${codigoAnterior}` : 
          'Creación de código de reembolso'
      }]
    };
    
    // Guardar cambios
    await beneficiario.save();
    
    // BITÁCORA: Registrar regeneración o generación inicial
    if (codigoAnterior) {
      await registrarCodigoReactivado({
        beneficiario_nombre: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim() || 
          (beneficiario.usuario_id ? beneficiario.usuario_id.nombre_usuario : 'Sin nombre'),
        beneficiario_id: beneficiario._id,
        beneficiario_codigo: nuevoCodigo
      }, req);
    } else {
      await registrarCodigoGenerado({
        beneficiario_nombre: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim() || 
          (beneficiario.usuario_id ? beneficiario.usuario_id.nombre_usuario : 'Sin nombre'),
        beneficiario_id: beneficiario._id,
        beneficiario_codigo: nuevoCodigo,
        motivo: 'GENERACION_INICIAL'
      }, req);
    }
    
    // Calcular tiempo restante
    const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
    
    res.json({
      exito: true,
      mensaje: 'Código de reembolso regenerado exitosamente',
      codigo: beneficiario.codigo_reembolso,
      tiempoRestante,
      codigo_anterior: codigoAnterior
    });
    
  } catch (error) {
    console.error('Error al regenerar código de reembolso:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al regenerar código de reembolso',
      error: error.message
    });
  }
};

/**
 * Verificar validez de un código de reembolso (para servicios como Amadeus)
 * @route GET /api/reembolsos/verificar/:codigo
 */
export const verificarCodigoReembolso = async (req, res) => {
  try {
    const { codigo } = req.params;
    
    if (!codigo) {
      return res.status(400).json({
        valido: false,
        mensaje: 'Se requiere un código de reembolso'
      });
    }
    
    // Buscar beneficiario con ese código
    const beneficiario = await Beneficiario.findOne({
      'codigo_reembolso.codigo': codigo
    }).populate('usuario_id', 'nombre_usuario correo');
    
    if (!beneficiario) {
      return res.status(404).json({
        valido: false,
        mensaje: 'Código de reembolso no encontrado'
      });
    }
    
    // Verificar si está activo
    if (!beneficiario.codigo_reembolso.activo) {
      return res.status(400).json({
        valido: false,
        mensaje: 'Código de reembolso inactivo'
      });
    }
    
    // Verificar si ha expirado
    if (beneficiario.isCodigoReembolsoExpirado()) {
      return res.status(400).json({
        valido: false,
        mensaje: 'Código de reembolso expirado'
      });
    }
    
    // Código válido
const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
    
res.json({
  valido: true,
  mensaje: 'Código de reembolso válido',
  monto: beneficiario.codigo_reembolso.monto,
  tiempoRestante,
  servicios_aplicables: beneficiario.codigo_reembolso.servicios_aplicables,
  beneficiario: {
    id: beneficiario._id,
    nombre: beneficiario.nombre,
    apellido: beneficiario.apellido,
    usuario: beneficiario.usuario_id ? {
      nombre_usuario: beneficiario.usuario_id.nombre_usuario,
      correo: beneficiario.usuario_id.correo
    } : null
  }
});

} catch (error) {
console.error('Error al verificar código de reembolso:', error);
res.status(500).json({
  valido: false,
  mensaje: 'Error al verificar código de reembolso',
  error: error.message
});
}
};

/**
* Aplicar un código de reembolso
* @route POST /api/reembolsos/aplicar/:codigo
*/
export const aplicarCodigoReembolso = async (req, res) => {
try {
const { codigo } = req.params;
const { servicio, detalles } = req.body;

if (!codigo) {
  return res.status(400).json({
    exito: false,
    mensaje: 'Se requiere un código de reembolso'
  });
}

if (!servicio) {
  return res.status(400).json({
    exito: false,
    mensaje: 'Se requiere especificar el servicio utilizado'
  });
}

// Buscar beneficiario con ese código
const beneficiario = await Beneficiario.findOne({
  'codigo_reembolso.codigo': codigo
});

if (!beneficiario) {
  return res.status(404).json({
    exito: false,
    mensaje: 'Código de reembolso no encontrado'
  });
}

// Verificar si está activo
if (!beneficiario.codigo_reembolso.activo) {
  return res.status(400).json({
    exito: false,
    mensaje: 'Código de reembolso inactivo'
  });
}

// Verificar si ha expirado
if (beneficiario.isCodigoReembolsoExpirado()) {
  return res.status(400).json({
    exito: false,
    mensaje: 'Código de reembolso expirado'
  });
}

// Verificar si el servicio es aplicable
if (!beneficiario.codigo_reembolso.servicios_aplicables.includes(servicio)) {
  return res.status(400).json({
    exito: false,
    mensaje: `El código no es aplicable para el servicio "${servicio}"`
  });
}

// Registrar uso en historial
beneficiario.codigo_reembolso.historial.push({
  accion: 'USO',
  fecha: new Date(),
  usuario: req.usuario ? req.usuario._id : null,
  detalles: detalles || `Uso para servicio: ${servicio}`
});

// Desactivar código después de usarlo
beneficiario.codigo_reembolso.activo = false;

// Guardar cambios
await beneficiario.save();

res.json({
  exito: true,
  mensaje: 'Código de reembolso aplicado exitosamente',
  monto: beneficiario.codigo_reembolso.monto,
  beneficiario: {
    id: beneficiario._id,
    nombre: beneficiario.nombre,
    apellido: beneficiario.apellido
  }
});

} catch (error) {
console.error('Error al aplicar código de reembolso:', error);
res.status(500).json({
  exito: false,
  mensaje: 'Error al aplicar código de reembolso',
  error: error.message
});
}
};

/**
* Listar todos los códigos de reembolso (para administradores)
* @route GET /api/reembolsos
*/
export const listarCodigosReembolso = async (req, res) => {
try {
// Parámetros de filtro opcionales
const { activos, expirados, servicio, pagina = 1, limite = 10 } = req.query;

// Construir query base
let query = {
  'codigo_reembolso.codigo': { $exists: true }
};

// Filtrar por estado de activación
if (activos !== undefined && activos !== 'todos') {
  query['codigo_reembolso.activo'] = activos === 'true';
}

// Calcular skip para paginación
const skip = (parseInt(pagina) - 1) * parseInt(limite);

// Buscar beneficiarios con códigos de reembolso
const beneficiarios = await Beneficiario.find(query)
  .select('nombre apellido codigo_reembolso usuario_id')
  .populate('codigo_reembolso.creado_por', 'nombre_usuario')
  .populate('usuario_id', 'nombre_usuario correo')
  .skip(skip)
  .limit(parseInt(limite))
  .sort({ 'codigo_reembolso.fecha_creacion': -1 });

// Contar total de documentos para paginación
const total = await Beneficiario.countDocuments(query);

// Procesar resultados
const codigos = await Promise.all(beneficiarios.map(async beneficiario => {
  const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
  const expirado = beneficiario.isCodigoReembolsoExpirado();
  
  // Filtrar por estado de expiración si se especificó
  if (expirados !== undefined && expirados !== 'todos') {
    const debeEstarExpirado = expirados === 'true';
    if (expirado !== debeEstarExpirado) {
      return null;
    }
  }
  
  // Filtrar por servicio aplicable si se especificó
  if (servicio && servicio !== 'vuelo' && 
      !beneficiario.codigo_reembolso.servicios_aplicables.includes(servicio)) {
    return null;
  }
  
  return {
    beneficiarioId: beneficiario._id,
    nombre: beneficiario.nombre ? 
      `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim() : 
      (beneficiario.usuario_id ? beneficiario.usuario_id.nombre_usuario : 'Sin nombre'),
    usuario: beneficiario.usuario_id ? {
      id: beneficiario.usuario_id._id,
      nombre_usuario: beneficiario.usuario_id.nombre_usuario,
      correo: beneficiario.usuario_id.correo
    } : null,
    codigo: beneficiario.codigo_reembolso.codigo,
    monto: beneficiario.codigo_reembolso.monto,
    activo: beneficiario.codigo_reembolso.activo,
    creado_por: beneficiario.codigo_reembolso.creado_por,
    fecha_creacion: beneficiario.codigo_reembolso.fecha_creacion,
    fecha_expiracion: beneficiario.codigo_reembolso.fecha_expiracion,
    expirado,
    tiempoRestante,
    servicios_aplicables: beneficiario.codigo_reembolso.servicios_aplicables,
    observaciones: beneficiario.codigo_reembolso.observaciones || ''
  };
}));

// Filtrar los nulls (los que no cumplen con los filtros)
const codigosFiltrados = codigos.filter(codigo => codigo !== null);

res.json({
  exito: true,
  total: total,
  pagina: parseInt(pagina),
  totalPaginas: Math.ceil(total / parseInt(limite)),
  codigos: codigosFiltrados
});

} catch (error) {
console.error('Error al listar códigos de reembolso:', error);
res.status(500).json({
  exito: false,
  mensaje: 'Error al listar códigos de reembolso',
  error: error.message
});
}
};

/**
* Buscar beneficiarios por nombre, correo o código
* @route GET /api/reembolsos/buscar-beneficiarios
*/
export const buscarBeneficiarios = async (req, res) => {
try {
const { q } = req.query;

if (!q || q.length < 2) {
  return res.status(400).json({
    exito: false,
    mensaje: 'Se requieren al menos 2 caracteres para la búsqueda'
  });
}

// Crear consulta de búsqueda
const regex = new RegExp(q, 'i');

// Buscar en el modelo de Usuario primero
const Usuario = mongoose.model('Usuario');
const usuarios = await Usuario.find({
  $or: [
    { nombre_usuario: regex },
    { correo: regex },
    { nombre: regex },
    { apellido: regex }
  ]
}).select('_id nombre_usuario correo nombre apellido');

const usuarioIds = usuarios.map(u => u._id);

// Luego buscar beneficiarios que coincidan o estén asociados a esos usuarios
const beneficiarios = await Beneficiario.find({
  $or: [
    { nombre: regex },
    { apellido: regex },
    { usuario_id: { $in: usuarioIds } }
  ]
})
.populate('usuario_id', 'nombre_usuario correo')
.limit(10);

// Preparar resultados
const resultados = beneficiarios.map(b => {
  const usuario = usuarios.find(u => u._id.toString() === (b.usuario_id ? b.usuario_id._id.toString() : null));
  
  return {
    _id: b._id,
    nombre: b.nombre || (usuario ? usuario.nombre : ''),
    apellido: b.apellido || (usuario ? usuario.apellido : ''),
    nombre_usuario: b.usuario_id ? b.usuario_id.nombre_usuario : (usuario ? usuario.nombre_usuario : 'Sin usuario'),
    correo: b.usuario_id ? b.usuario_id.correo : (usuario ? usuario.correo : 'Sin correo'),
    tiene_reembolso: b.codigo_reembolso && b.codigo_reembolso.codigo ? true : false
  };
});

res.json({
  exito: true,
  beneficiarios: resultados
});

} catch (error) {
console.error('Error al buscar beneficiarios:', error);
res.status(500).json({
  exito: false,
  mensaje: 'Error al buscar beneficiarios',
  error: error.message
});
}
};