import express from 'express';
import { MensajePago } from '../models/MensajePago.js';
import { Usuario } from '../models/Usuario.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/mensajes-pago
// @desc    Enviar un mensaje de pago (solo equipo BNP)
// @access  Private (EquipoBNP)
router.post('/', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { destinatario, asunto, mensaje } = req.body;

    console.log('Datos recibidos para envío de mensaje:', {
      destinatario,
      asunto,
      mensaje: mensaje?.substring(0, 50) + '...'
    });

    // Validaciones
    if (!destinatario || !mensaje?.trim()) {
      return res.status(400).json({ 
        mensaje: 'Destinatario y mensaje son requeridos' 
      });
    }

    // Verificar que el destinatario existe
    const usuarioDestinatario = await Usuario.findById(destinatario);
    if (!usuarioDestinatario) {
      return res.status(404).json({ 
        mensaje: 'Usuario destinatario no encontrado' 
      });
    }

    // Verificar que el destinatario tiene perfil de beneficiario
    const beneficiarioDestinatario = await Beneficiario.findOne({ 
      usuario_id: destinatario 
    });
    
    if (!beneficiarioDestinatario) {
      return res.status(400).json({ 
        mensaje: 'El usuario seleccionado no es un beneficiario válido' 
      });
    }

    // Crear el mensaje
    const nuevoMensaje = new MensajePago({
      remitente: req.usuario._id,
      destinatario,
      asunto: asunto?.trim() || 'Link de Pago',
      mensaje: mensaje.trim()
    });

    await nuevoMensaje.save();

    // Poblar los datos para la respuesta
    await nuevoMensaje.populate([
      { path: 'remitente', select: 'nombre_usuario correo' },
      { path: 'destinatario', select: 'nombre_usuario correo' }
    ]);

    console.log('Mensaje enviado exitosamente:', nuevoMensaje._id);

    res.status(201).json({
      mensaje: 'Mensaje enviado exitosamente',
      data: nuevoMensaje
    });

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

// @route   GET /api/mensajes-pago/enviados
// @desc    Obtener mensajes enviados por el equipo BNP
// @access  Private (EquipoBNP)
router.get('/enviados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('Obteniendo mensajes enviados por usuario:', req.usuario._id);

    const mensajes = await MensajePago.find({ remitente: req.usuario._id })
      .populate('destinatario', 'nombre_usuario correo')
      .populate('remitente', 'nombre_usuario correo')
      .sort({ fecha_envio: -1 });

    console.log(`Encontrados ${mensajes.length} mensajes enviados`);

    res.json(mensajes);

  } catch (error) {
    console.error('Error al obtener mensajes enviados:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

// @route   GET /api/mensajes-pago/recibidos
// @desc    Obtener mensajes recibidos por el beneficiario
// @access  Private (Beneficiario)
router.get('/recibidos', checkAuth, async (req, res) => {
  try {
    console.log('Obteniendo mensajes recibidos para usuario:', req.usuario._id);

    // Verificar que el usuario es beneficiario
    const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
    if (!beneficiario) {
      return res.status(403).json({ 
        mensaje: 'Solo los beneficiarios pueden acceder a esta función' 
      });
    }

    const mensajes = await MensajePago.find({ destinatario: req.usuario._id })
      .populate('remitente', 'nombre_usuario correo')
      .populate('destinatario', 'nombre_usuario correo')
      .sort({ fecha_envio: -1 });

    console.log(`Encontrados ${mensajes.length} mensajes recibidos`);

    res.json(mensajes);

  } catch (error) {
    console.error('Error al obtener mensajes recibidos:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

// @route   GET /api/mensajes-pago/contador
// @desc    Obtener contador de mensajes no leídos
// @access  Private (Beneficiario)
router.get('/contador', checkAuth, async (req, res) => {
  try {
    // Verificar que el usuario es beneficiario
    const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
    if (!beneficiario) {
      return res.json({ noLeidos: 0 });
    }

    const noLeidos = await MensajePago.countDocuments({
      destinatario: req.usuario._id,
      leido: false
    });

    res.json({ noLeidos });

  } catch (error) {
    console.error('Error al obtener contador:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

// @route   PUT /api/mensajes-pago/:id/leer
// @desc    Marcar mensaje como leído
// @access  Private (Beneficiario)
router.put('/:id/leer', checkAuth, async (req, res) => {
  try {
    const mensaje = await MensajePago.findOne({
      _id: req.params.id,
      destinatario: req.usuario._id
    });

    if (!mensaje) {
      return res.status(404).json({ 
        mensaje: 'Mensaje no encontrado' 
      });
    }

    if (!mensaje.leido) {
      mensaje.leido = true;
      mensaje.fecha_lectura = new Date();
      await mensaje.save();
    }

    res.json({ 
      mensaje: 'Mensaje marcado como leído',
      data: mensaje 
    });

  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

// @route   DELETE /api/mensajes-pago/:id
// @desc    Eliminar mensaje (solo el remitente puede eliminar)
// @access  Private (EquipoBNP)
router.delete('/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const mensaje = await MensajePago.findOne({
      _id: req.params.id,
      remitente: req.usuario._id
    });

    if (!mensaje) {
      return res.status(404).json({ 
        mensaje: 'Mensaje no encontrado o no tienes permisos para eliminarlo' 
      });
    }

    await MensajePago.findByIdAndDelete(req.params.id);

    res.json({ mensaje: 'Mensaje eliminado exitosamente' });

  } catch (error) {
    console.error('Error al eliminar mensaje:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor', 
      error: error.message 
    });
  }
});

export default router;