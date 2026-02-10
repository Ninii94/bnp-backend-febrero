//para beneficiarios
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { checkAuth, isBeneficiario } from '../middleware/auth.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { BoletoCertificado } from '../models/BoletoCertificado.js'; // Importar el modelo desde su archivo

const router = express.Router();

// Log para verificar que el archivo se carga
console.log('✅ Archivo certificadosBeneficiario.js cargado correctamente');

// ==================== CONFIGURACIÓN MULTER ====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/certificados/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cert-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// ==================== RUTAS DE PRUEBA ====================

// Ruta de prueba para verificar conectividad
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Rutas de certificados-beneficiario funcionando correctamente',
    timestamp: new Date(),
    endpoints: [
      'GET /test - Esta ruta de prueba',
      'GET /medios-pago - Obtener medios de pago',
      'POST /medios-pago - Crear medio de pago',
      'PUT /medios-pago/:id - Actualizar medio de pago',
      'DELETE /medios-pago/:id - Eliminar medio de pago',
      'GET /boletos - Obtener boletos',
      'POST /boletos - Crear boleto'
    ]
  });
});

// ==================== RUTAS DE MEDIOS DE PAGO ====================

// Obtener medios de pago del beneficiario autenticado
router.get('/medios-pago', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('📋 Obteniendo medios de pago para usuario:', req.usuario._id);
    
    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      console.log('❌ Beneficiario no encontrado para usuario:', req.usuario._id);
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Inicializar medios_pago si no existe
    if (!beneficiario.medios_pago) {
      beneficiario.medios_pago = [];
      await beneficiario.save();
    }

    const mediosPago = beneficiario.medios_pago.filter(medio => medio.activo !== false) || [];
    console.log('✅ Medios de pago encontrados:', mediosPago.length);
    
    res.json(mediosPago);
  } catch (error) {
    console.error('❌ Error obteniendo medios de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo medio de pago
router.post('/medios-pago', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('📝 Creando nuevo medio de pago para usuario:', req.usuario._id);
    console.log('📦 Datos recibidos:', req.body);
    
    const { tipo, nombre_metodo, detalles, es_predeterminado } = req.body;

    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Inicializar medios_pago si no existe
    if (!beneficiario.medios_pago) {
      beneficiario.medios_pago = [];
    }

    // Si es predeterminado, desactivar otros como predeterminados
    if (es_predeterminado) {
      beneficiario.medios_pago.forEach(medio => {
        medio.es_predeterminado = false;
      });
    }

    const nuevoMedio = {
      id: new mongoose.Types.ObjectId().toString(),
      tipo,
      nombre_metodo,
      detalles: detalles || {},
      es_predeterminado: es_predeterminado || false,
      activo: true,
      fecha_creacion: new Date()
    };

    beneficiario.medios_pago.push(nuevoMedio);
    await beneficiario.save();

    console.log('✅ Medio de pago creado exitosamente:', nuevoMedio.id);

    res.status(201).json({
      message: 'Medio de pago creado exitosamente',
      medioPago: nuevoMedio
    });
  } catch (error) {
    console.error('❌ Error creando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Actualizar medio de pago
router.put('/medios-pago/:medioId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('🔄 Actualizando medio de pago:', req.params.medioId);
    
    const { medioId } = req.params;
    const { tipo, nombre_metodo, detalles, es_predeterminado } = req.body;

    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    if (!beneficiario.medios_pago) {
      return res.status(404).json({ error: 'No hay medios de pago configurados' });
    }

    const medio = beneficiario.medios_pago.find(m => m.id === medioId);
    if (!medio) {
      return res.status(404).json({ error: 'Medio de pago no encontrado' });
    }

    // Si es predeterminado, desactivar otros como predeterminados
    if (es_predeterminado && !medio.es_predeterminado) {
      beneficiario.medios_pago.forEach(m => {
        if (m.id !== medioId) m.es_predeterminado = false;
      });
    }

    // Actualizar campos
    if (tipo) medio.tipo = tipo;
    if (nombre_metodo) medio.nombre_metodo = nombre_metodo;
    if (detalles) medio.detalles = { ...medio.detalles, ...detalles };
    if (es_predeterminado !== undefined) medio.es_predeterminado = es_predeterminado;

    await beneficiario.save();

    console.log('✅ Medio de pago actualizado exitosamente');

    res.json({
      message: 'Medio de pago actualizado exitosamente',
      medioPago: medio
    });
  } catch (error) {
    console.error('❌ Error actualizando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Eliminar medio de pago (soft delete)
router.delete('/medios-pago/:medioId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('🗑️ Eliminando medio de pago:', req.params.medioId);
    
    const { medioId } = req.params;

    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    if (!beneficiario.medios_pago) {
      return res.status(404).json({ error: 'No hay medios de pago configurados' });
    }

    const medio = beneficiario.medios_pago.find(m => m.id === medioId);
    if (!medio) {
      return res.status(404).json({ error: 'Medio de pago no encontrado' });
    }

    medio.activo = false;
    await beneficiario.save();

    console.log('✅ Medio de pago eliminado exitosamente');

    res.json({
      message: 'Medio de pago eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// ==================== RUTAS DE BOLETOS CERTIFICADOS ====================

// Obtener boletos del beneficiario autenticado
router.get('/boletos', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('📋 Obteniendo boletos para usuario:', req.usuario._id);
    
    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      console.log('❌ Beneficiario no encontrado para usuario:', req.usuario._id);
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const boletos = await BoletoCertificado.find({ 
      beneficiario_id: beneficiario._id 
    }).populate('revisado_por', 'nombre_usuario').sort({ createdAt: -1 });

    console.log('✅ Boletos encontrados:', boletos.length);

    res.json(boletos);
  } catch (error) {
    console.error('❌ Error obteniendo boletos:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Crear nueva solicitud de boleto
router.post('/boletos', checkAuth, isBeneficiario, upload.single('documento_pdf'), async (req, res) => {
  try {
    console.log('📝 Creando nuevo boleto para usuario:', req.usuario._id);
    console.log('📦 Datos recibidos:', req.body);
    console.log('📎 Archivo recibido:', req.file ? req.file.originalname : 'No hay archivo');
    
    const {
      tipo_reintegro,
      monto_solicitado,
      monto_original,
      descripcion,
      medio_pago_seleccionado
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Documento PDF es requerido' });
    }

    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Verificar que el medio de pago existe
    let medioSeleccionado;
    try {
      medioSeleccionado = JSON.parse(medio_pago_seleccionado);
    } catch (e) {
      return res.status(400).json({ error: 'Formato de medio de pago inválido' });
    }

    const medioPago = beneficiario.medios_pago?.find(m => m.id === medioSeleccionado.id);
    
    if (!medioPago) {
      return res.status(400).json({ error: 'Medio de pago no válido' });
    }

    // Calcular monto solicitado si es 100%
    const montoFinal = tipo_reintegro === '100%' ? parseFloat(monto_original) : parseFloat(monto_solicitado);

    // Crear nueva instancia del boleto
    const boleto = new BoletoCertificado({
      beneficiario_id: beneficiario._id,
      tipo_reintegro,
      monto_solicitado: montoFinal,
      monto_original: parseFloat(monto_original),
      descripcion,
      documento_pdf: {
        nombre_archivo: req.file.originalname,
        ruta_archivo: req.file.path,
        tamaño_archivo: req.file.size,
        tipo_mime: req.file.mimetype
      },
      medio_pago_seleccionado: {
        id: medioPago.id,
        tipo: medioPago.tipo,
        nombre: medioPago.nombre_metodo,
        detalles: `${medioPago.tipo} - ${medioPago.nombre_metodo}`
      }
    });

    console.log('💾 Guardando boleto...');
    const boletoGuardado = await boleto.save();
    console.log('✅ Boleto creado exitosamente:', boletoGuardado.numero_ticket);

    res.status(201).json({
      message: 'Solicitud creada exitosamente',
      boleto: boletoGuardado
    });

  } catch (error) {
    console.error('❌ Error creando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Obtener detalles de un boleto específico
router.get('/boletos/:boletoId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    console.log('📄 Obteniendo detalles de boleto:', req.params.boletoId);
    
    const { boletoId } = req.params;

    // Usar el beneficiario del middleware isBeneficiario
    const beneficiario = req.beneficiario;
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const boleto = await BoletoCertificado.findById(boletoId)
      .populate('beneficiario_id', 'nombre correo')
      .populate('revisado_por', 'nombre_usuario');

    if (!boleto) {
      return res.status(404).json({ error: 'Boleto no encontrado' });
    }

    // Verificar que el boleto pertenece al beneficiario
    if (boleto.beneficiario_id._id.toString() !== beneficiario._id.toString()) {
      return res.status(403).json({ error: 'No tienes permisos para ver este boleto' });
    }

    console.log('Detalles de boleto obtenidos exitosamente');

    res.json(boleto);
  } catch (error) {
    console.error('❌ Error obteniendo boleto:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

export default router;