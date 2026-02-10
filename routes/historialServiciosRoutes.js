import express from 'express';
import mongoose from 'mongoose';
import { HistorialServicio } from '../models/HistorialServicio.js';
import { Servicio } from '../models/Servicio.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// =====================================
// REGISTRO DE CAMBIOS EN SERVICIOS
// =====================================

/**
 * POST /api/historial-servicios/registrar
 * Registrar un cambio de estado en un servicio
 */
router.post('/registrar', checkAuth, async (req, res) => {
  try {
    const {
      usuarioId,
      servicioId,
      accion, // 'pendiente_activacion', 'activado', 'desactivado', 'suspendido', 'reactivado'
      motivo,
      notas
    } = req.body;

    console.log(`[HISTORIAL] Registrando cambio: ${accion} para usuario ${usuarioId}, servicio ${servicioId}`);

    // Validaciones
    if (!usuarioId || !servicioId || !accion) {
      return res.status(400).json({
        success: false,
        error: 'usuarioId, servicioId y accion son requeridos'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(usuarioId) || !mongoose.Types.ObjectId.isValid(servicioId)) {
      return res.status(400).json({
        success: false,
        error: 'IDs inválidos'
      });
    }

    const accionesValidas = ['pendiente_activacion', 'activado', 'desactivado', 'suspendido', 'reactivado', 'asignado'];
    if (!accionesValidas.includes(accion)) {
      return res.status(400).json({
        success: false,
        error: `Acción inválida. Debe ser una de: ${accionesValidas.join(', ')}`
      });
    }

    // Obtener información del servicio
    const servicio = await Servicio.findById(servicioId);
    if (!servicio) {
      return res.status(404).json({
        success: false,
        error: 'Servicio no encontrado'
      });
    }

    // Verificar si ya existe un registro reciente idéntico (evitar duplicados)
    const fechaLimite = new Date(Date.now() - 60000); // 1 minuto
    const registroExistente = await HistorialServicio.findOne({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
      servicioId: new mongoose.Types.ObjectId(servicioId),
      accion: accion,
      fecha: { $gte: fechaLimite }
    });

    if (registroExistente) {
      console.log(`[HISTORIAL] Registro duplicado evitado para ${accion}`);
      return res.json({
        success: true,
        message: 'Registro ya existe (duplicado evitado)',
        registro: registroExistente
      });
    }

    // Determinar estado actual basado en la acción
    let estadoActual;
    let fechaActivacion = null;
    
    switch (accion) {
      case 'pendiente_activacion':
      case 'asignado':
        estadoActual = 'pendiente_activacion';
        break;
      case 'activado':
      case 'reactivado':
        estadoActual = 'activo';
        fechaActivacion = new Date();
        break;
      case 'desactivado':
        estadoActual = 'inactivo';
        break;
      case 'suspendido':
        estadoActual = 'suspendido';
        break;
      default:
        estadoActual = 'pendiente_activacion';
    }

    // Crear el registro de historial
    const nuevoRegistro = new HistorialServicio({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
      servicioId: new mongoose.Types.ObjectId(servicioId),
      servicioNombre: servicio.nombre,
      accion: accion,
      estado_actual: estadoActual,
      tipo_usuario: 'beneficiario', // o extraer del contexto si es necesario
      usuario: req.usuario?.nombre_usuario || req.usuario?.nombre || 'Sistema',
      fecha: new Date(),
      fecha_asignacion: accion === 'pendiente_activacion' || accion === 'asignado' ? new Date() : null,
      fecha_activacion: fechaActivacion,
      notas: notas || motivo || `Servicio ${accion} ${motivo ? `- ${motivo}` : ''}`
    });

    await nuevoRegistro.save();

    console.log(`[HISTORIAL] ✅ Registro creado: ${nuevoRegistro._id}`);

    res.status(201).json({
      success: true,
      message: 'Cambio registrado exitosamente',
      registro: {
        _id: nuevoRegistro._id,
        usuarioId: nuevoRegistro.usuarioId,
        servicioId: nuevoRegistro.servicioId,
        servicioNombre: nuevoRegistro.servicioNombre,
        accion: nuevoRegistro.accion,
        estado_actual: nuevoRegistro.estado_actual,
        usuario: nuevoRegistro.usuario,
        fecha: nuevoRegistro.fecha,
        notas: nuevoRegistro.notas
      }
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al registrar cambio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/historial-servicios/activar-servicio
 * Activar un servicio específico (cambiar de pendiente a activo)
 */
router.post('/activar-servicio', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { usuarioId, servicioId, motivo } = req.body;

    console.log(`[HISTORIAL] Activando servicio ${servicioId} para usuario ${usuarioId}`);

    // Validaciones
    if (!usuarioId || !servicioId) {
      return res.status(400).json({
        success: false,
        error: 'usuarioId y servicioId son requeridos'
      });
    }

    // Verificar que existe un registro pendiente
    const registroPendiente = await HistorialServicio.findOne({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
      servicioId: new mongoose.Types.ObjectId(servicioId),
      estado_actual: 'pendiente_activacion'
    }).sort({ fecha: -1 });

    if (!registroPendiente) {
      return res.status(404).json({
        success: false,
        error: 'No hay un servicio pendiente de activación para este usuario'
      });
    }

    // Crear registro de activación
    const registroActivacion = new HistorialServicio({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
      servicioId: new mongoose.Types.ObjectId(servicioId),
      servicioNombre: registroPendiente.servicioNombre,
      accion: 'activado',
      estado_actual: 'activo',
      tipo_usuario: 'beneficiario',
      usuario: req.usuario?.nombre_usuario || req.usuario?.nombre || 'Equipo BNP',
      fecha: new Date(),
      fecha_activacion: new Date(),
      notas: motivo || `Servicio activado por ${req.usuario?.nombre_usuario || 'Equipo BNP'}`
    });

    await registroActivacion.save();

    console.log(`[HISTORIAL] ✅ Servicio activado: ${registroActivacion._id}`);

    res.json({
      success: true,
      message: 'Servicio activado exitosamente',
      registro: registroActivacion
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al activar servicio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/historial-servicios/desactivar-servicio
 * Desactivar un servicio activo
 */
router.post('/desactivar-servicio', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { usuarioId, servicioId, motivo } = req.body;

    console.log(`[HISTORIAL] Desactivando servicio ${servicioId} para usuario ${usuarioId}`);

    // Crear registro de desactivación
    const servicio = await Servicio.findById(servicioId);
    if (!servicio) {
      return res.status(404).json({
        success: false,
        error: 'Servicio no encontrado'
      });
    }

    const registroDesactivacion = new HistorialServicio({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
      servicioId: new mongoose.Types.ObjectId(servicioId),
      servicioNombre: servicio.nombre,
      accion: 'desactivado',
      estado_actual: 'inactivo',
      tipo_usuario: 'beneficiario',
      usuario: req.usuario?.nombre_usuario || req.usuario?.nombre || 'Equipo BNP',
      fecha: new Date(),
      notas: motivo || `Servicio desactivado por ${req.usuario?.nombre_usuario || 'Equipo BNP'}`
    });

    await registroDesactivacion.save();

    console.log(`[HISTORIAL] ✅ Servicio desactivado: ${registroDesactivacion._id}`);

    res.json({
      success: true,
      message: 'Servicio desactivado exitosamente',
      registro: registroDesactivacion
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al desactivar servicio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// =====================================
// CONSULTA DE HISTORIAL
// =====================================

/**
 * GET /api/historial-servicios/usuario/:usuarioId
 * Obtener historial completo de un usuario
 */
router.get('/usuario/:usuarioId', checkAuth, async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuario inválido'
      });
    }

    const historial = await HistorialServicio.find({
      usuarioId: new mongoose.Types.ObjectId(usuarioId)
    })
    .sort({ fecha: -1 })
    .lean();

    const historialFormateado = historial.map(registro => ({
      _id: registro._id.toString(),
      usuarioId: registro.usuarioId.toString(),
      servicioId: registro.servicioId.toString(),
      servicioNombre: registro.servicioNombre,
      accion: registro.accion,
      estado_actual: registro.estado_actual,
      tipo_usuario: registro.tipo_usuario,
      usuario: registro.usuario,
      fecha: registro.fecha,
      fecha_asignacion: registro.fecha_asignacion,
      fecha_activacion: registro.fecha_activacion,
      notas: registro.notas || ''
    }));

    res.json({
      success: true,
      historial: historialFormateado,
      total: historialFormateado.length
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/historial-servicios/usuario/:usuarioId/resumen
 * Obtener estado actual de todos los servicios del usuario
 */
router.get('/usuario/:usuarioId/resumen', checkAuth, async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuario inválido'
      });
    }

    const resumen = await HistorialServicio.getResumenServicios(usuarioId);

    res.json({
      success: true,
      resumen: resumen,
      total: resumen.length
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al obtener resumen:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * DELETE /api/historial-servicios/limpiar-duplicados/:usuarioId
 * Limpiar registros duplicados de un usuario específico
 */
router.delete('/limpiar-duplicados/:usuarioId', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuario inválido'
      });
    }

    // Obtener todos los registros del usuario
    const registros = await HistorialServicio.find({
      usuarioId: new mongoose.Types.ObjectId(usuarioId)
    }).sort({ fecha: -1 });

    // Agrupar por servicio y acción, manteniendo solo el más reciente
    const grupos = {};
    const idsAEliminar = [];

    for (const registro of registros) {
      const key = `${registro.servicioId}-${registro.accion}`;
      
      if (!grupos[key]) {
        grupos[key] = registro; // Mantener el más reciente (por el sort)
      } else {
        idsAEliminar.push(registro._id);
      }
    }

    // Eliminar duplicados
    if (idsAEliminar.length > 0) {
      await HistorialServicio.deleteMany({
        _id: { $in: idsAEliminar }
      });
    }

    console.log(`[HISTORIAL] Eliminados ${idsAEliminar.length} registros duplicados para usuario ${usuarioId}`);

    res.json({
      success: true,
      message: `Se eliminaron ${idsAEliminar.length} registros duplicados`,
      eliminados: idsAEliminar.length,
      grupos_únicos: Object.keys(grupos).length
    });

  } catch (error) {
    console.error('[HISTORIAL] Error al limpiar duplicados:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

export default router;