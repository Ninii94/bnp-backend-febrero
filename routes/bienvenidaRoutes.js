import express from 'express';
import nodemailer from 'nodemailer';
import { Usuario } from '../models/Usuario.js';
import { SolicitudEnlace } from '../models/SolicitudEnlace.js';
import { SolicitudAyuda } from '../models/SolicitudAyuda.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Servicio } from '../models/Servicio.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.get('/verificar-bienvenida/:usuarioId', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Usuario no encontrado' 
      });
    }

    if (usuario.tipo !== 'beneficiario') {
      return res.json({ 
        success: true, 
        requiereBienvenida: false,
        mensaje: 'Usuario no es beneficiario'
      });
    }

    res.json({
      success: true,
      requiereBienvenida: !usuario.bienvenida_completada,
      bienvenidaCompletada: usuario.bienvenida_completada,
      opcionSeleccionada: usuario.opciones_bienvenida?.opcion_seleccionada
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al verificar bienvenida',
      error: error.message 
    });
  }
});

router.post('/completar-opcion', async (req, res) => {
  try {
    const { usuarioId, opcion } = req.body;

    if (!usuarioId || !opcion) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Faltan datos requeridos' 
      });
    }

    const usuario = await Usuario.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Usuario no encontrado' 
      });
    }

    usuario.opciones_bienvenida = {
      opcion_seleccionada: opcion,
      fecha_completada: new Date()
    };

    if (opcion === 'estoy_bien' || opcion === 'activar_beneficios') {
      usuario.bienvenida_completada = true;
    }

    await usuario.save();

    res.json({
      success: true,
      mensaje: 'Opción registrada correctamente',
      bienvenidaCompletada: usuario.bienvenida_completada,
      opcionSeleccionada: opcion
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al registrar opción',
      error: error.message 
    });
  }
});

// Nueva ruta: Solicitar ayuda directa (registra en BD)
router.post('/solicitar-ayuda-directa', async (req, res) => {
  try {
    const { usuarioId, mensaje, contactoPreferido, valorContacto } = req.body;

    console.log('📩 Nueva solicitud de ayuda directa recibida:', {
      usuarioId,
      contactoPreferido
    });

    if (!usuarioId || !mensaje || !contactoPreferido || !valorContacto) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Faltan datos requeridos' 
      });
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Usuario no encontrado' 
      });
    }

    const solicitud = new SolicitudAyuda({
      usuario_id: usuarioId,
      mensaje_ayuda: mensaje,
      contacto_preferido: contactoPreferido,
      valor_contacto: valorContacto,
      estado_gestion: 'pendiente'
    });

    await solicitud.save();
    console.log('✅ Solicitud de ayuda guardada con ID:', solicitud._id);

    res.json({
      success: true,
      mensaje: 'Solicitud de ayuda registrada correctamente',
      solicitudId: solicitud._id
    });

  } catch (error) {
    console.error('❌ Error al crear solicitud de ayuda:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al crear solicitud',
      error: error.message
    });
  }
});

// Nueva ruta: Enviar email directo (sin registrar en BD)
router.post('/enviar-email-consulta', async (req, res) => {
  try {
    const { usuarioId, asunto, mensaje, email } = req.body;

    console.log('📧 Nueva solicitud de email directo recibida');

    if (!usuarioId || !asunto || !mensaje || !email) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Faltan datos requeridos' 
      });
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Usuario no encontrado' 
      });
    }

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });

    // Enviar email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_SOPORTE || 'soporte@bnpcapital.com',
      subject: `[Consulta FAQ] ${asunto}`,
      html: `
        <h2>Nueva consulta desde FAQ</h2>
        <p><strong>Usuario:</strong> ${usuario.nombre_usuario}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${beneficiario ? `<p><strong>Beneficiario:</strong> ${beneficiario.nombre} ${beneficiario.apellido}</p>` : ''}
        <p><strong>Asunto:</strong> ${asunto}</p>
        <hr>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>Enviado desde la plataforma Beneficios BNP</em></p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado correctamente');

    res.json({
      success: true,
      mensaje: 'Email enviado correctamente'
    });

  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al enviar email',
      error: error.message
    });
  }
});

router.post('/solicitar-enlaces', async (req, res) => {
  try {
    const { usuarioId, servicios, notas } = req.body;

    console.log('📩 Nueva solicitud de enlaces recibida:', {
      usuarioId,
      servicios: servicios?.length || 0,
      notasLength: notas?.length || 0
    });

    if (!usuarioId) {
      console.log('❌ Error: Usuario ID no proporcionado');
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Usuario ID requerido' 
      });
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      console.log('❌ Error: Usuario no encontrado:', usuarioId);
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Usuario no encontrado' 
      });
    }

    console.log('✅ Usuario encontrado:', usuario.nombre_usuario);

    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      console.log('❌ Error: Beneficiario no encontrado para usuario:', usuarioId);
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Beneficiario no encontrado' 
      });
    }

    console.log('✅ Beneficiario encontrado:', beneficiario._id);

    const serviciosSolicitados = [];
    
    if (servicios && servicios.length > 0) {
      console.log('🔍 Procesando servicios:', servicios);
      
      for (const servicioData of servicios) {
        try {
          if (typeof servicioData === 'object' && servicioData.servicio_id) {
            console.log('  ✓ Servicio (objeto):', servicioData.nombre_servicio);
            serviciosSolicitados.push({
              servicio_id: servicioData.servicio_id,
              nombre_servicio: servicioData.nombre_servicio,
              descripcion: servicioData.descripcion || ''
            });
          } else {
            const servicioId = typeof servicioData === 'object' ? servicioData.servicio_id : servicioData;
            console.log('  🔍 Buscando servicio por ID:', servicioId);
            
            const servicio = await Servicio.findById(servicioId);
            if (servicio) {
              console.log('  ✓ Servicio encontrado:', servicio.nombre);
              serviciosSolicitados.push({
                servicio_id: servicio._id,
                nombre_servicio: servicio.nombre,
                descripcion: servicio.descripcion || ''
              });
            } else {
              console.log('  ⚠️ Servicio no encontrado:', servicioId);
            }
          }
        } catch (servicioError) {
          console.error('  ❌ Error procesando servicio:', servicioError.message);
        }
      }
    }

    console.log('📋 Servicios procesados:', serviciosSolicitados.length);

    if (serviciosSolicitados.length === 0) {
      console.log('⚠️ Advertencia: No se procesaron servicios válidos');
    }

    const solicitud = new SolicitudEnlace({
      beneficiario_id: beneficiario._id,
      usuario_id: usuarioId,
      servicios_solicitados: serviciosSolicitados,
      notas_usuario: notas || '',
      estado: 'pendiente'
    });

    await solicitud.save();
    console.log('✅ Solicitud guardada con ID:', solicitud._id);

    usuario.bienvenida_completada = true;
    usuario.opciones_bienvenida = {
      opcion_seleccionada: 'activar_beneficios',
      fecha_completada: new Date()
    };
    await usuario.save();
    console.log('✅ Usuario actualizado - bienvenida completada');

    res.json({
      success: true,
      mensaje: 'Solicitud de enlaces enviada correctamente',
      solicitudId: solicitud._id,
      servicios_procesados: serviciosSolicitados.length
    });

  } catch (error) {
    console.error('❌ Error al crear solicitud de enlaces:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al crear solicitud',
      error: error.message,
      detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener solicitudes de ayuda para el equipo BNP
router.get('/solicitudes-ayuda', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const solicitudes = await SolicitudAyuda.find({ estado_gestion: { $ne: 'eliminado' } })
      .populate('usuario_id', 'nombre_usuario correo telefono idioma_preferencia')
      .populate('gestionado_por', 'nombre_usuario')
      .sort({ fecha_solicitud: -1 });

    // Enriquecer con datos del beneficiario si existe
    const solicitudesEnriquecidas = await Promise.all(
      solicitudes.map(async (solicitud) => {
        const solicitudObj = solicitud.toObject();
        
        // Buscar beneficiario asociado
        if (solicitudObj.usuario_id?._id) {
          const beneficiario = await Beneficiario.findOne({ 
            usuario_id: solicitudObj.usuario_id._id 
          }).select('telefono idioma_preferencia');
          
          if (beneficiario) {
            // Completar con datos del beneficiario si el usuario no los tiene
            solicitudObj.usuario_id.telefono = solicitudObj.usuario_id.telefono || beneficiario.telefono;
            solicitudObj.usuario_id.idioma_preferencia = solicitudObj.usuario_id.idioma_preferencia || beneficiario.idioma_preferencia;
          }
        }
        
        return solicitudObj;
      })
    );

    res.json({
      success: true,
      solicitudes: solicitudesEnriquecidas
    });
  } catch (error) {
    console.error('Error al obtener solicitudes de ayuda:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener solicitudes',
      error: error.message 
    });
  }
});

// Actualizar estado de solicitud de ayuda
router.patch('/actualizar-ayuda/:solicitudId', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estado, gestionadoPor } = req.body;

    const solicitud = await SolicitudAyuda.findById(req.params.solicitudId);
    
    if (!solicitud) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Solicitud no encontrada' 
      });
    }

    if (estado) {
      solicitud.estado_gestion = estado;
      solicitud.fecha_ultima_gestion = new Date();
    }
    
    if (gestionadoPor) {
      solicitud.gestionado_por = gestionadoPor;
    }

    await solicitud.save();

    const solicitudPopulada = await SolicitudAyuda.findById(solicitud._id)
      .populate('usuario_id', 'nombre_usuario correo telefono idioma_preferencia')
      .populate('gestionado_por', 'nombre_usuario');

    // Enriquecer con datos del beneficiario
    const solicitudObj = solicitudPopulada.toObject();
    if (solicitudObj.usuario_id?._id) {
      const beneficiario = await Beneficiario.findOne({ 
        usuario_id: solicitudObj.usuario_id._id 
      }).select('telefono idioma_preferencia');
      
      if (beneficiario) {
        solicitudObj.usuario_id.telefono = solicitudObj.usuario_id.telefono || beneficiario.telefono;
        solicitudObj.usuario_id.idioma_preferencia = solicitudObj.usuario_id.idioma_preferencia || beneficiario.idioma_preferencia;
      }
    }

    res.json({
      success: true,
      mensaje: 'Solicitud actualizada correctamente',
      solicitud: solicitudObj
    });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al actualizar solicitud',
      error: error.message 
    });
  }
});

// Marcar solicitud como eliminada (soft delete)
router.delete('/eliminar-ayuda/:solicitudId', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const solicitud = await SolicitudAyuda.findById(req.params.solicitudId);
    
    if (!solicitud) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Solicitud no encontrada' 
      });
    }

    solicitud.estado_gestion = 'eliminado';
    solicitud.fecha_ultima_gestion = new Date();
    await solicitud.save();

    res.json({
      success: true,
      mensaje: 'Solicitud eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al eliminar solicitud',
      error: error.message 
    });
  }
});

// Obtener estadísticas del módulo de bienvenida
router.get('/estadisticas', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    // Nuevos usuarios (últimos 30 días)
    const fechaHace30Dias = new Date();
    fechaHace30Dias.setDate(fechaHace30Dias.getDate() - 30);
    
    const nuevosUsuarios = await Usuario.countDocuments({
      tipo: 'beneficiario',
      createdAt: { $gte: fechaHace30Dias }
    });

    // Solicitudes de enlaces pendientes
    const solicitudesEnlacesPendientes = await SolicitudEnlace.countDocuments({
      estado: 'pendiente'
    });

    // Total de solicitudes de enlaces
    const totalSolicitudesEnlaces = await SolicitudEnlace.countDocuments();

    // Solicitudes de ayuda por estado
    const solicitudesAyudaPendientes = await SolicitudAyuda.countDocuments({
      estado_gestion: 'pendiente'
    });

    const solicitudesAyudaContactado = await SolicitudAyuda.countDocuments({
      estado_gestion: 'contactado'
    });

    const solicitudesAyudaSeguimiento = await SolicitudAyuda.countDocuments({
      estado_gestion: 'seguir_contactando'
    });

    const totalSolicitudesAyuda = await SolicitudAyuda.countDocuments({
      estado_gestion: { $ne: 'eliminado' }
    });

    // Usuarios con bienvenida completada
    const bienvenidaCompletada = await Usuario.countDocuments({
      tipo: 'beneficiario',
      bienvenida_completada: true
    });

    // Usuarios con bienvenida pendiente
    const bienvenidaPendiente = await Usuario.countDocuments({
      tipo: 'beneficiario',
      bienvenida_completada: false
    });

    res.json({
      success: true,
      estadisticas: {
        nuevosUsuarios,
        solicitudesEnlacesPendientes,
        totalSolicitudesEnlaces,
        solicitudesAyudaPendientes,
        solicitudesAyudaContactado,
        solicitudesAyudaSeguimiento,
        totalSolicitudesAyuda,
        bienvenidaCompletada,
        bienvenidaPendiente
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
});

router.get('/solicitudes-pendientes', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const solicitudes = await SolicitudEnlace.find()
      .populate('beneficiario_id', 'nombre apellido correo telefono')
      .populate('usuario_id', 'nombre_usuario correo')
      .sort({ fecha_solicitud: -1 });

    res.json({
      success: true,
      solicitudes
    });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener solicitudes',
      error: error.message 
    });
  }
});

router.get('/mis-solicitudes/:usuarioId', async (req, res) => {
  try {
    const solicitudes = await SolicitudEnlace.find({ 
      usuario_id: req.params.usuarioId 
    })
      .populate('servicios_solicitados.servicio_id')
      .sort({ fecha_solicitud: -1 });

    res.json({
      success: true,
      solicitudes
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener solicitudes',
      error: error.message 
    });
  }
});

router.patch('/actualizar-solicitud/:solicitudId', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estado, linkPago, mensajeEnviado, procesadoPor } = req.body;

    const solicitud = await SolicitudEnlace.findById(req.params.solicitudId);
    
    if (!solicitud) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'Solicitud no encontrada' 
      });
    }

    if (estado) solicitud.estado = estado;
    if (linkPago) solicitud.link_pago = linkPago;
    if (mensajeEnviado) solicitud.mensaje_enviado = mensajeEnviado;
    if (procesadoPor) solicitud.procesado_por = procesadoPor;
    
    if (estado === 'enviado') {
      solicitud.fecha_envio = new Date();
    }

    if (estado === 'rechazado' || estado === 'cancelado') {
      solicitud.fecha_procesamiento = new Date();
    }

    await solicitud.save();

    const solicitudPopulada = await SolicitudEnlace.findById(solicitud._id)
      .populate('beneficiario_id', 'nombre apellido correo telefono')
      .populate('usuario_id', 'nombre_usuario correo');

    res.json({
      success: true,
      mensaje: 'Solicitud actualizada correctamente',
      solicitud: solicitudPopulada
    });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al actualizar solicitud',
      error: error.message 
    });
  }
});

export default router;