import express from 'express';
import jwt from 'jsonwebtoken';
import { MetodoPago } from '../models/MetodoPago.js';
import { Beneficiario } from '../models/Beneficiario.js';

const router = express.Router();

// =============== MIDDLEWARE DE AUTENTICACIÓN UNIFICADO ===============
const checkAuth = async (req, res, next) => {
  try {
    console.log('🔐 === CHECKAUTH MÉTODOS PAGO ===');
    console.log('  URL:', req.originalUrl);
    console.log('  Method:', req.method);
    console.log('  Headers Authorization:', req.headers.authorization ? 'Presente' : 'Ausente');
    
    let token = null;
    
    // Obtener token de múltiples fuentes
    if (req.headers.authorization) {
      if (req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      } else {
        token = req.headers.authorization;
      }
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      console.log('❌ No hay token en métodos-pago');
      return res.status(401).json({ 
        success: false,
        message: 'No hay token, acceso denegado',
        debug: {
          hasAuthHeader: !!req.headers.authorization,
          hasCookies: !!req.cookies
        }
      });
    }

    console.log('🔍 Verificando token...');

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decodificado:', {
      id: decoded.id || decoded._id,
      tipo: decoded.tipo,
      nombre: decoded.nombre_usuario
    });
    
    // Configurar usuario en request
    req.usuario = {
      _id: decoded.id || decoded._id,
      id: decoded.id || decoded._id,
      tipo: decoded.tipo,
      nombre_usuario: decoded.nombre_usuario,
      correo: decoded.correo,
      ...decoded
    };
    
    req.user = req.usuario;
    req.tipo = decoded.tipo;
    
    next();
  } catch (error) {
    console.error('❌ Error en autenticación métodos-pago:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token malformado',
        code: 'MALFORMED_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expirado',
        code: 'EXPIRED_TOKEN'
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Error de autenticación', 
      code: 'AUTH_ERROR',
      error: error.message 
    });
  }
};

// =============== MIDDLEWARE PARA VERIFICAR BENEFICIARIO ===============
const verificarBeneficiario = async (req, res, next) => {
  try {
    console.log('👤 === VERIFICAR BENEFICIARIO ===');
    console.log('  Tipo usuario:', req.tipo);
    console.log('  Usuario ID:', req.usuario._id);
    
    if (req.tipo !== 'beneficiario') {
      return res.status(403).json({ 
        success: false,
        error: 'Acceso denegado - Solo beneficiarios pueden gestionar métodos de pago',
        tipo_actual: req.tipo 
      });
    }

    // Buscar el beneficiario por usuario_id
    const beneficiario = await Beneficiario.findOne({ 
      usuario_id: req.usuario._id.toString() 
    });
    
    if (!beneficiario) {
      console.log('❌ No se encontró beneficiario para usuario:', req.usuario._id);
      return res.status(404).json({ 
        success: false,
        error: 'No se encontró perfil de beneficiario para este usuario',
        usuario_id: req.usuario._id.toString()
      });
    }
    
    console.log('✅ Beneficiario encontrado:', beneficiario._id);
    req.beneficiario = beneficiario;
    
    next();
  } catch (error) {
    console.error('❌ Error verificando beneficiario:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Aplicar middleware de autenticación a todas las rutas
router.use(checkAuth);

// =============== OBTENER MÉTODOS DE PAGO DEL BENEFICIARIO ===============
router.get('/mis-metodos', verificarBeneficiario, async (req, res) => {
  try {
    console.log('📋 === GET MIS MÉTODOS ===');
    console.log('  Beneficiario ID:', req.beneficiario._id);
    
    const beneficiarioId = req.beneficiario._id;
    
    const metodosPago = await MetodoPago.find({ 
      beneficiarioId: beneficiarioId 
    })
    .select('-__v')
    .sort({ fecha_creacion: -1 });

    console.log('✅ Métodos encontrados:', metodosPago.length);

    // Transformar los métodos al formato esperado por el frontend
    const metodosTransformados = metodosPago.map(metodo => ({
      _id: metodo._id,
      nombre: metodo.nombre,
      tipo_cuenta: metodo.tipo_cuenta,
      informacion_bancaria: metodo.informacion_bancaria,
      activo: metodo.activo,
      veces_utilizado: metodo.veces_utilizado,
      ultimo_uso: metodo.ultimo_uso,
      fecha_creacion: metodo.fecha_creacion
    }));

    res.json({
      success: true,
      metodosPago: metodosTransformados,
      total: metodosTransformados.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo métodos de pago:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// =============== CREAR NUEVO MÉTODO DE PAGO ===============
router.post('/crear', verificarBeneficiario, async (req, res) => {
  try {
    console.log('📝 === POST CREAR MÉTODO ===');
    console.log('  Beneficiario ID:', req.beneficiario._id);
    console.log('  Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const beneficiarioId = req.beneficiario._id;
    const datosMetodo = req.body;

    // Validaciones básicas
    if (!datosMetodo.nombre || !datosMetodo.tipo_cuenta) {
      return res.status(400).json({ 
        success: false,
        error: 'Nombre y tipo de cuenta son requeridos' 
      });
    }

    // Validar información bancaria según tipo
    if (!datosMetodo.informacion_bancaria) {
      return res.status(400).json({ 
        success: false,
        error: 'Información bancaria es requerida' 
      });
    }

    const infoBancaria = datosMetodo.informacion_bancaria;

    // Validaciones específicas por tipo de cuenta
    switch (datosMetodo.tipo_cuenta) {
      case 'cuenta_bancaria':
        if (!infoBancaria.nombre_banco || !infoBancaria.numero_cuenta) {
          return res.status(400).json({ 
            success: false,
            error: 'Para cuenta bancaria: nombre del banco y número de cuenta son requeridos' 
          });
        }
        break;
        
      case 'paypal':
        if (!infoBancaria.email_paypal) {
          return res.status(400).json({ 
            success: false,
            error: 'Para PayPal: email es requerido' 
          });
        }
        break;
        
      case 'zelle':
        if (!infoBancaria.telefono_zelle && !infoBancaria.email_zelle) {
          return res.status(400).json({ 
            success: false,
            error: 'Para Zelle: teléfono o email son requeridos' 
          });
        }
        break;
        
      case 'wise':
        if (!infoBancaria.email_wise) {
          return res.status(400).json({ 
            success: false,
            error: 'Para Wise: email es requerido' 
          });
        }
        break;
        case 'otro':
  if (!infoBancaria.nombre_metodo_otro || !infoBancaria.detalles_metodo_otro) {
    return res.status(400).json({ 
      success: false,
      error: 'Para método personalizado: nombre y detalles son requeridos' 
    });
  }
  break;
      case 'transferencia_internacional':
        if (!infoBancaria.codigo_swift) {
          return res.status(400).json({ 
            success: false,
            error: 'Para transferencia internacional: código SWIFT es requerido' 
          });
        }
        break;
    }

    // Validar información del titular
    if (!infoBancaria.nombre_titular || !infoBancaria.apellido_titular) {
      return res.status(400).json({ 
        success: false,
        error: 'Nombre y apellido del titular son requeridos' 
      });
    }

    // Crear el método de pago
    const nuevoMetodo = new MetodoPago({
      beneficiarioId: beneficiarioId,
      nombre: datosMetodo.nombre,
      tipo_cuenta: datosMetodo.tipo_cuenta,
      informacion_bancaria: infoBancaria,
      activo: true,
      veces_utilizado: 0,
      creado_por: req.usuario._id
    });

    console.log('💾 Guardando método de pago...');
    const metodoGuardado = await nuevoMetodo.save();
    
    console.log('✅ Método guardado exitosamente:', metodoGuardado._id);

    // Poblar datos para respuesta
    await metodoGuardado.populate('beneficiarioId', 'nombre apellido correo');

    res.status(201).json({
      success: true,
      message: 'Método de pago creado exitosamente',
      metodoPago: {
        _id: metodoGuardado._id,
        nombre: metodoGuardado.nombre,
        tipo_cuenta: metodoGuardado.tipo_cuenta,
        informacion_bancaria: metodoGuardado.informacion_bancaria,
        activo: metodoGuardado.activo,
        fecha_creacion: metodoGuardado.fecha_creacion
      }
    });

  } catch (error) {
    console.error('❌ Error creando método de pago:', error);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        error: 'Error de validación: ' + mensajes.join(', '),
        detalles: mensajes
      });
    }
    
    // Manejar errores de duplicados
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'Ya existe un método con esos datos'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// =============== ACTUALIZAR MÉTODO DE PAGO ===============
router.put('/:metodoId', verificarBeneficiario, async (req, res) => {
  try {
    console.log('📝 === PUT ACTUALIZAR MÉTODO ===');
    console.log('  Método ID:', req.params.metodoId);
    console.log('  Beneficiario ID:', req.beneficiario._id);
    
    const { metodoId } = req.params;
    const beneficiarioId = req.beneficiario._id;
    const datosActualizacion = req.body;

    // Verificar que el método pertenece al beneficiario
    const metodoExistente = await MetodoPago.findOne({
      _id: metodoId,
      beneficiarioId: beneficiarioId
    });

    if (!metodoExistente) {
      return res.status(404).json({ 
        success: false,
        error: 'Método de pago no encontrado o no pertenece a este beneficiario' 
      });
    }

    // Actualizar campos permitidos
    const camposPermitidos = ['nombre', 'informacion_bancaria', 'activo'];
    const actualizacion = {};
    
    camposPermitidos.forEach(campo => {
      if (datosActualizacion[campo] !== undefined) {
        actualizacion[campo] = datosActualizacion[campo];
      }
    });

    actualizacion.actualizado_por = req.usuario._id;
    actualizacion.fecha_actualizacion = new Date();

    const metodoActualizado = await MetodoPago.findByIdAndUpdate(
      metodoId,
      actualizacion,
      { new: true, runValidators: true }
    ).populate('beneficiarioId', 'nombre apellido correo');

    console.log('✅ Método actualizado exitosamente:', metodoId);

    res.json({
      success: true,
      message: 'Método de pago actualizado exitosamente',
      metodoPago: metodoActualizado
    });

  } catch (error) {
    console.error('❌ Error actualizando método de pago:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// =============== ELIMINAR MÉTODO DE PAGO ===============
router.delete('/:metodoId', verificarBeneficiario, async (req, res) => {
  try {
    console.log('🗑️ === DELETE MÉTODO ===');
    
    const { metodoId } = req.params;
    const beneficiarioId = req.beneficiario._id;

    // Verificar que el método pertenece al beneficiario
    const metodoExistente = await MetodoPago.findOne({
      _id: metodoId,
      beneficiarioId: beneficiarioId
    });

    if (!metodoExistente) {
      return res.status(404).json({ 
        success: false,
        error: 'Método de pago no encontrado' 
      });
    }

    // Verificar que no sea el único método de pago
    const cantidadMetodos = await MetodoPago.countDocuments({
      beneficiarioId: beneficiarioId,
      activo: true
    });

    if (cantidadMetodos === 1) {
      return res.status(400).json({ 
        success: false,
        error: 'No puedes eliminar tu único método de pago activo. Agrega otro método antes de eliminar este.' 
      });
    }

    await MetodoPago.findByIdAndDelete(metodoId);

    console.log('✅ Método eliminado exitosamente:', metodoId);

    res.json({ 
      success: true,
      message: 'Método de pago eliminado exitosamente' 
    });

  } catch (error) {
    console.error('❌ Error eliminando método de pago:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// =============== OBTENER MÉTODO ESPECÍFICO ===============
router.get('/:metodoId', verificarBeneficiario, async (req, res) => {
  try {
    const { metodoId } = req.params;
    const beneficiarioId = req.beneficiario._id;

    const metodoPago = await MetodoPago.findOne({
      _id: metodoId,
      beneficiarioId: beneficiarioId
    }).populate('beneficiarioId', 'nombre apellido correo');

    if (!metodoPago) {
      return res.status(404).json({ 
        success: false,
        error: 'Método de pago no encontrado' 
      });
    }

    res.json({
      success: true,
      metodoPago
    });
  } catch (error) {
    console.error('❌ Error obteniendo método de pago:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;