// routes/membershipRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

// Configuración de multer para archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/contratos';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `contrato-${req.params.userId || req.body.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, DOC, DOCX'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB límite
});

// Configuración para documentos de identificación
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/documentos';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const tipo = req.body.tipo || 'documento';
    cb(null, `${tipo}-${req.params.userId || req.body.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadDocument = multer({ 
  storage: documentStorage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos JPG, PNG, PDF'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB límite
});

// Subir contrato de membresía
router.post('/upload-contrato/:userId', checkAuth, upload.single('contrato'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const { userId } = req.params;
    const archivo_url = `/uploads/contratos/${req.file.filename}`;

    // Actualizar el beneficiario con la URL del contrato
    const beneficiario = await Beneficiario.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'membresia.contrato_archivo': archivo_url 
        }
      },
      { new: true, upsert: true }
    );

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    res.json({ 
      mensaje: 'Contrato subido exitosamente',
      archivo_url: archivo_url
    });
  } catch (error) {
    console.error('Error al subir contrato:', error);
    res.status(500).json({ error: 'Error al subir contrato' });
  }
});

// Subir documentos de identificación
router.post('/upload-documento/:userId', checkAuth, uploadDocument.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const { userId } = req.params;
    const { tipo } = req.body;
    const archivo_url = `/uploads/documentos/${req.file.filename}`;

    // Preparar el objeto documento con la estructura del modelo
    const documentoData = {
      nombre: req.file.originalname,
      ruta: archivo_url,
      tipo: req.file.mimetype,
      fecha_subida: new Date()
    };

    // Determinar el campo a actualizar
    let updateField = {};
    if (tipo === 'foto_identificacion_beneficiario') {
      updateField.foto_identificacion_beneficiario = documentoData;
    } else if (tipo === 'foto_identificacion_pareja') {
      updateField.foto_identificacion_pareja = documentoData;
    } else {
      return res.status(400).json({ error: 'Tipo de documento no válido' });
    }

    const beneficiario = await Beneficiario.findByIdAndUpdate(
      userId,
      { $set: updateField },
      { new: true }
    );

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    res.json({ 
      mensaje: 'Documento subido exitosamente',
      archivo_url: archivo_url,
      documento: documentoData
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

// Actualizar información de membresía
router.put('/membresia/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const membershipData = req.body.membresia;

    // Validar que se proporcionen datos de membresía
    if (!membershipData) {
      return res.status(400).json({ error: 'Datos de membresía requeridos' });
    }

    const beneficiario = await Beneficiario.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          membresia: membershipData,
          idioma_preferencia: req.body.idioma_preferencia || 'español'
        }
      },
      { new: true, upsert: true }
    );

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    res.json({ 
      mensaje: 'Información de membresía actualizada exitosamente',
      membresia: beneficiario.membresia
    });
  } catch (error) {
    console.error('Error al actualizar membresía:', error);
    res.status(500).json({ error: 'Error al actualizar membresía' });
  }
});

// Obtener información completa de membresía
router.get('/membresia/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const beneficiario = await Beneficiario.findById(userId)
      .populate('aliado_id', 'nombre')
      .populate('sucursal', 'nombre')
      .select('membresia idioma_preferencia foto_identificacion_beneficiario foto_identificacion_pareja');

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    res.json({
      membresia: beneficiario.membresia || {},
      idioma_preferencia: beneficiario.idioma_preferencia || 'español',
      foto_identificacion_beneficiario: beneficiario.foto_identificacion_beneficiario,
      foto_identificacion_pareja: beneficiario.foto_identificacion_pareja
    });
  } catch (error) {
    console.error('Error al obtener membresía:', error);
    res.status(500).json({ error: 'Error al obtener información de membresía' });
  }
});

export default router;