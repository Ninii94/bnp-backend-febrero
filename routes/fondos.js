import express from 'express';
import { Fondo } from '../models/Fondo.js';
import { SolicitudReembolso } from '../models/SolicitudReembolso.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Usuario } from '../models/Usuario.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';
import { 
  registrarReembolsoRenovado, 
  registrarReembolsoBloqueado, 
  registrarReembolsoDesbloqueado,
  registrarFondoCreado,
} from '../middleware/bitacoraHelpers.js';

const router = express.Router();
// @route   GET /api/fondos/debug
// @desc    Debug fondos y beneficiarios - TEMPORAL
// @access  Private (EquipoBNP)
router.get('/debug', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('🔧 === DEBUG FONDOS Y BENEFICIARIOS ===');
    
    // Obtener fondos sin populate
    const fondosSinPopulate = await Fondo.find({}).limit(5);
    console.log('📊 Fondos en BD (sin populate):', fondosSinPopulate.map(f => ({
      id: f._id,
      beneficiarioId: f.beneficiarioId,
      beneficiarioId_type: typeof f.beneficiarioId,
      beneficiarioId_exists: !!f.beneficiarioId
    })));
    
    // Obtener beneficiarios
    const beneficiarios = await Beneficiario.find({}).limit(5);
    console.log('👥 Beneficiarios en BD:', beneficiarios.map(b => ({
      id: b._id,
      nombre: b.nombre,
      apellido: b.apellido
    })));
    
    // Verificar si existen beneficiarios para los fondos
    const fondosConVerificacion = await Promise.all(
      fondosSinPopulate.map(async (fondo) => {
        let beneficiarioEncontrado = null;
        if (fondo.beneficiarioId) {
          beneficiarioEncontrado = await Beneficiario.findById(fondo.beneficiarioId);
        }
        
        return {
          fondoId: fondo._id,
          beneficiarioId: fondo.beneficiarioId,
          beneficiario_existe: !!beneficiarioEncontrado,
          beneficiario_nombre: beneficiarioEncontrado?.nombre || 'NO ENCONTRADO'
        };
      })
    );
    
    console.log('🔍 Verificación fondo-beneficiario:', fondosConVerificacion);
    
    res.json({
      success: true,
      debug: {
        fondos_total: fondosSinPopulate.length,
        beneficiarios_total: beneficiarios.length,
        fondos_sin_populate: fondosSinPopulate.map(f => ({
          id: f._id,
          beneficiarioId: f.beneficiarioId
        })),
        beneficiarios: beneficiarios.map(b => ({
          id: b._id,
          nombre: `${b.nombre} ${b.apellido}`
        })),
        verificacion: fondosConVerificacion
      }
    });
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/fondos/reparar-relaciones
// @desc    Reparar relaciones rotas entre fondos y beneficiarios
// @access  Private (EquipoBNP)
router.post('/reparar-relaciones', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('🔧 === REPARANDO RELACIONES FONDOS-BENEFICIARIOS ===');
    
    // Buscar fondos con beneficiarioId null o inválido
    const fondosProblematicos = await Fondo.find({
      $or: [
        { beneficiarioId: null },
        { beneficiarioId: { $exists: false } }
      ]
    });
    
    console.log(`❌ Fondos con problemas encontrados: ${fondosProblematicos.length}`);
    
    if (fondosProblematicos.length === 0) {
      return res.json({
        success: true,
        mensaje: 'No se encontraron fondos con problemas',
        fondos_reparados: 0
      });
    }
    
    // Obtener beneficiarios sin fondos
    const todosLosBeneficiarios = await Beneficiario.find({});
    const beneficiariosConFondo = await Fondo.distinct('beneficiarioId', {
      beneficiarioId: { $ne: null }
    });
    
    const beneficiariosSinFondo = todosLosBeneficiarios.filter(
      b => !beneficiariosConFondo.some(id => id && id.toString() === b._id.toString())
    );
    
    console.log(`👥 Beneficiarios sin fondo: ${beneficiariosSinFondo.length}`);
    console.log(`🏦 Fondos problemáticos: ${fondosProblematicos.length}`);
    
    let reparados = 0;
    
    // Asignar beneficiarios a fondos problemáticos
    for (let i = 0; i < Math.min(fondosProblematicos.length, beneficiariosSinFondo.length); i++) {
      const fondo = fondosProblematicos[i];
      const beneficiario = beneficiariosSinFondo[i];
      
      fondo.beneficiarioId = beneficiario._id;
      await fondo.save();
      
      console.log(`✅ Asignado beneficiario ${beneficiario.nombre} ${beneficiario.apellido} al fondo ${fondo._id}`);
      reparados++;
    }
    
    res.json({
      success: true,
      mensaje: `Se repararon ${reparados} relaciones fondo-beneficiario`,
      fondos_reparados: reparados,
      fondos_problemáticos_restantes: fondosProblematicos.length - reparados
    });
    
  } catch (error) {
    console.error('❌ Error reparando relaciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// @route   POST /api/fondos/reparar-relaciones-forzado
// @desc    Reparar relaciones NULL entre fondos y beneficiarios
// @access  Private (EquipoBNP)
router.post('/reparar-relaciones-forzado', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('🔧 === REPARACIÓN FORZADA DE RELACIONES ===');
    
    // CORRECCIÓN: Buscar fondos con beneficiarioId explícitamente null
    const fondosProblematicos = await Fondo.find({
      beneficiarioId: null
    });
    
    console.log(`❌ Fondos con beneficiarioId NULL: ${fondosProblematicos.length}`);
    
    if (fondosProblematicos.length === 0) {
      return res.json({
        success: true,
        mensaje: 'No se encontraron fondos con beneficiarioId NULL',
        fondos_reparados: 0
      });
    }
    
    // Obtener TODOS los beneficiarios
    const todosLosBeneficiarios = await Beneficiario.find({});
    console.log(`👥 Total beneficiarios disponibles: ${todosLosBeneficiarios.length}`);
    
    // Obtener fondos que SÍ tienen beneficiario asignado
    const fondosConBeneficiario = await Fondo.find({
      beneficiarioId: { $ne: null }
    }).populate('beneficiarioId', 'nombre apellido');
    
    console.log(`🏦 Fondos que ya tienen beneficiario: ${fondosConBeneficiario.length}`);
    
    // IDs de beneficiarios que YA tienen fondo
    const beneficiariosConFondo = fondosConBeneficiario.map(f => f.beneficiarioId._id.toString());
    
    // Beneficiarios que NO tienen fondo asignado
    const beneficiariosSinFondo = todosLosBeneficiarios.filter(
      b => !beneficiariosConFondo.includes(b._id.toString())
    );
    
    console.log(`🆓 Beneficiarios SIN fondo: ${beneficiariosSinFondo.length}`);
    console.log('📋 Beneficiarios sin fondo:', beneficiariosSinFondo.map(b => `${b.nombre} ${b.apellido}`));
    
    let reparados = 0;
    const asignaciones = [];
    
    // Asignar beneficiarios disponibles a fondos huérfanos
    for (let i = 0; i < Math.min(fondosProblematicos.length, beneficiariosSinFondo.length); i++) {
      const fondo = fondosProblematicos[i];
      const beneficiario = beneficiariosSinFondo[i];
      
      // Asignar beneficiario al fondo
      fondo.beneficiarioId = beneficiario._id;
      
      // Agregar entrada al historial
      fondo.historial_movimientos.push({
        tipo: 'ajuste_manual',
        descripcion: `Beneficiario asignado: ${beneficiario.nombre} ${beneficiario.apellido}`,
        realizado_por: req.usuario._id,
        fecha: new Date()
      });
      
      await fondo.save();
      
      const asignacion = {
        fondoId: fondo._id,
        beneficiarioId: beneficiario._id,
        beneficiarioNombre: `${beneficiario.nombre} ${beneficiario.apellido}`
      };
      
      asignaciones.push(asignacion);
      console.log(`✅ ASIGNADO: Beneficiario "${beneficiario.nombre} ${beneficiario.apellido}" → Fondo ${fondo._id}`);
      reparados++;
    }
    
    res.json({
      success: true,
      mensaje: `✅ Se repararon ${reparados} fondos exitosamente`,
      fondos_reparados: reparados,
      fondos_problemáticos_encontrados: fondosProblematicos.length,
      beneficiarios_disponibles: beneficiariosSinFondo.length,
      asignaciones: asignaciones,
      fondos_restantes_sin_beneficiario: fondosProblematicos.length - reparados
    });
    
  } catch (error) {
    console.error('❌ Error en reparación forzada:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// @route   GET /api/fondos
// @desc    Obtener todos los fondos con filtros
// @access  Private (EquipoBNP)
router.get('/', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estado, page = 1, limit = 10, buscar } = req.query;

    // Construir filtro
    const filtro = {};
    if (estado) {
      filtro.estado = estado;
    }

    let query = Fondo.find(filtro)
      .populate({
        path: 'beneficiarioId',
        select: 'nombre apellido correo usuario_id',
        populate: {
          path: 'usuario_id',
          select: 'nombre_usuario correo'
        }
      })
      .populate('creado_por', 'nombre_usuario')
      .populate('bloqueo.bloqueado_por', 'nombre_usuario');

    // Búsqueda por nombre/email del beneficiario
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
      query = Fondo.find(filtro)
        .populate({
          path: 'beneficiarioId',
          select: 'nombre apellido correo usuario_id',
          populate: {
            path: 'usuario_id',
            select: 'nombre_usuario correo'
          }
        })
        .populate('creado_por', 'nombre_usuario')
        .populate('bloqueo.bloqueado_por', 'nombre_usuario');
    }

    const fondos = await query
      .sort({ fecha_creacion: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Fondo.countDocuments(filtro);

    // Actualizar estados vencidos
    for (const fondo of fondos) {
      if (fondo.estaVencido() && ['activo', 'bloqueado'].includes(fondo.estado)) {
        fondo.estado = fondo.estado === 'activo' ? 'vencido' : 'bloqueado_vencido';
        await fondo.save();
      }
    }

    res.json({
      success: true,
      fondos,
      paginacion: {
        total,
        pagina_actual: parseInt(page),
        total_paginas: Math.ceil(total / parseInt(limit)),
        por_pagina: parseInt(limit)
      }
    });
console.log('🔍 DEBUG: Fondos obtenidos:', fondos.length);
if (fondos.length > 0) {
  console.log('🔍 DEBUG: Primer fondo:', {
    id: fondos[0]._id,
    beneficiarioId: fondos[0].beneficiarioId,
    tiene_beneficiario: !!fondos[0].beneficiarioId,
    nombre_beneficiario: fondos[0].beneficiarioId?.nombre,
    apellido_beneficiario: fondos[0].beneficiarioId?.apellido,
    correo_beneficiario: fondos[0].beneficiarioId?.correo
  });
}
  } catch (error) {
    console.error('❌ Error al obtener fondos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   POST /api/fondos/crear
// @desc    Crear un nuevo fondo para un beneficiario
// @access  Private (EquipoBNP)
router.post('/crear', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { beneficiarioId, monto = 500, dias = 365 } = req.body;

    console.log('🏦 Creando fondo para beneficiario:', beneficiarioId);

    // Verificar que el beneficiario existe
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar que no tenga ya un fondo
    const fondoExistente = await Fondo.findOne({ beneficiarioId });
    if (fondoExistente) {
      return res.status(400).json({
        success: false,
        mensaje: 'El beneficiario ya tiene un fondo asignado',
        fondo_existente: fondoExistente._id
      });
    }

    // Calcular fecha de vencimiento
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + parseInt(dias));

    // Crear el fondo
    const nuevoFondo = new Fondo({
      beneficiarioId,
      monto_inicial: {
        valor: parseFloat(monto),
        moneda: 'USD'
      },
      saldo_actual: {
        valor: parseFloat(monto),
        moneda: 'USD'
      },
      fecha_vencimiento: fechaVencimiento,
      auto_renovacion: {
        habilitada: true,
        proxima_renovacion: fechaVencimiento
      },
      configuracion: {
        dias_periodo: parseInt(dias)
      },
      creado_por: req.usuario._id,
      historial_movimientos: [{
        tipo: 'creacion',
        monto_anterior: 0,
        monto_nuevo: parseFloat(monto),
        descripcion: `Fondo creado con $${monto} por ${dias} días`,
        realizado_por: req.usuario._id
      }]
    });

    await nuevoFondo.save();

try {
  await registrarFondoCreado({
    beneficiario_nombre: beneficiario.nombre && beneficiario.apellido 
      ? `${beneficiario.nombre} ${beneficiario.apellido}` : 'Beneficiario',
    beneficiario_id: beneficiario._id,
    beneficiario_codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
    fondo_id: nuevoFondo._id,
    monto_inicial: parseFloat(monto),
    dias_periodo: parseInt(dias),
    fecha_vencimiento: fechaVencimiento
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}
    // Poblar datos para respuesta
    await nuevoFondo.populate([
      {
        path: 'beneficiarioId',
        select: 'nombre apellido correo',
        populate: {
          path: 'usuario_id',
          select: 'nombre_usuario correo'
        }
      },
      { path: 'creado_por', select: 'nombre_usuario' }
    ]);

    console.log('✅ Fondo creado exitosamente:', nuevoFondo._id);

    res.status(201).json({
      success: true,
      mensaje: 'Fondo creado exitosamente',
      fondo: nuevoFondo
    });

  } catch (error) {
    console.error('❌ Error al crear fondo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   POST /api/fondos/:id/bloquear
// @desc    Bloquear un fondo
// @access  Private (EquipoBNP)
router.post('/:id/bloquear', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { razon_bloqueo, razon_personalizada, monto_reactivacion = 250 } = req.body;

    const fondo = await Fondo.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido correo');

    if (!fondo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    if (fondo.bloqueo.bloqueado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El fondo ya está bloqueado'
      });
    }

    await fondo.bloquear(
      razon_bloqueo,
      razon_personalizada,
      parseFloat(monto_reactivacion),
      req.usuario._id
    );
try {
  await registrarReembolsoBloqueado({
    beneficiario_nombre: fondo.beneficiarioId?.nombre && fondo.beneficiarioId?.apellido 
      ? `${fondo.beneficiarioId.nombre} ${fondo.beneficiarioId.apellido}`
      : 'Beneficiario',
    beneficiario_id: fondo.beneficiarioId?._id,
    beneficiario_codigo: fondo.beneficiarioId?.codigo,
    fondo_id: fondo._id,
    razon_bloqueo: razon,
    razon_personalizada: razonPersonalizada
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}
    console.log('🚫 Fondo bloqueado:', fondo._id, 'Razón:', razon_bloqueo);

    res.json({
      success: true,
      mensaje: 'Fondo bloqueado exitosamente',
      fondo: {
        _id: fondo._id,
        estado: fondo.estado,
        bloqueo: fondo.bloqueo,
        beneficiario: fondo.beneficiarioId
      }
    });

  } catch (error) {
    console.error('❌ Error al bloquear fondo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   POST /api/fondos/:id/desbloquear
// @desc    Desbloquear un fondo - CORREGIDO
// @access  Private (EquipoBNP)
router.post('/:id/desbloquear', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('🔓 === INICIANDO DESBLOQUEO DE FONDO ===');
    console.log('🔓 Fondo ID:', req.params.id);
    console.log('🔓 Usuario que desbloquea:', req.usuario._id, req.usuario.nombre_usuario);

    const fondo = await Fondo.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido correo');

    if (!fondo) {
      console.log('❌ Fondo no encontrado');
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    console.log('🔓 Fondo encontrado:', {
      id: fondo._id,
      estado: fondo.estado,
      bloqueado: fondo.bloqueo?.bloqueado,
      beneficiario: fondo.beneficiarioId?.nombre
    });

    // Verificar que el fondo esté bloqueado
    if (!fondo.bloqueo || !fondo.bloqueo.bloqueado) {
      console.log('❌ El fondo no está bloqueado');
      return res.status(400).json({
        success: false,
        mensaje: 'El fondo no está bloqueado',
        estado_actual: fondo.estado,
        bloqueado: fondo.bloqueo?.bloqueado || false
      });
    }

    console.log('🔓 Procediendo a desbloquear...');

    // Usar el método de desbloqueo del modelo
    const fondoDesbloqueado = await fondo.desbloquear(req.usuario._id);
    try {
  await registrarReembolsoDesbloqueado({
    beneficiario_nombre: fondoDesbloqueado.beneficiarioId?.nombre && fondoDesbloqueado.beneficiarioId?.apellido 
      ? `${fondoDesbloqueado.beneficiarioId.nombre} ${fondoDesbloqueado.beneficiarioId.apellido}`
      : 'Beneficiario',
    beneficiario_id: fondoDesbloqueado.beneficiarioId?._id,
    beneficiario_codigo: fondoDesbloqueado.beneficiarioId?.codigo,
    fondo_id: fondoDesbloqueado._id
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}

    console.log('✅ Fondo desbloqueado exitosamente:', {
      id: fondoDesbloqueado._id,
      nuevo_estado: fondoDesbloqueado.estado,
      bloqueado: fondoDesbloqueado.bloqueo?.bloqueado,
      saldo: fondoDesbloqueado.saldo_actual?.valor
    });

    res.json({
      success: true,
      mensaje: 'Fondo desbloqueado exitosamente',
      fondo: {
        _id: fondoDesbloqueado._id,
        estado: fondoDesbloqueado.estado,
        saldo_actual: fondoDesbloqueado.saldo_actual,
        bloqueo: {
          bloqueado: fondoDesbloqueado.bloqueo.bloqueado,
          fecha_desbloqueo: fondoDesbloqueado.bloqueo.fecha_desbloqueo,
          desbloqueado_por: req.usuario.nombre_usuario
        },
        beneficiario: {
          nombre: fondoDesbloqueado.beneficiarioId?.nombre,
          apellido: fondoDesbloqueado.beneficiarioId?.apellido
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fatal al desbloquear fondo:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor al desbloquear fondo',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}); 
// @route   POST /api/fondos/:id/renovar
// @desc    Renovar un fondo
// @access  Private (EquipoBNP)
router.post('/:id/renovar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const fondo = await Fondo.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido correo');

    if (!fondo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    console.log('🔄 ANTES de renovar:', {
      id: fondo._id,
      estado: fondo.estado,
      fechaVencimiento: fondo.fecha_vencimiento,
      diasRestantes: fondo.calcularDiasRestantes()
    });

    if (!fondo.puedeRenovar()) {
      return res.status(400).json({
        success: false,
        mensaje: `No se puede renovar un fondo con estado: ${fondo.estado}`
      });
    }

    await fondo.renovar(req.usuario._id);

    try {
  await registrarReembolsoRenovado({
    beneficiario_nombre: fondo.beneficiarioId?.nombre && fondo.beneficiarioId?.apellido 
      ? `${fondo.beneficiarioId.nombre} ${fondo.beneficiarioId.apellido}`
      : 'Beneficiario',
    beneficiario_id: fondo.beneficiarioId?._id,
    beneficiario_codigo: fondo.beneficiarioId?.codigo,
    fondo_id: fondo._id,
    fecha_nueva_vencimiento: fondo.fecha_vencimiento,
    renovacion_numero: fondo.auto_renovacion?.contador_renovaciones || 0
  }, req);
} catch (err) {
  console.error('[BITÁCORA] Error:', err);
}
    console.log('🔄 DESPUÉS de renovar:', {
      id: fondo._id,
      estado: fondo.estado,
      fechaVencimiento: fondo.fecha_vencimiento,
      diasRestantes: fondo.calcularDiasRestantes()
    });

    // Verificar que se guardó en la base de datos
    const fondoVerificacion = await Fondo.findById(req.params.id);
    console.log('🔄 VERIFICACIÓN en DB:', {
      id: fondoVerificacion._id,
      estado: fondoVerificacion.estado,
      fechaVencimiento: fondoVerificacion.fecha_vencimiento
    });

    res.json({
      success: true,
      mensaje: 'Fondo renovado exitosamente',
      fondo: {
        _id: fondo._id,
        estado: fondo.estado,
        saldo_actual: fondo.saldo_actual,
        fecha_vencimiento: fondo.fecha_vencimiento,
        dias_restantes: fondo.calcularDiasRestantes(),
        beneficiario: fondo.beneficiarioId
      }
    });

  } catch (error) {
    console.error('❌ Error al renovar fondo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});
// @route   GET /api/fondos/:id
// @desc    Obtener detalles de un fondo específico
// @access  Private (EquipoBNP)
router.get('/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const fondo = await Fondo.findById(req.params.id)
      .populate({
        path: 'beneficiarioId',
        select: 'nombre apellido correo usuario_id',
        populate: {
          path: 'usuario_id',
          select: 'nombre_usuario correo'
        }
      })
      .populate('creado_por', 'nombre_usuario')
      .populate('bloqueo.bloqueado_por', 'nombre_usuario')
      .populate('historial_movimientos.realizado_por', 'nombre_usuario');

    if (!fondo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    // Verificar vencimiento
    if (fondo.estaVencido() && ['activo', 'bloqueado'].includes(fondo.estado)) {
      fondo.estado = fondo.estado === 'activo' ? 'vencido' : 'bloqueado_vencido';
      await fondo.save();
    }

    // Obtener solicitudes relacionadas
    const solicitudes = await SolicitudReembolso.find({ fondoId: fondo._id })
      .sort({ fecha_solicitud: -1 })
      .limit(5);

    res.json({
      success: true,
      fondo: {
        ...fondo.toObject(),
        dias_restantes: fondo.calcularDiasRestantes(),
        esta_vencido: fondo.estaVencido(),
        puede_renovar: fondo.puedeRenovar(),
        puede_desbloquear: fondo.puedeDesbloquear()
      },
      solicitudes_recientes: solicitudes
    });

  } catch (error) {
    console.error('❌ Error al obtener fondo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});
// @route   PUT /api/fondos/:id/desactivar
// @desc    Desactivar un fondo
// @access  Private (EquipoBNP)
router.put('/:id/desactivar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('💤 === INICIANDO DESACTIVACIÓN DE FONDO ===');
    console.log('💤 Fondo ID:', req.params.id);
    console.log('💤 Usuario que desactiva:', req.usuario._id, req.usuario.nombre_usuario);
    console.log('💤 Datos recibidos:', req.body);

    const { razon_desactivacion, razon_personalizada, preservar_saldo = true } = req.body;

    const fondo = await Fondo.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido correo');

    if (!fondo) {
      console.log('❌ Fondo no encontrado');
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    console.log('💤 Fondo encontrado:', {
      id: fondo._id,
      estado: fondo.estado,
      beneficiario: fondo.beneficiarioId?.nombre
    });

    // Verificar que el fondo se pueda desactivar
    if (!fondo.puedeDesactivar()) {
      console.log('❌ El fondo no se puede desactivar, estado:', fondo.estado);
      return res.status(400).json({
        success: false,
        mensaje: `No se puede desactivar un fondo con estado: ${fondo.estado}`,
        estado_actual: fondo.estado
      });
    }

    // Validar razón de desactivación
    if (!razon_desactivacion) {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar una razón para la desactivación'
      });
    }

    console.log('💤 Procediendo a desactivar...');

    // Usar el método de desactivación del modelo
    const fondoDesactivado = await fondo.desactivar(
      razon_desactivacion,
      razon_personalizada,
      preservar_saldo,
      req.usuario._id
    );

    console.log('✅ Fondo desactivado exitosamente:', {
      id: fondoDesactivado._id,
      nuevo_estado: fondoDesactivado.estado,
      saldo_preservado: preservar_saldo,
      saldo: fondoDesactivado.saldo_actual?.valor
    });

    res.json({
      success: true,
      mensaje: 'Fondo desactivado exitosamente',
      fondo: {
        _id: fondoDesactivado._id,
        estado: fondoDesactivado.estado,
        saldo_actual: fondoDesactivado.saldo_actual,
        desactivacion: {
          fecha_desactivacion: fondoDesactivado.desactivacion.fecha_desactivacion,
          razon_desactivacion: fondoDesactivado.desactivacion.razon_desactivacion,
          razon_personalizada: fondoDesactivado.desactivacion.razon_personalizada,
          preservar_saldo: fondoDesactivado.desactivacion.preservar_saldo,
          desactivado_por: req.usuario.nombre_usuario
        },
        beneficiario: {
          nombre: fondoDesactivado.beneficiarioId?.nombre,
          apellido: fondoDesactivado.beneficiarioId?.apellido
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fatal al desactivar fondo:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor al desactivar fondo',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// @route   PUT /api/fondos/:id/reactivar
// @desc    Reactivar un fondo desactivado
// @access  Private (EquipoBNP)
router.put('/:id/reactivar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('⚡ === INICIANDO REACTIVACIÓN DE FONDO ===');
    console.log('⚡ Fondo ID:', req.params.id);
    console.log('⚡ Usuario que reactiva:', req.usuario._id, req.usuario.nombre_usuario);
    console.log('⚡ Datos recibidos:', req.body);

    const { fecha_vencimiento } = req.body;

    const fondo = await Fondo.findById(req.params.id)
      .populate('beneficiarioId', 'nombre apellido correo');

    if (!fondo) {
      console.log('❌ Fondo no encontrado');
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    console.log('⚡ Fondo encontrado:', {
      id: fondo._id,
      estado: fondo.estado,
      beneficiario: fondo.beneficiarioId?.nombre
    });

    // Verificar que el fondo se pueda reactivar
    if (!fondo.puedeReactivar()) {
      console.log('❌ El fondo no se puede reactivar, estado:', fondo.estado);
      return res.status(400).json({
        success: false,
        mensaje: `No se puede reactivar un fondo con estado: ${fondo.estado}`,
        estado_actual: fondo.estado
      });
    }

    console.log('⚡ Procediendo a reactivar...');

    // Usar el método de reactivación del modelo
    const fondoReactivado = await fondo.reactivar(fecha_vencimiento, req.usuario._id);

    console.log('✅ Fondo reactivado exitosamente:', {
      id: fondoReactivado._id,
      nuevo_estado: fondoReactivado.estado,
      nueva_fecha_vencimiento: fondoReactivado.fecha_vencimiento,
      saldo: fondoReactivado.saldo_actual?.valor
    });

    res.json({
      success: true,
      mensaje: 'Fondo reactivado exitosamente',
      fondo: {
        _id: fondoReactivado._id,
        estado: fondoReactivado.estado,
        saldo_actual: fondoReactivado.saldo_actual,
        fecha_vencimiento: fondoReactivado.fecha_vencimiento,
        dias_restantes: fondoReactivado.calcularDiasRestantes(),
        desactivacion: {
          reactivado_por: req.usuario.nombre_usuario,
          fecha_reactivacion: fondoReactivado.desactivacion.fecha_reactivacion
        },
        beneficiario: {
          nombre: fondoReactivado.beneficiarioId?.nombre,
          apellido: fondoReactivado.beneficiarioId?.apellido
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fatal al reactivar fondo:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor al reactivar fondo',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// @route   PUT /api/fondos/:id/ajustar-saldo
// @desc    Ajustar manualmente el saldo de un fondo
// @access  Private (EquipoBNP)
router.put('/:id/ajustar-saldo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { nuevo_saldo, motivo } = req.body;

    const fondo = await Fondo.findById(req.params.id);
    if (!fondo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Fondo no encontrado'
      });
    }

    const saldoAnterior = fondo.saldo_actual.valor;
    fondo.saldo_actual.valor = parseFloat(nuevo_saldo);
    fondo.actualizado_por = req.usuario._id;

    // Agregar al historial
    fondo.historial_movimientos.push({
      tipo: 'ajuste_manual',
      monto_anterior: saldoAnterior,
      monto_nuevo: parseFloat(nuevo_saldo),
      descripcion: motivo || `Ajuste manual de saldo de ${saldoAnterior} a ${nuevo_saldo}`,
      realizado_por: req.usuario._id
    });

    await fondo.save();

    console.log('💰 Saldo ajustado:', fondo._id, `${saldoAnterior} → ${nuevo_saldo}`);

    res.json({
      success: true,
      mensaje: 'Saldo ajustado exitosamente',
      saldo_anterior: saldoAnterior,
      saldo_nuevo: parseFloat(nuevo_saldo)
    });

  } catch (error) {
    console.error('❌ Error al ajustar saldo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   GET /api/fondos/estadisticas/resumen
// @desc    Obtener estadísticas generales de fondos
// @access  Private (EquipoBNP)
router.get('/estadisticas/resumen', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const estadisticas = await Fondo.aggregate([
      {
        $group: {
          _id: '$estado',
          cantidad: { $sum: 1 },
          saldo_total: { $sum: '$saldo_actual.valor' },
          monto_inicial_total: { $sum: '$monto_inicial.valor' }
        }
      }
    ]);

    const resumen = {
      total_fondos: 0,
      activos: 0,
      bloqueados: 0,
      vencidos: 0,
      bloqueados_vencidos: 0,
      saldo_total_activo: 0,
      monto_total_asignado: 0
    };

    estadisticas.forEach(stat => {
      resumen.total_fondos += stat.cantidad;
      resumen.monto_total_asignado += stat.monto_inicial_total;
      
      switch (stat._id) {
        case 'activo':
          resumen.activos = stat.cantidad;
          resumen.saldo_total_activo += stat.saldo_total;
          break;
        case 'bloqueado':
          resumen.bloqueados = stat.cantidad;
          break;
        case 'vencido':
          resumen.vencidos = stat.cantidad;
          break;
        case 'bloqueado_vencido':
          resumen.bloqueados_vencidos = stat.cantidad;
          break;
      }
    });

    // Verificar fondos que vencen pronto (próximos 30 días)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 30);

    const fondosVencenPronto = await Fondo.countDocuments({
      estado: 'activo',
      fecha_vencimiento: { $lte: fechaLimite }
    });

    resumen.vencen_pronto = fondosVencenPronto;

    res.json({
      success: true,
      estadisticas: resumen
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

// @route   POST /api/fondos/verificar-vencimientos
// @desc    Verificar y actualizar fondos vencidos (tarea de mantenimiento)
// @access  Private (EquipoBNP)
router.post('/verificar-vencimientos', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const fondosActualizados = await Fondo.verificarVencimientos();

    res.json({
      success: true,
      mensaje: `Se actualizaron ${fondosActualizados} fondos vencidos`,
      fondos_actualizados: fondosActualizados
    });

  } catch (error) {
    console.error('❌ Error al verificar vencimientos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});


export default router;