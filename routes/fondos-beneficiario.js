import express from 'express';
import { Fondo } from '../models/Fondo.js';
import { SolicitudReembolso } from '../models/SolicitudReembolso.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isBeneficiario } from '../middleware/auth.js';
import multer from 'multer';
import { MetodoPago } from '../models/MetodoPago.js';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// subida de archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG'));
    }
  }
});

// Middleware personalizado para debug de auth en fondos
const debugFondosAuth = (req, res, next) => {
  console.log('🏦 === DEBUG FONDOS AUTH ===');
  console.log('🔑 Headers Authorization:', req.headers.authorization ? 'Presente' : 'Ausente');
  console.log('👤 Usuario en req.usuario:', req.usuario ? 'Presente' : 'Ausente');
  console.log('🎯 Tipo en req.tipo:', req.tipo);
  console.log('👥 Beneficiario en req.beneficiario:', req.beneficiario ? 'Presente' : 'Ausente');
  
  if (req.usuario) {
    console.log('👤 Datos usuario:', {
      id: req.usuario._id,
      nombre: req.usuario.nombre_usuario,
      tipo: req.usuario.tipo
    });
  }
  
  if (req.beneficiario) {
    console.log('👥 Datos beneficiario:', {
      id: req.beneficiario._id,
      nombre: req.beneficiario.nombre
    });
  }
  
  console.log('🏦 === FIN DEBUG FONDOS AUTH ===');
  next();
};

// @route   GET /api/beneficiario/fondos/mi-fondo
// @desc    Obtener información del fondo del beneficiario autenticado
// @access  Private (Beneficiario)
router.get('/mi-fondo', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('🏦 === INICIANDO OBTENER MI FONDO ===');
    console.log('🏦 Obteniendo fondo para beneficiario:', req.beneficiario._id);

    const fondo = await Fondo.findOne({ 
      beneficiarioId: req.beneficiario._id 
    }).populate('creado_por', 'nombre_usuario');

    if (!fondo) {
      console.log('⚠️ No se encontró fondo para el beneficiario');
      return res.json({
        success: true,
        tiene_fondo: false,
        mensaje: 'No tienes un fondo asignado aún'
      });
    }

    console.log('✅ Fondo encontrado:', {
      id: fondo._id,
      saldo: fondo.saldo_actual?.valor,
      estado: fondo.estado
    });

    // Verificar si está vencido y actualizar estado si es necesario
    if (fondo.estaVencido() && fondo.estado === 'activo') {
      console.log('📅 Fondo vencido, actualizando estado...');
      fondo.estado = 'vencido';
      await fondo.save();
    }

    const diasRestantes = fondo.calcularDiasRestantes();

    res.json({
      success: true,
      tiene_fondo: true,
      fondo: {
        _id: fondo._id,
        saldo_actual: fondo.saldo_actual,
        monto_inicial: fondo.monto_inicial,
        estado: fondo.estado,
        fecha_vencimiento: fondo.fecha_vencimiento,
        dias_restantes: diasRestantes,
        esta_vencido: fondo.estaVencido(),
        puede_renovar: fondo.puedeRenovar(),
        bloqueo: fondo.bloqueo.bloqueado ? {
          bloqueado: fondo.bloqueo.bloqueado,
          fecha_bloqueo: fondo.bloqueo.fecha_bloqueo,
          razon_bloqueo: fondo.bloqueo.razon_bloqueo,
          razon_personalizada: fondo.bloqueo.razon_personalizada,
          monto_reactivacion: fondo.bloqueo.monto_reactivacion
        } : null,
        fecha_creacion: fondo.fecha_creacion,
        creado_por: fondo.creado_por?.nombre_usuario
      }
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
// @route   GET /api/beneficiario/fondos/metodos-pago
// @desc    Obtener métodos de pago guardados del beneficiario
// @access  Private (Beneficiario)
router.get('/metodos-pago', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('Obteniendo métodos de pago para beneficiario:', req.beneficiario._id);

    // Obtener métodos de pago del beneficiario
    const metodos = await MetodoPago.find({ 
      beneficiarioId: req.beneficiario._id 
    }).sort({ fecha_creacion: -1 });

    res.json({
      success: true,
      metodos
    });

  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   POST /api/beneficiario/fondos/solicitar-reembolso
// @desc    Crear nueva solicitud de reembolso - CORREGIDA PARA MÉTODOS GUARDADOS
// @access  Private (Beneficiario)
router.post('/solicitar-reembolso', checkAuth, debugFondosAuth, isBeneficiario, upload.array('documentos', 2), async (req, res) => {
  try {
    console.log('🚀 NUEVA SOLICITUD DE REEMBOLSO');
    console.log('👤 Beneficiario:', req.beneficiario._id);
    console.log('📋 Datos recibidos:', Object.keys(req.body));
    console.log('📄 Archivos recibidos:', req.files?.length || 0);

    const {
      // Información del reembolso
      tipo_reembolso,
      monto_solicitado,
      costo_boleto,
      fecha_vuelo,
      descripcion,
      
      // Método de pago
      tipo_cuenta,
      usar_metodo_guardado,
      metodo_guardado_id,
      guardar_metodo,
      nombre_metodo,
      
      // Campos para métodos NO guardados (fallback)
      nombre_banco,
      numero_cuenta,
      tipo_cuenta_bancaria,
      codigo_swift,
      numero_routing,
      iban,
      direccion_banco,
      email_paypal,
      telefono_zelle,
      email_zelle,
      email_wise,
      nombre_metodo_otro,
      detalles_metodo_otro,
      
      // Información del titular (puede venir del frontend o del método guardado)
      nombre_titular,
      apellido_titular,
      documento_tipo,
      documento_numero,
      direccion_titular,
      ciudad_titular,
      estado_provincia_titular,
      pais_titular,
      codigo_postal_titular,
      telefono_titular
    } = req.body;

    console.log('📋 Información del reembolso:', {
      tipo_reembolso,
      monto_solicitado,
      costo_boleto,
      fecha_vuelo,
      tipo_cuenta,
      usar_metodo_guardado,
      metodo_guardado_id
    });

    // Validaciones básicas
    if (!tipo_reembolso || !monto_solicitado || !costo_boleto || !tipo_cuenta) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: tipo_reembolso, monto_solicitado, costo_boleto, tipo_cuenta'
      });
    }

    // Verificar que tiene fondo
    const fondo = await Fondo.findOne({ 
      beneficiarioId: req.beneficiario._id 
    });

    if (!fondo) {
      return res.status(404).json({
        success: false,
        mensaje: 'No tienes un fondo asignado'
      });
    }

    // Verificar que el fondo está activo
    if (fondo.estado !== 'activo') {
      return res.status(400).json({
        success: false,
        mensaje: 'Tu fondo no está activo. Estado actual: ' + fondo.estado,
        estado_fondo: fondo.estado
      });
    }

    // Verificar que tiene saldo suficiente
    const montoSolicitadoNum = parseFloat(monto_solicitado);
    if (fondo.saldo_actual.valor < montoSolicitadoNum) {
      return res.status(400).json({
        success: false,
        mensaje: `Saldo insuficiente. Saldo actual: $${fondo.saldo_actual.valor}`,
        saldo_actual: fondo.saldo_actual.valor
      });
    }

    // NUEVO: Manejar método guardado vs nuevo método
    let informacionBancaria;
    
    if (usar_metodo_guardado === 'true' && metodo_guardado_id) {
      console.log('📋 Usando método guardado:', metodo_guardado_id);
      
      // Recuperar el método guardado de la base de datos
      try {
        const metodoGuardado = await MetodoPago.findOne({
          _id: metodo_guardado_id,
          beneficiarioId: req.beneficiario._id
        });
        
        if (!metodoGuardado) {
          return res.status(404).json({
            success: false,
            mensaje: 'Método de pago guardado no encontrado'
          });
        }
        
        console.log('✅ Método guardado encontrado:', metodoGuardado.nombre);
        console.log('📋 Tipo de cuenta del método:', metodoGuardado.tipo_cuenta);
        console.log('📋 Info bancaria completa:', JSON.stringify(metodoGuardado.informacion_bancaria, null, 2));
        
        // CORREGIDO: Usar toda la información bancaria del método guardado
         informacionBancaria = {
          tipo_cuenta: metodoGuardado.tipo_cuenta, // IMPORTANTE: Usar el tipo del método guardado
          ...metodoGuardado.informacion_bancaria, // Copiar TODA la información
          metodo_guardado_id: metodo_guardado_id,
          verificado: metodoGuardado.informacion_bancaria.verificado || false,
          fecha_verificacion: metodoGuardado.informacion_bancaria.fecha_verificacion || null,
          verificado_por: metodoGuardado.informacion_bancaria.verificado_por || null
        };
        
        console.log('✅ Información bancaria preparada:', {
          tipo_cuenta: informacionBancaria.tipo_cuenta,
          titular: `${informacionBancaria.nombre_titular} ${informacionBancaria.apellido_titular}`,
          metodo_guardado_id: informacionBancaria.metodo_guardado_id,
          tiene_swift: !!informacionBancaria.codigo_swift,
          tiene_direccion_banco: !!informacionBancaria.direccion_banco
        });
      } catch (error) {
        console.error('❌ Error recuperando método guardado:', error);
        return res.status(500).json({
          success: false,
          mensaje: 'Error al recuperar método de pago guardado'
        });
      }
      
    } else {
      console.log('📋 Creando nueva información bancaria');
      
      // Validar información del titular para métodos nuevos
      if (!nombre_titular || !apellido_titular || !documento_numero || 
          !direccion_titular || !ciudad_titular || !pais_titular || !telefono_titular) {
        return res.status(400).json({
          success: false,
          mensaje: 'Completa toda la información del titular'
        });
      }

      // Validaciones específicas por tipo para métodos nuevos
      let validationError = null;
      
      switch (tipo_cuenta) {
        case 'cuenta_bancaria':
          if (!nombre_banco || !numero_cuenta || !tipo_cuenta_bancaria) {
            validationError = 'Completa la información bancaria: nombre del banco, número de cuenta y tipo de cuenta';
          }
          break;
          
        case 'paypal':
          if (!email_paypal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_paypal)) {
            validationError = 'Ingresa un email de PayPal válido';
          }
          break;
          
        case 'transferencia_internacional':
          if (!codigo_swift || !direccion_banco) {
            validationError = 'Completa la información de transferencia: código SWIFT y dirección del banco';
          }
          break;
          
        case 'zelle':
          if (!telefono_zelle && !email_zelle) {
            validationError = 'Ingresa al menos un teléfono o email para Zelle';
          }
          break;
          
        case 'wise':
          if (!email_wise || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_wise)) {
            validationError = 'Ingresa un email de Wise válido';
          }
          break;
          
        case 'otro':
          if (!nombre_metodo_otro || !detalles_metodo_otro) {
            validationError = 'Completa el nombre y detalles del método de pago personalizado';
          }
          break;
          
        default:
          validationError = 'Método de pago no válido';
      }

      if (validationError) {
        return res.status(400).json({
          success: false,
          mensaje: validationError
        });
      }

      // Crear nueva información bancaria
      informacionBancaria = {
        tipo_cuenta,
        
        // Información del titular (obligatoria para todos)
        nombre_titular: nombre_titular.trim(),
        apellido_titular: apellido_titular.trim(),
        documento_titular: {
          tipo: documento_tipo,
          numero: documento_numero.trim()
        },
        direccion_titular: direccion_titular.trim(),
        ciudad_titular: ciudad_titular.trim(),
        estado_provincia_titular: estado_provincia_titular?.trim() || '',
        pais_titular: pais_titular.trim(),
        codigo_postal_titular: codigo_postal_titular?.trim() || '',
        telefono_titular: telefono_titular.trim(),
        
        // Campos específicos según el tipo
        ...(tipo_cuenta === 'cuenta_bancaria' && {
          nombre_banco: nombre_banco.trim(),
          numero_cuenta: numero_cuenta.trim(),
          tipo_cuenta_bancaria
        }),
        
        ...(tipo_cuenta === 'paypal' && {
          email_paypal: email_paypal.trim().toLowerCase()
        }),
        
        ...(tipo_cuenta === 'transferencia_internacional' && {
          nombre_banco: nombre_banco?.trim(),
          codigo_swift: codigo_swift.trim().toUpperCase(),
          numero_cuenta: numero_cuenta?.trim(),
          numero_routing: numero_routing?.trim(),
          iban: iban?.trim().toUpperCase(),
          direccion_banco: direccion_banco.trim()
        }),
        
        ...(tipo_cuenta === 'zelle' && {
          ...(telefono_zelle && { telefono_zelle: telefono_zelle.trim() }),
          ...(email_zelle && { email_zelle: email_zelle.trim().toLowerCase() })
        }),
        
        ...(tipo_cuenta === 'wise' && {
          email_wise: email_wise.trim().toLowerCase()
        }),
        
        ...(tipo_cuenta === 'otro' && {
          nombre_metodo_otro: nombre_metodo_otro.trim(),
          detalles_metodo_otro: detalles_metodo_otro.trim()
        }),
        
        // Campos de verificación
        verificado: false,
        fecha_verificacion: null,
        verificado_por: null
      };
    }

    // Subir documentos a Cloudinary
    const documentosSubidos = [];
    if (req.files && req.files.length > 0) {
      console.log('📄 Subiendo documentos...');
      
      for (const file of req.files) {
        try {
          const resultado = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                resource_type: 'auto',
                folder: 'fondos/reembolsos',
                public_id: `reembolso_${req.beneficiario._id}_${Date.now()}_${file.originalname.split('.')[0]}`
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(file.buffer);
          });

          // Determinar tipo de documento basado en el orden
          const tipo = documentosSubidos.length === 0 ? 'boleto_aereo' : 'comprobante_pago';

          documentosSubidos.push({
            tipo,
            nombre_archivo: file.originalname,
            url_archivo: resultado.secure_url,
            tamaño_archivo: file.size,
            tipo_mime: file.mimetype
          });

          console.log('📄 Documento subido:', tipo, file.originalname);
          
        } catch (uploadError) {
          console.error('❌ Error subiendo archivo:', uploadError);
          return res.status(500).json({
            success: false,
            mensaje: 'Error al subir documentos',
            error: uploadError.message
          });
        }
      }
    }

    // Manejar la fecha del vuelo
    let fechaVueloProcessed = null;
    if (fecha_vuelo && fecha_vuelo.trim() !== '') {
      try {
        const fechaParts = fecha_vuelo.split('-');
        if (fechaParts.length === 3) {
          const year = parseInt(fechaParts[0]);
          const month = parseInt(fechaParts[1]) - 1;
          const day = parseInt(fechaParts[2]);
          fechaVueloProcessed = new Date(year, month, day);
          console.log('📅 Fecha del vuelo procesada:', fechaVueloProcessed);
        }
      } catch (dateError) {
        console.error('❌ Error procesando fecha del vuelo:', dateError);
      }
    }

    // Crear la solicitud de reembolso
    console.log('💾 Creando solicitud de reembolso...');
    console.log('📋 Información bancaria final:', {
      tipo_cuenta: informacionBancaria.tipo_cuenta,
      titular: `${informacionBancaria.nombre_titular} ${informacionBancaria.apellido_titular}`,
      verificado: informacionBancaria.verificado,
      metodo_guardado: !!informacionBancaria.metodo_guardado_id
    });
    
    const nuevaSolicitud = new SolicitudReembolso({
      beneficiarioId: req.beneficiario._id,
      fondoId: fondo._id,
      tipo_reembolso,
      
      // Información del vuelo/gasto
      informacion_vuelo: {
        costo_boleto: {
          valor: parseFloat(costo_boleto),
          moneda: 'USD'
        },
        fecha_vuelo: fechaVueloProcessed,
        descripcion: descripcion?.trim() || ''
      },
      
      // Monto solicitado
      monto_solicitado: {
        valor: montoSolicitadoNum,
        moneda: 'USD'
      },
      
      // Información bancaria completa
      informacion_bancaria: informacionBancaria,
      
      // Documentos
      documentos: documentosSubidos,
      
      // Auditoría
      creado_por: req.usuario._id,
      
      estado: 'pendiente',
      
      // Prioridad basada en el monto
      prioridad: montoSolicitadoNum > 300 ? 'alta' : 'normal'
    });

    console.log('💾 Guardando solicitud...');
    const solicitudGuardada = await nuevaSolicitud.save();

    // Poblar información para la respuesta
    await solicitudGuardada.populate([
      { path: 'beneficiarioId', select: 'nombre apellido' },
      { path: 'creado_por', select: 'nombre_usuario' }
    ]);

    console.log('✅ Solicitud de reembolso creada exitosamente:', solicitudGuardada.numero_solicitud);

    // Si se marcó para guardar el método Y no es un método guardado, guardarlo
    if (guardar_metodo && usar_metodo_guardado !== 'true' && tipo_cuenta !== 'otro') {
      try {
        console.log('💾 Guardando método de pago para futuro uso...');
        
        const nuevoMetodo = new MetodoPago({
          beneficiarioId: req.beneficiario._id,
          nombre: nombre_metodo?.trim() || `${tipo_cuenta} - ${informacionBancaria.nombre_titular}`,
          tipo_cuenta,
          informacion_bancaria,
          creado_por: req.usuario._id
        });
        
        await nuevoMetodo.save();
        console.log('✅ Método de pago guardado');
      } catch (saveError) {
        console.log('⚠️ Error guardando método, pero solicitud creada:', saveError.message);
      }
    }

    // Preparar respuesta con información completa
    const respuesta = {
      success: true,
      mensaje: 'Solicitud de reembolso creada exitosamente',
      solicitud: {
        _id: solicitudGuardada._id,
        numero_solicitud: solicitudGuardada.numero_solicitud,
        tipo_reembolso: solicitudGuardada.tipo_reembolso,
        monto_solicitado: solicitudGuardada.monto_solicitado,
        estado: solicitudGuardada.estado,
        prioridad: solicitudGuardada.prioridad,
        fecha_solicitud: solicitudGuardada.fecha_solicitud,
        fecha_limite_respuesta: solicitudGuardada.fecha_limite_respuesta,
        
        // Información del método de pago (sin datos sensibles)
        metodo_pago: {
          tipo: solicitudGuardada.informacion_bancaria.tipo_cuenta,
          titular: `${solicitudGuardada.informacion_bancaria.nombre_titular} ${solicitudGuardada.informacion_bancaria.apellido_titular}`,
          pais: solicitudGuardada.informacion_bancaria.pais_titular,
          verificado: solicitudGuardada.informacion_bancaria.verificado,
          metodo_guardado: !!solicitudGuardada.informacion_bancaria.metodo_guardado_id,
          ...(tipo_cuenta === 'otro' && {
            nombre_metodo: solicitudGuardada.informacion_bancaria.nombre_metodo_otro
          })
        },
        
        // Documentos subidos
        documentos_subidos: documentosSubidos.length,
        
        // Beneficiario
        beneficiario: {
          nombre: solicitudGuardada.beneficiarioId.nombre,
          apellido: solicitudGuardada.beneficiarioId.apellido
        }
      }
    };

    res.status(201).json(respuesta);

  } catch (error) {
    console.error('❌ Error al crear solicitud de reembolso:', error);
    console.error('📋 Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor al crear la solicitud',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// @route   POST /api/beneficiario/fondos/metodos-pago
// @desc    Guardar un nuevo método de pago
// @access  Private (Beneficiario)
router.post('/metodos-pago', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('Guardando método de pago para beneficiario:', req.beneficiario._id);
    const { nombre, tipo_cuenta, informacion_bancaria } = req.body;

    // Validaciones básicas
    if (!nombre || !tipo_cuenta || !informacion_bancaria) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: nombre, tipo_cuenta, informacion_bancaria'
      });
    }

    const nuevoMetodo = new MetodoPago({
      beneficiarioId: req.beneficiario._id,
      nombre: nombre.trim(),
      tipo_cuenta,
      informacion_bancaria,
      creado_por: req.usuario._id
    });
    
    const metodoGuardado = await nuevoMetodo.save();

    console.log('Método de pago guardado exitosamente');

    res.status(201).json({
      success: true,
      mensaje: 'Método de pago guardado exitosamente',
      metodo: {
        _id: metodoGuardado._id,
        nombre: metodoGuardado.nombre,
        tipo_cuenta: metodoGuardado.tipo_cuenta
        // No devolver información bancaria sensible
      }
    });

  } catch (error) {
    console.error('Error al guardar método de pago:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// @route   GET /api/beneficiario/fondos/mis-solicitudes
// @desc    Obtener todas las solicitudes de reembolso del beneficiario
// @access  Private (Beneficiario)
router.get('/mis-solicitudes', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    const { estado, limit = 10, page = 1 } = req.query;

    const filtro = { beneficiarioId: req.beneficiario._id };
    if (estado) {
      filtro.estado = estado;
    }

    const solicitudes = await SolicitudReembolso.find(filtro)
      .populate('procesamiento.revisado_por', 'nombre_usuario')
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

// @route   GET /api/beneficiario/fondos/solicitud/:id
// @desc    Obtener detalles de una solicitud específica
// @access  Private (Beneficiario)
router.get('/solicitud/:id', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    const solicitud = await SolicitudReembolso.findOne({
      _id: req.params.id,
      beneficiarioId: req.beneficiario._id
    })
    .populate('procesamiento.revisado_por', 'nombre_usuario');

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
// @route   PUT /api/beneficiario/fondos/metodos-pago/:id
// @desc    Actualizar un método de pago existente
// @access  Private (Beneficiario)
router.put('/metodos-pago/:id', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('Actualizando método de pago:', req.params.id);
    const { nombre, informacion_bancaria } = req.body;

    const metodo = await MetodoPago.findOne({
      _id: req.params.id,
      beneficiarioId: req.beneficiario._id
    });
    
    if (!metodo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Método de pago no encontrado'
      });
    }
    
    if (nombre) metodo.nombre = nombre.trim();
    if (informacion_bancaria) {
      metodo.informacion_bancaria = { ...metodo.informacion_bancaria, ...informacion_bancaria };
    }
    metodo.actualizado_por = req.usuario._id;
    
    const metodoActualizado = await metodo.save();

    res.json({
      success: true,
      mensaje: 'Método de pago actualizado exitosamente',
      metodo: {
        _id: metodoActualizado._id,
        nombre: metodoActualizado.nombre,
        tipo_cuenta: metodoActualizado.tipo_cuenta
      }
    });

  } catch (error) {
    console.error('Error al actualizar método de pago:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});
// @route   DELETE /api/beneficiario/fondos/metodos-pago/:id
// @desc    Eliminar un método de pago
// @access  Private (Beneficiario)
router.delete('/metodos-pago/:id', checkAuth, debugFondosAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('Eliminando método de pago:', req.params.id);

    const metodo = await MetodoPago.findOneAndDelete({
      _id: req.params.id,
      beneficiarioId: req.beneficiario._id
    });
    
    if (!metodo) {
      return res.status(404).json({
        success: false,
        mensaje: 'Método de pago no encontrado'
      });
    }

    console.log('Método de pago eliminado exitosamente');

    res.json({
      success: true,
      mensaje: 'Método de pago eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar método de pago:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});
export default router;