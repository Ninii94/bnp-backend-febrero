import { Usuario } from '../models/Usuario.js';
import { Reembolso } from '../models/Reembolso.js';
import { generarCodigoUnico } from '../utils/generarCodigoUnico.js';
import mongoose from 'mongoose';

/**
 * Buscar beneficiarios - ahora busca usuarios
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const buscarBeneficiarios = async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('Término de búsqueda recibido:', q);
    
    if (!q || q.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requieren al menos 2 caracteres para buscar' 
      });
    }
    
    // Búsqueda por múltiples campos en usuarios
    const usuarios = await Usuario.find({
      $or: [
        { nombre_usuario: { $regex: q, $options: 'i' } },
        { correo: { $regex: q, $options: 'i' } }
      ]
    })
    .select('_id nombre_usuario correo tipo')
    .limit(10);
    
    console.log('Usuarios encontrados:', usuarios);
    
    // Establecer el header Content-Type
    res.setHeader('Content-Type', 'application/json');
    // Enviar la respuesta directamente como se espera en GestionReembolsos.jsx
    res.json(usuarios);
  } catch (error) {
    console.error('Error al buscar usuarios:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al buscar usuarios',
      error: error.message 
    });
  }
};

/**
 * Obtener todos los códigos de reembolso con filtros
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const listarCodigosReembolso = async (req, res) => {
  try {
    // Extraer parámetros de consulta
    const {
      activos,
      expirados,
      servicio,
      pagina = 1,
      limite = 10
    } = req.query;

    // Construir filtro
    const filtro = {};
    
    if (activos !== undefined && activos !== 'todos') {
      filtro.activo = activos === 'true';
    }
    
    if (expirados !== undefined && expirados !== 'todos') {
      filtro.expirado = expirados === 'true';
    }
    
    if (servicio && servicio !== 'todos') {
      filtro['servicios_aplicables'] = servicio;
    }

    // Calcular skip para paginación
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    
    // Consultar reembolsos
    const reembolsosQuery = Reembolso.find(filtro)
      .populate('usuario_id', 'nombre_usuario correo tipo')
      .sort({ fecha_creacion: -1 })
      .skip(skip)
      .limit(parseInt(limite));
    
    // Contar total para paginación
    const totalQuery = Reembolso.countDocuments(filtro);
    
    // Ejecutar ambas consultas en paralelo
    const [reembolsos, total] = await Promise.all([reembolsosQuery, totalQuery]);
    
    // Formatear resultados para el frontend
    const codigosFormateados = reembolsos.map(reembolso => ({
      _id: reembolso._id,
      codigo: reembolso.codigo,
      nombre_usuario: reembolso.usuario_id?.nombre_usuario || 'Usuario desconocido',
      correo: reembolso.usuario_id?.correo,
      tipo: reembolso.usuario_id?.tipo || 'usuario',
      userId: reembolso.usuario_id?._id,
      monto: {
        valor: reembolso.monto,
        moneda: reembolso.moneda || 'USD'
      },
      activo: reembolso.activo,
      expirado: reembolso.expirado,
      fecha_creacion: reembolso.fecha_creacion,
      fecha_expiracion: reembolso.fecha_expiracion,
      tiempoRestante: calcularTiempoRestante(reembolso.fecha_expiracion)
    }));
    
    res.json({
      codigos: codigosFormateados,
      total,
      pagina: parseInt(pagina),
      limite: parseInt(limite)
    });
  } catch (error) {
    console.error('Error al obtener reembolsos:', error);
    res.status(500).json({ mensaje: 'Error al obtener reembolsos', error: error.message });
  }
};

/**
 * Crear un nuevo código de reembolso para un usuario
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const crearCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params; // ID del usuario (manteniendo nombre del parámetro para compatibilidad)
    const { monto, moneda, servicios_aplicables, vigencia_dias, observaciones } = req.body;
    
    console.log('Creando reembolso para usuario ID:', beneficiarioId);
    console.log('Datos recibidos:', { monto, moneda, servicios_aplicables, vigencia_dias, observaciones });
    
    // Validar datos requeridos
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ mensaje: 'Se requiere un monto válido' });
    }
    
    // Si servicios_aplicables no está definido o está vacío, usar ['vuelo']
    const servicios = servicios_aplicables && Array.isArray(servicios_aplicables) && servicios_aplicables.length > 0 
      ? servicios_aplicables 
      : ['vuelo'];
    
    // Buscar usuario
    const usuario = await Usuario.findById(beneficiarioId);
    if (!usuario) {
      console.error('Usuario no encontrado con ID:', beneficiarioId);
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    console.log('Usuario encontrado:', usuario.nombre_usuario);
    
    // Calcular fecha de expiración
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + (vigencia_dias || 30));
    
    // Generar código único
    const codigoUnico = await generarCodigoUnico();
    
    // Crear reembolso
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
    
    console.log('Nuevo reembolso a guardar:', nuevoReembolso);
    
    // Guardar reembolso
    await nuevoReembolso.save();
    
    res.status(201).json({
      mensaje: 'Código de reembolso creado exitosamente',
      reembolso: {
        _id: nuevoReembolso._id,
        codigo: nuevoReembolso.codigo,
        usuario: {
          _id: usuario._id,
          nombre_usuario: usuario.nombre_usuario
        },
        monto: nuevoReembolso.monto,
        moneda: nuevoReembolso.moneda,
        servicios_aplicables: nuevoReembolso.servicios_aplicables,
        fecha_expiracion: nuevoReembolso.fecha_expiracion
      }
    });
  } catch (error) {
    console.error('Error al crear reembolso:', error);
    res.status(500).json({ mensaje: 'Error al crear reembolso', error: error.message });
  }
};

/**
 * Obtener código de reembolso de un usuario
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const obtenerCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    // Buscar reembolso por ID de usuario
    const reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId })
      .populate('usuario_id', 'nombre_usuario correo tipo');
    
    if (!reembolso) {
      return res.status(404).json({ mensaje: 'Código de reembolso no encontrado para este usuario' });
    }
    
    // Verificar si está expirado
    const now = new Date();
    const expirado = reembolso.fecha_expiracion < now;
    
    // Si está expirado pero no se ha marcado como tal, actualizarlo
    if (expirado && !reembolso.expirado) {
      reembolso.expirado = true;
      await reembolso.save();
    }
    
    // Formatear respuesta
    const codigoInfo = {
      _id: reembolso._id,
      codigo: reembolso.codigo,
      nombre_usuario: reembolso.usuario_id?.nombre_usuario || 'Usuario desconocido',
      correo: reembolso.usuario_id?.correo,
      tipo: reembolso.usuario_id?.tipo || 'usuario',
      userId: reembolso.usuario_id?._id,
      monto: {
        valor: reembolso.monto,
        moneda: reembolso.moneda || 'USD'
      },
      activo: reembolso.activo,
      expirado: expirado,
      fecha_creacion: reembolso.fecha_creacion,
      fecha_expiracion: reembolso.fecha_expiracion,
      servicios_aplicables: reembolso.servicios_aplicables,
      observaciones: reembolso.observaciones,
      tiempoRestante: calcularTiempoRestante(reembolso.fecha_expiracion)
    };
    
    res.json(codigoInfo);
  } catch (error) {
    console.error('Error al obtener código de reembolso:', error);
    res.status(500).json({ mensaje: 'Error al obtener código de reembolso', error: error.message });
  }
};

/**
 * Editar código de reembolso existente
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const editarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { monto, moneda, servicios_aplicables, vigencia_dias, observaciones, activo } = req.body;
    
    // Buscar reembolso por ID de usuario
    const reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId });
    
    if (!reembolso) {
      return res.status(404).json({ mensaje: 'Código de reembolso no encontrado para este usuario' });
    }
    
    // Actualizar campos si se proporcionan
    if (monto !== undefined && !isNaN(parseFloat(monto)) && parseFloat(monto) > 0) {
      reembolso.monto = parseFloat(monto);
    }
    
    if (moneda) {
      reembolso.moneda = moneda;
    }
    
    if (servicios_aplicables && Array.isArray(servicios_aplicables) && servicios_aplicables.length > 0) {
      reembolso.servicios_aplicables = servicios_aplicables;
    }
    
    if (vigencia_dias !== undefined && !isNaN(parseInt(vigencia_dias)) && parseInt(vigencia_dias) > 0) {
      // Calcular nueva fecha de expiración
      const fechaExpiracion = new Date();
      fechaExpiracion.setDate(fechaExpiracion.getDate() + parseInt(vigencia_dias));
      reembolso.fecha_expiracion = fechaExpiracion;
      
      // Verificar si con la nueva fecha de expiración ya no estaría expirado
      const now = new Date();
      if (fechaExpiracion > now && reembolso.expirado) {
        reembolso.expirado = false;
      }
    }
    
    if (observaciones !== undefined) {
      reembolso.observaciones = observaciones;
    }
    
    if (activo !== undefined) {
      reembolso.activo = Boolean(activo);
    }
    
    // Registrar en historial
    reembolso.historial.push({
      accion: 'MODIFICACION',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: 'Edición de código de reembolso'
    });
    
    // Guardar cambios
    await reembolso.save();
    
    res.json({
      mensaje: 'Código de reembolso actualizado exitosamente',
      reembolso: {
        _id: reembolso._id,
        codigo: reembolso.codigo,
        monto: reembolso.monto,
        moneda: reembolso.moneda,
        servicios_aplicables: reembolso.servicios_aplicables,
        fecha_expiracion: reembolso.fecha_expiracion,
        activo: reembolso.activo,
        expirado: reembolso.expirado
      }
    });
  } catch (error) {
    console.error('Error al editar código de reembolso:', error);
    res.status(500).json({ mensaje: 'Error al editar código de reembolso', error: error.message });
  }
};

/**
 * Cambiar estado de un código de reembolso
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const cambiarEstadoCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { activo } = req.body;
    
    console.log('Cambiando estado de reembolso para usuario ID:', beneficiarioId, 'Nuevo estado:', activo);
    
    // Validar datos
    if (activo === undefined) {
      return res.status(400).json({ mensaje: 'Se requiere especificar el estado (activo)' });
    }
    
    // Buscar reembolso por ID de usuario
    const reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId });
    
    if (!reembolso) {
      console.error('No se encontró reembolso para el usuario ID:', beneficiarioId);
      return res.status(404).json({ mensaje: 'No se encontró código de reembolso para este usuario' });
    }
    
    // Registrar en historial
    reembolso.historial.push({
      accion: activo ? 'ACTIVACION' : 'DESACTIVACION',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: activo ? 'Activación de código' : 'Desactivación de código'
    });
    
    // Actualizar estado
    reembolso.activo = Boolean(activo);
    await reembolso.save();
    
    res.json({
      mensaje: `Código de reembolso ${activo ? 'activado' : 'desactivado'} exitosamente`,
      activo: reembolso.activo
    });
  } catch (error) {
    console.error('Error al cambiar estado de reembolso:', error);
    res.status(500).json({ mensaje: 'Error al cambiar estado de reembolso', error: error.message });
  }
};

/**
 * Regenerar código único para el reembolso de un usuario
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const regenerarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    console.log('Regenerando código para usuario ID:', beneficiarioId);
    
    // Buscar el reembolso del usuario
    const reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId });
    
    if (!reembolso) {
      console.error('No se encontró reembolso para el usuario ID:', beneficiarioId);
      return res.status(404).json({ mensaje: 'No se encontró código de reembolso para este usuario' });
    }
    
    // Guardar código anterior para el historial
    const codigoAnterior = reembolso.codigo;
    
    // Generar nuevo código único
    const nuevoCodigoUnico = await generarCodigoUnico();
    
    // Actualizar código
    reembolso.codigo = nuevoCodigoUnico;
    
    // Registrar en historial
    reembolso.historial.push({
      accion: 'MODIFICACION',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: `Regeneración de código. Anterior: ${codigoAnterior}`
    });
    
    // Guardar cambios
    await reembolso.save();
    
    res.json({
      mensaje: 'Código de reembolso regenerado exitosamente',
      codigoAnterior,
      nuevoCodigo: reembolso.codigo
    });
  } catch (error) {
    console.error('Error al regenerar código de reembolso:', error);
    res.status(500).json({ mensaje: 'Error al regenerar código de reembolso', error: error.message });
  }
};

/**
 * Eliminar el reembolso de un usuario
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const eliminarCodigoReembolso = async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    console.log('Eliminando reembolso para usuario ID:', beneficiarioId);
    
    // Eliminar el reembolso del usuario
    const resultado = await Reembolso.deleteOne({ usuario_id: beneficiarioId });
    
    if (resultado.deletedCount === 0) {
      console.error('No se encontró reembolso para el usuario ID:', beneficiarioId);
      return res.status(404).json({ mensaje: 'No se encontró código de reembolso para este usuario' });
    }
    
    res.json({
      mensaje: 'Código de reembolso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar reembolso:', error);
    res.status(500).json({ mensaje: 'Error al eliminar reembolso', error: error.message });
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
      
      // Obtener el reembolso y popular tanto el usuario como los usuarios en el historial
      const reembolso = await Reembolso.findOne({ usuario_id: beneficiarioId })
        .populate('usuario_id', 'nombre_usuario correo nombre apellido')
        .populate('historial.usuario', 'nombre_usuario correo nombre apellido');
      
      if (!reembolso) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Reembolso no encontrado para este usuario'
        });
      }
      
      // Ordenar por fecha (más reciente primero)
      const historial = reembolso.historial || [];
      historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      res.json({
        exito: true,
        codigo: reembolso.codigo,
        historial: historial.map(item => ({
          ...item.toObject(),
          usuario_nombre: item.usuario ? item.usuario.nombre_usuario || `${item.usuario.nombre || ''} ${item.usuario.apellido || ''}`.trim() : 'Sistema'
        }))
      });
      
    } catch (error) {
      console.error('Error al obtener historial de código de reembolso:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener historial de código de reembolso',
        error: error.message
      });
    }
  };

/**
 * Verificar si un código de reembolso es válido
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const verificarCodigoReembolso = async (req, res) => {
  try {
    const { codigo } = req.params;
    
    if (!codigo) {
      return res.status(400).json({ 
        valido: false, 
        mensaje: 'Se requiere un código para verificar' 
      });
    }
    
    // Buscar reembolso por código
    const reembolso = await Reembolso.findOne({ codigo })
      .populate('usuario_id', 'nombre_usuario');
    
    if (!reembolso) {
      return res.json({ 
        valido: false, 
        mensaje: 'Código de reembolso no encontrado o inválido' 
      });
    }
    
    // Verificar si está activo
    if (!reembolso.activo) {
      return res.json({
        valido: false,
        mensaje: 'El código de reembolso no está activo'
      });
    }
    
    // Verificar si ha expirado
    const now = new Date();
    if (reembolso.fecha_expiracion < now || reembolso.expirado) {
      return res.json({
        valido: false,
        mensaje: 'El código de reembolso ha expirado'
      });
    }
    
    // Código válido
    res.json({
      valido: true,
      mensaje: 'Código de reembolso válido',
      codigo: reembolso.codigo,
      usuario: reembolso.usuario_id ? reembolso.usuario_id.nombre_usuario : 'Usuario',
      monto: reembolso.monto,
      moneda: reembolso.moneda,
      servicios_aplicables: reembolso.servicios_aplicables,
      fecha_expiracion: reembolso.fecha_expiracion,
      tiempoRestante: calcularTiempoRestante(reembolso.fecha_expiracion)
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
 * Aplicar un código de reembolso a una compra
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const aplicarCodigoReembolso = async (req, res) => {
  try {
    const { codigo } = req.params;
    const { servicio, monto_aplicado, detalles } = req.body;
    
    // Validar datos
    if (!servicio) {
      return res.status(400).json({ mensaje: 'Se requiere especificar el servicio' });
    }
    
    if (!monto_aplicado || isNaN(parseFloat(monto_aplicado)) || parseFloat(monto_aplicado) <= 0) {
      return res.status(400).json({ mensaje: 'Se requiere un monto válido para aplicar' });
    }
    
    // Buscar reembolso por código
    const reembolso = await Reembolso.findOne({ codigo });
    
    if (!reembolso) {
      return res.status(404).json({ mensaje: 'Código de reembolso no encontrado' });
    }
    
    // Verificar si está activo
    if (!reembolso.activo) {
      return res.status(400).json({ mensaje: 'El código de reembolso no está activo' });
    }
    
    // Verificar si ha expirado
    const now = new Date();
    if (reembolso.fecha_expiracion < now || reembolso.expirado) {
      return res.status(400).json({ mensaje: 'El código de reembolso ha expirado' });
    }
    
    // Verificar si el servicio es aplicable
    if (!reembolso.servicios_aplicables.includes(servicio)) {
      return res.status(400).json({ mensaje: `El código no es aplicable para el servicio "${servicio}"` });
    }
    
    // Registrar en historial
    reembolso.historial.push({
      accion: 'USO',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: detalles || `Aplicación de reembolso para servicio: ${servicio}. Monto: ${monto_aplicado} ${reembolso.moneda}`
    });
    
    // Si se desea, aquí se puede desactivar el código después de usarlo
    // reembolso.activo = false;
    
    // Guardar cambios
    await reembolso.save();
    
    res.json({
      mensaje: 'Código de reembolso aplicado exitosamente',
      codigo: reembolso.codigo,
      monto_aplicado: parseFloat(monto_aplicado),
      moneda: reembolso.moneda,
      servicio
    });
  } catch (error) {
    console.error('Error al aplicar código de reembolso:', error);
    res.status(500).json({ mensaje: 'Error al aplicar código de reembolso', error: error.message });
  }
};

/**
 * Función auxiliar para calcular tiempo restante hasta expiración
 * @param {Date} fechaExpiracion - Fecha de expiración
 * @returns {Object} Objeto con días, horas y minutos restantes
 */
const calcularTiempoRestante = (fechaExpiracion) => {
  if (!fechaExpiracion) return null;
  
  const ahora = new Date();
  const expiracion = new Date(fechaExpiracion);
  
  // Si ya expiró, retornar ceros
  if (expiracion <= ahora) {
    return { dias: 0, horas: 0, minutos: 0 };
  }
  
  // Calcular diferencia en milisegundos
  const diferencia = expiracion - ahora;
  
  // Convertir a días, horas y minutos
  const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
  
  return { dias, horas, minutos };
};