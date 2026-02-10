import express from 'express';
import { SolicitudReembolso } from '../models/SolicitudReembolso.js';
import { Fondo } from '../models/Fondo.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/solicitudes-reembolso
// @desc    Obtener todas las solicitudes de reembolso con filtros
// @access  Private (EquipoBNP)
router.get('/', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estado, fecha_inicio, fecha_fin, page = 1, limit = 10, buscar } = req.query;

    // Construir filtro
    const filtro = {};
    
    if (estado) {
      filtro.estado = estado;
    }

    if (fecha_inicio || fecha_fin) {
      filtro.fecha_solicitud = {};
      if (fecha_inicio) filtro.fecha_solicitud.$gte = new Date(fecha_inicio);
      if (fecha_fin) filtro.fecha_solicitud.$lte = new Date(fecha_fin);
    }

    let query = SolicitudReembolso.find(filtro)
      .populate({
        path: 'beneficiarioId',
        select: 'nombre apellido correo usuario_id',
        populate: {
          path: 'usuario_id',
          select: 'nombre_usuario correo'
        }
      })
      .populate('procesamiento.revisado_por', 'nombre_usuario')
      .populate('creado_por', 'nombre_usuario');

    // Búsqueda por beneficiario
    if (buscar) {
      const beneficiarios = await Beneficiario.find({
        $or: [
          { nombre: { $regex: buscar, $options: 'i' } },
          { apellido: { $regex: buscar, $options: 'i' } },
          { correo: { $regex: buscar, $options: 'i' } }
        ]
      }).select('_id');

      const beneficiarioIds = beneficiarios.map(b => b._id);
      filtro.beneficiarioId = { $in: beneficiarioIds };
      
      query = SolicitudReembolso.find(filtro)
        .populate({
          path: 'beneficiarioId',
          select: 'nombre apellido correo usuario_id',
          populate: {
            path: 'usuario_id',
            select: 'nombre_usuario correo'
          }
        })
        .populate('procesamiento.revisado_por', 'nombre_usuario')
        .populate('creado_por', 'nombre_usuario');
    }

    const solicitudes = await query
      .sort({ fecha_solicitud: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SolicitudReembolso.countDocuments(filtro);

    res.json({
      success: true,
      solicitudes,
      paginacion: {
        total,
        pagina_actual: parseInt(page),
        total_paginas: Math.ceil(total / parseInt(limit)),
        por_pagina: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener solicitudes:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   GET /api/solicitudes-reembolso/:id
// @desc    Obtener detalles de una solicitud específica
// @access  Private (EquipoBNP)
router.get('/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const solicitud = await SolicitudReembolso.findById(req.params.id)
      .populate({
        path: 'beneficiarioId',
        select: 'nombre apellido correo usuario_id',
        populate: {
          path: 'usuario_id',
          select: 'nombre_usuario correo'
        }
      })
      .populate('fondoId')
      .populate('procesamiento.revisado_por', 'nombre_usuario')
      .populate('creado_por', 'nombre_usuario')
      .populate('mensajes.autor', 'nombre_usuario');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    res.json({
      success: true,
      solicitud
    });

  } catch (error) {
    console.error('❌ Error al obtener solicitud:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   PUT /api/solicitudes-reembolso/:id/aprobar
// @desc    Aprobar una solicitud de reembolso
// @access  Private (EquipoBNP)
router.put('/:id/aprobar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { monto_aprobado, comentarios } = req.body;

    const solicitud = await SolicitudReembolso.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido')
      .populate('fondoId');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    if (!solicitud.puedeAprobar()) {
      return res.status(400).json({
        success: false,
        mensaje: `No se puede aprobar una solicitud con estado: ${solicitud.estado}`
      });
    }

    const montoAprobado = parseFloat(monto_aprobado) || solicitud.monto_solicitado.valor;

    // Verificar que el fondo tenga saldo suficiente
    const fondo = solicitud.fondoId;
    if (fondo.saldo_actual.valor < montoAprobado) {
      return res.status(400).json({
        success: false,
        mensaje: `Saldo insuficiente en el fondo. Saldo actual: $${fondo.saldo_actual.valor}`,
        saldo_disponible: fondo.saldo_actual.valor
      });
    }

    // Usar el fondo (descontar el monto)
    await fondo.usarFondo(
      montoAprobado,
      `Reembolso aprobado - Solicitud ${solicitud.numero_solicitud}`,
      solicitud._id,
      req.usuario._id
    );

    // Aprobar la solicitud
    await solicitud.aprobar(montoAprobado, comentarios, req.usuario._id);

    console.log('✅ Solicitud aprobada:', solicitud.numero_solicitud, `Monto: $${montoAprobado}`);

    res.json({
      success: true,
      mensaje: 'Solicitud aprobada exitosamente',
      solicitud: {
        _id: solicitud._id,
        numero_solicitud: solicitud.numero_solicitud,
        estado: solicitud.estado,
        monto_aprobado: montoAprobado,
        saldo_restante_fondo: fondo.saldo_actual.valor
      }
    });

  } catch (error) {
    console.error('❌ Error al aprobar solicitud:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   PUT /api/solicitudes-reembolso/:id/rechazar
// @desc    Rechazar una solicitud de reembolso
// @access  Private (EquipoBNP)
router.put('/:id/rechazar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { razon_rechazo, comentarios } = req.body;

    if (!razon_rechazo || !razon_rechazo.trim()) {
      return res.status(400).json({
        success: false,
        mensaje: 'La razón del rechazo es requerida'
      });
    }

    const solicitud = await SolicitudReembolso.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    if (!solicitud.puedeAprobar()) {
      return res.status(400).json({
        success: false,
        mensaje: `No se puede rechazar una solicitud con estado: ${solicitud.estado}`
      });
    }

    await solicitud.rechazar(razon_rechazo.trim(), comentarios, req.usuario._id);

    console.log('❌ Solicitud rechazada:', solicitud.numero_solicitud, 'Razón:', razon_rechazo);

    res.json({
      success: true,
      mensaje: 'Solicitud rechazada exitosamente',
      solicitud: {
        _id: solicitud._id,
        numero_solicitud: solicitud.numero_solicitud,
        estado: solicitud.estado,
        razon_rechazo: razon_rechazo
      }
    });

  } catch (error) {
    console.error('❌ Error al rechazar solicitud:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   PUT /api/solicitudes-reembolso/:id/marcar-pagado
// @desc    Marcar una solicitud como pagada
// @access  Private (EquipoBNP)
router.put('/:id/marcar-pagado', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { referencia_pago, comentarios } = req.body;

    const solicitud = await SolicitudReembolso.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    if (solicitud.estado !== 'aprobado') {
      return res.status(400).json({
        success: false,
        mensaje: 'Solo se pueden marcar como pagadas las solicitudes aprobadas'
      });
    }

    await solicitud.marcarComoPagado(referencia_pago, req.usuario._id);

    // Agregar comentario si se proporciona
    if (comentarios && comentarios.trim()) {
      await solicitud.agregarMensaje(
        req.usuario._id,
        'equipo_bnp',
        `Pago procesado. ${comentarios.trim()}`
      );
    }

    console.log('💰 Solicitud marcada como pagada:', solicitud.numero_solicitud);

    res.json({
      success: true,
      mensaje: 'Solicitud marcada como pagada exitosamente',
      solicitud: {
        _id: solicitud._id,
        numero_solicitud: solicitud.numero_solicitud,
        estado: solicitud.estado,
        referencia_pago: referencia_pago
      }
    });

  } catch (error) {
    console.error('❌ Error al marcar como pagado:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   PUT /api/solicitudes-reembolso/:id/estado
// @desc    Cambiar estado de una solicitud (en proceso)
// @access  Private (EquipoBNP)
router.put('/:id/estado', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { nuevo_estado, comentarios } = req.body;

    const estadosPermitidos = ['pendiente', 'en_proceso'];
    if (!estadosPermitidos.includes(nuevo_estado)) {
      return res.status(400).json({
        success: false,
        mensaje: 'Estado no válido. Use aprobar, rechazar o marcar-pagado para otros estados'
      });
    }

    const solicitud = await SolicitudReembolso.findById(req.params.id);

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    solicitud.estado = nuevo_estado;
    solicitud.actualizado_por = req.usuario._id;

    if (nuevo_estado === 'en_proceso' && !solicitud.procesamiento.revisado_por) {
      solicitud.procesamiento.revisado_por = req.usuario._id;
      solicitud.procesamiento.fecha_revision = new Date();
    }

    await solicitud.save();

    // Agregar mensaje si se proporciona
    if (comentarios && comentarios.trim()) {
      await solicitud.agregarMensaje(
        req.usuario._id,
        'equipo_bnp',
        comentarios.trim()
      );
    }

    res.json({
      success: true,
      mensaje: `Estado actualizado a: ${nuevo_estado}`,
      solicitud: {
        _id: solicitud._id,
        numero_solicitud: solicitud.numero_solicitud,
        estado: solicitud.estado
      }
    });

  } catch (error) {
    console.error('❌ Error al cambiar estado:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   POST /api/solicitudes-reembolso/:id/mensaje
// @desc    Agregar mensaje a una solicitud
// @access  Private (EquipoBNP)
router.post('/:id/mensaje', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { mensaje } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({
        success: false,
        mensaje: 'El mensaje es requerido'
      });
    }

    const solicitud = await SolicitudReembolso.findById(req.params.id);

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        mensaje: 'Solicitud no encontrada'
      });
    }

    await solicitud.agregarMensaje(req.usuario._id, 'equipo_bnp', mensaje.trim());

    res.json({
      success: true,
      mensaje: 'Mensaje agregado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al agregar mensaje:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   GET /api/solicitudes-reembolso/estadisticas/resumen
// @desc    Obtener estadísticas de solicitudes de reembolso
// @access  Private (EquipoBNP)
router.get('/estadisticas/resumen', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    const estadisticas = await SolicitudReembolso.obtenerEstadisticas(fecha_inicio, fecha_fin);

    // Obtener tendencias mensuales
    const tendencias = await SolicitudReembolso.aggregate([
      {
        $match: fecha_inicio || fecha_fin ? {
          fecha_solicitud: {
            ...(fecha_inicio && { $gte: new Date(fecha_inicio) }),
            ...(fecha_fin && { $lte: new Date(fecha_fin) })
          }
        } : {}
      },
      {
        $group: {
          _id: {
            año: { $year: '$fecha_solicitud' },
            mes: { $month: '$fecha_solicitud' }
          },
          cantidad: { $sum: 1 },
          monto_total: { $sum: '$monto_solicitado.valor' }
        }
      },
      {
        $sort: { '_id.año': -1, '_id.mes': -1 }
      },
      {
        $limit: 12
      }
    ]);

    res.json({
      success: true,
      estadisticas,
      tendencias_mensuales: tendencias
    });

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   GET /api/solicitudes-reembolso/pendientes/resumen
// @desc    Obtener resumen rápido de solicitudes pendientes
// @access  Private (EquipoBNP)
router.get('/pendientes/resumen', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const pendientes = await SolicitudReembolso.countDocuments({ estado: 'pendiente' });
    const enProceso = await SolicitudReembolso.countDocuments({ estado: 'en_proceso' });
    
    const urgentes = await SolicitudReembolso.countDocuments({
      estado: { $in: ['pendiente', 'en_proceso'] },
      fecha_limite_respuesta: { $lte: new Date() }
    });

    const proximasVencer = await SolicitudReembolso.countDocuments({
      estado: { $in: ['pendiente', 'en_proceso'] },
      fecha_limite_respuesta: {
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // próximos 3 días
      }
    });

    res.json({
      success: true,
      resumen: {
        pendientes,
        en_proceso: enProceso,
        urgentes,
        proximas_vencer: proximasVencer,
        total_activas: pendientes + enProceso
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener resumen:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

export default router;