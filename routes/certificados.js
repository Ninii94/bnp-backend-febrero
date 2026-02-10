// para beneficiarios
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { checkAuth, isBeneficiario } from '../middleware/auth.js';
import { Beneficiario } from '../models/Beneficiario.js';

const router = express.Router();

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


//  MedioPago (se agrega al modelo Beneficiario)
const medioPagoSchema = {
  id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  tipo: {
    type: String,
    enum: ['tarjeta_credito', 'tarjeta_debito', 'transferencia_bancaria', 'paypal', 'otro'],
    required: true
  },
  nombre_metodo: {
    type: String,
    required: true
  },
  detalles: {
    numero_tarjeta: String,
    nombre_titular: String,
    banco_emisor: String,
    nombre_banco: String,
    numero_cuenta: String,
    tipo_cuenta: String,
    nombre_titular_cuenta: String,
    email_paypal: String,
    descripcion_otro: String
  },
  es_predeterminado: {
    type: Boolean,
    default: false
  },
  activo: {
    type: Boolean,
    default: true
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  }
};

// colección separada
const boletoCertificadoSchema = new mongoose.Schema({
  beneficiario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  numero_ticket: {
    type: String,
    unique: true,
    required: true
  },
  tipo_reintegro: {
    type: String,
    enum: ['100%', 'parcial'],
    required: true
  },
  monto_solicitado: {
    type: Number,
    required: true,
    min: 0
  },
  monto_original: {
    type: Number,
    required: true
  },
  descripcion: {
    type: String,
    maxlength: 500
  },
  documento_pdf: {
    nombre_archivo: String,
    ruta_archivo: String,
    tamaño_archivo: Number,
    tipo_mime: String,
    fecha_subida: {
      type: Date,
      default: Date.now
    }
  },
  medio_pago_seleccionado: {
    id: String,
    tipo: String,
    nombre: String,
    detalles: String
  },
  estado: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobado', 'devuelto', 'rechazado'],
    default: 'pendiente'
  },
  fecha_solicitud: {
    type: Date,
    default: Date.now
  },
  fecha_revision: Date,
  fecha_procesamiento: Date,
  revisado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  notas_revision: {
    type: String,
    maxlength: 1000
  },
  historial_estados: [{
    estado_anterior: String,
    estado_nuevo: String,
    fecha_cambio: {
      type: Date,
      default: Date.now
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    motivo: String,
    notas: String
  }]
}, {
  timestamps: true
});

// Generar número de ticket automáticamente
boletoCertificadoSchema.pre('save', async function(next) {
  if (!this.numero_ticket) {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    
    const ultimoTicket = await this.constructor.findOne({
      numero_ticket: new RegExp(`^CERT-${año}${mes}${dia}-`)
    }).sort({ numero_ticket: -1 });
    
    let secuencial = 1;
    if (ultimoTicket) {
      const ultimoNumero = ultimoTicket.numero_ticket.split('-')[2];
      secuencial = parseInt(ultimoNumero) + 1;
    }
    
    this.numero_ticket = `CERT-${año}${mes}${dia}-${String(secuencial).padStart(4, '0')}`;
  }
  next();
});

const BoletoCertificado = mongoose.model('BoletoCertificado', boletoCertificadoSchema);

// Añadir campo medios_pago al modelo Beneficiario si no existe
if (!Beneficiario.schema.paths.medios_pago) {
  Beneficiario.schema.add({
    medios_pago: [medioPagoSchema]
  });
}

// ==================== RUTAS DE MEDIOS DE PAGO ====================

// Obtener medios de pago del beneficiario autenticado
router.get('/medios-pago', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const mediosPago = beneficiario.medios_pago?.filter(medio => medio.activo) || [];
    
    res.json(mediosPago);
  } catch (error) {
    console.error('Error obteniendo medios de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo medio de pago
router.post('/medios-pago', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { tipo, nombre_metodo, detalles, es_predeterminado } = req.body;

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

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
      tipo,
      nombre_metodo,
      detalles,
      es_predeterminado: es_predeterminado || false,
      activo: true,
      fecha_creacion: new Date()
    };

    beneficiario.medios_pago.push(nuevoMedio);
    await beneficiario.save();

    // Obtener el medio recién creado con su ID generado
    const medioCreado = beneficiario.medios_pago[beneficiario.medios_pago.length - 1];

    res.status(201).json({
      message: 'Medio de pago creado exitosamente',
      medioPago: medioCreado
    });
  } catch (error) {
    console.error('Error creando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar medio de pago
router.put('/medios-pago/:medioId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { medioId } = req.params;
    const { tipo, nombre_metodo, detalles, es_predeterminado } = req.body;

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const medio = beneficiario.medios_pago?.find(m => m.id === medioId);
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

    res.json({
      message: 'Medio de pago actualizado exitosamente',
      medioPago: medio
    });
  } catch (error) {
    console.error('Error actualizando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar medio de pago
router.delete('/medios-pago/:medioId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { medioId } = req.params;

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const medio = beneficiario.medios_pago?.find(m => m.id === medioId);
    if (!medio) {
      return res.status(404).json({ error: 'Medio de pago no encontrado' });
    }

    medio.activo = false;
    await beneficiario.save();

    res.json({
      message: 'Medio de pago eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando medio de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== RUTAS DE BOLETOS CERTIFICADOS ====================

// Obtener boletos del beneficiario autenticado
router.get('/boletos', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const boletos = await BoletoCertificado.find({ 
      beneficiario_id: beneficiario._id 
    }).populate('revisado_por', 'nombre_usuario').sort({ createdAt: -1 });

    res.json(boletos);
  } catch (error) {
    console.error('Error obteniendo boletos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva solicitud de boleto
router.post('/boletos', checkAuth, isBeneficiario, upload.single('documento_pdf'), async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
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

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
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

    await boleto.save();

    res.status(201).json({
      message: 'Solicitud creada exitosamente',
      boleto
    });

  } catch (error) {
    console.error('Error creando solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener detalles de un boleto específico
router.get('/boletos/:boletoId', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const { boletoId } = req.params;
    const usuarioId = req.usuario._id;

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
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

    res.json(boleto);
  } catch (error) {
    console.error('Error obteniendo boleto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;