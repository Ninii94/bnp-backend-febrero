import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/Usuario.js';

const router = express.Router();

// Importar Resend de forma segura
let resend = null;
let resendError = null;

try {
  const { Resend } = await import('resend');
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend v1.1.0 configurado correctamente');
  } else {
    console.log('⚠️ RESEND_API_KEY no encontrada en variables de entorno');
  }
} catch (error) {
  console.log('⚠️ Error importando Resend:', error.message);
  resendError = error.message;
}

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth router working with Resend v1.1.0!',
    timestamp: new Date().toISOString(),
    emailService: 'Resend v1.1.0',
    resendConfigured: !!resend,
    resendError: resendError,
    environment: {
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
      hasJwtSecret: !!process.env.JWT_SECRET
    },
    availableRoutes: [
      'POST /login',
      'POST /registro', 
      'POST /request-reset',
      'POST /reset-password'
    ]
  });
});
// GET - Verificar estado de bienvenida de un usuario
// GET - Verificar estado de bienvenida de un usuario
router.get('/verificar-bienvenida/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    console.log('🔍 Verificando bienvenida para:', usuarioId);
    
    const usuario = await Usuario.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // ⭐ CALCULAR debe_mostrar_bienvenida
    const debeMostrar = usuario.deberMostrarBienvenida();
    
    console.log('📊 Usuario encontrado:', {
      correo: usuario.correo,
      tipo: usuario.tipo,
      inicios_sesion: usuario.inicios_sesion,
      bienvenida_completada: usuario.bienvenida_completada,
      debe_mostrar_bienvenida: debeMostrar
    });
    
    res.json({
      success: true,
      usuario: {
        _id: usuario._id,
        correo: usuario.correo,
        tipo: usuario.tipo,
        inicios_sesion: usuario.inicios_sesion,
        primer_inicio_sesion: usuario.primer_inicio_sesion,
        bienvenida_completada: usuario.bienvenida_completada,
        opciones_bienvenida: usuario.opciones_bienvenida,
        debe_mostrar_bienvenida: debeMostrar  
      }
    });
  } catch (error) {
    console.error('❌ Error verificando bienvenida:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.get('/debug-users', async (req, res) => {
  try {
    console.log('🔍 DEBUG - Buscando usuarios en la base de datos...');
    
    // Buscar todos los usuarios (limitado a 10 para seguridad)
    const usuarios = await Usuario.find({})
      .select('nombre_usuario correo tipo activo')
      .limit(10);
    
    console.log(`📊 Total de usuarios encontrados: ${usuarios.length}`);
    
    // Buscar específicamente beneficiarios
    const beneficiarios = await Usuario.find({ tipo: 'beneficiario' })
      .select('nombre_usuario correo tipo activo')
      .limit(10);
    
    console.log(`👥 Beneficiarios encontrados: ${beneficiarios.length}`);
    
    // Buscar por los correos específicos que estás probando
    const testEmails = ['nicki.pastrana@gmail.com'];
    const usuariosTest = await Usuario.find({
      correo: { $in: testEmails }
    }).select('nombre_usuario correo tipo activo');
    
    console.log(`🎯 Usuarios con emails de prueba: ${usuariosTest.length}`);
    
    res.json({
      success: true,
      totalUsuarios: usuarios.length,
      beneficiarios: beneficiarios.length,
      usuariosTest: usuariosTest.length,
      samples: {
        todosLosUsuarios: usuarios.map(u => ({
          nombre_usuario: u.nombre_usuario,
          correo: u.correo,
          tipo: u.tipo,
          activo: u.activo
        })),
        beneficiarios: beneficiarios.map(u => ({
          nombre_usuario: u.nombre_usuario,
          correo: u.correo,
          tipo: u.tipo,
          activo: u.activo
        })),
        usuariosTest: usuariosTest.map(u => ({
          nombre_usuario: u.nombre_usuario,
          correo: u.correo,
          tipo: u.tipo,
          activo: u.activo
        }))
      },
      testEmails: testEmails
    });
  } catch (error) {
    console.error('❌ Error en debug-users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta de registro
router.post('/registro', async (req, res) => {
  try {
    const { nombre_usuario, contrasena, correo, tipo } = req.body;

    const usuarioExistente = await Usuario.findOne({ 
      $or: [
        { nombre_usuario },
        { correo }
      ]
    });

    if (usuarioExistente) {
      return res.status(400).json({ 
        message: 'El usuario o correo ya existe' 
      });
    }

    const usuario = new Usuario({
      nombre_usuario,
      contrasena,
      correo,
      tipo,
      activo: true
    });

    await usuario.save();

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: {
        id: usuario._id,
        nombre_usuario: usuario.nombre_usuario,
        tipo: usuario.tipo
      }
    });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta de login
router.post('/login', async (req, res) => {
  try {
    console.log('🔍 LOGIN - Body recibido:', req.body);
    
    const { nombre_usuario, contrasena, tipo } = req.body;
    
    if (!nombre_usuario || !contrasena || !tipo) {
      return res.status(400).json({ 
        message: 'Faltan campos requeridos'
      });
    }
    
    const usuario = await Usuario.findOne({ 
      nombre_usuario, 
      tipo
    });
    
    if (!usuario) {
      return res.status(400).json({ message: 'Usuario no encontrado' });
    }
    
    const passwordMatch = await usuario.comparePassword(contrasena);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // ✅ PASO 1: REGISTRAR INICIO DE SESIÓN
    console.log('📊 ANTES - inicios_sesion:', usuario.inicios_sesion);
    await usuario.registrarInicioSesion();
    console.log('📊 DESPUÉS - inicios_sesion:', usuario.inicios_sesion);

    // ✅ PASO 2: VERIFICAR SI DEBE MOSTRAR BIENVENIDA
    const mostrarBienvenida = usuario.deberMostrarBienvenida();
    console.log('🎯 mostrarBienvenida:', mostrarBienvenida);
    console.log('   - tipo:', usuario.tipo);
    console.log('   - inicios_sesion:', usuario.inicios_sesion);
    console.log('   - bienvenida_completada:', usuario.bienvenida_completada);
    
    const token = jwt.sign(
      { id: usuario._id, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // ✅ PASO 3: RESPUESTA CON TODOS LOS CAMPOS
    const respuesta = {
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombre_usuario: usuario.nombre_usuario,
        email: usuario.email,
        correo: usuario.correo,
        tipo: usuario.tipo,
        inicios_sesion: usuario.inicios_sesion,
        mostrarBienvenida: mostrarBienvenida,  // ⭐⭐⭐ CLAVE
        bienvenida_completada: usuario.bienvenida_completada
      }
    };
    
    console.log('📤 RESPUESTA ENVIADA:', JSON.stringify(respuesta, null, 2));
    
    return res.status(200).json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});


// Función para enviar emails con Resend
async function enviarEmailRecuperacion(usuario, resetUrl) {
  // Si no hay Resend configurado, simular envío
  if (!resend) {
    console.log('📧 Simulando envío de email (Resend no configurado)');
    console.log(`   Destinatario: ${usuario.correo}`);
    console.log(`   URL: ${resetUrl}`);
    console.log(`   Motivo: ${resendError || 'API Key no configurada'}`);
    return { 
      success: true, 
      mode: 'simulation',
      reason: resendError || 'API Key no configurada'
    };
  }

  try {
    console.log('📧 Enviando email con Resend v1.1.0...');
    
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'BNP Capital <onboarding@resend.dev>',
      to: [usuario.correo],
      subject: 'Recuperación de contraseña - BNP Capital',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperación de contraseña</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">BNP Capital</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400;">Recuperación de contraseña</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 36px;">🔐</span>
                </div>
              </div>
              
              <h2 style="color: #065f46; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; text-align: center;">¡Hola ${usuario.nombre || usuario.nombre_usuario}!</h2>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px; font-size: 16px; text-align: center;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
              </p>
              
              <p style="color: #6b7280; line-height: 1.6; margin-bottom: 32px; font-size: 14px; text-align: center;">
                Si no solicitaste este cambio, simplemente ignora este correo.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(6, 95, 70, 0.3);">
                  Restablecer Contraseña
                </a>
              </div>
              
              <!-- Alternative link -->
              <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 32px 0; border-left: 4px solid #065f46;">
                <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">
                  ¿El botón no funciona?
                </p>
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">
                  Copia y pega este enlace en tu navegador:
                </p>
                <p style="color: #065f46; word-break: break-all; margin: 0; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; background-color: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
                  ${resetUrl}
                </p>
              </div>
              
              <!-- Security notice -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin: 32px 0; border-left: 4px solid #f59e0b;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-size: 20px; margin-right: 12px;">⚠️</span>
                  <div>
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                      Importante para tu seguridad
                    </p>
                    <p style="color: #92400e; font-size: 13px; margin: 4px 0 0 0;">
                      Este enlace expira en 1 hora. Si no lo usas a tiempo, deberás solicitar otro.
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Footer message -->
              <div style="text-align: center; margin-top: 40px; padding-top: 32px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; line-height: 1.5; margin-bottom: 8px; font-size: 14px;">
                  Saludos cordiales,
                </p>
                <p style="color: #065f46; font-weight: 600; margin: 0; font-size: 16px;">
                  Equipo BNP Capital
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.4;">
                Este es un correo automático de seguridad. Por favor, no respondas a este mensaje.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0;">
                BNP Capital - Sistema de Gestión Segura
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${usuario.nombre || usuario.nombre_usuario},
        
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en BNP Capital.
        
        Para restablecer tu contraseña, visita el siguiente enlace (válido por 1 hora):
        ${resetUrl}
        
        Si no has solicitado este cambio, puedes ignorar este correo.
        
        Saludos,
        Equipo BNP Capital
      `
    };
    
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error('❌ Error de Resend:', error);
      throw new Error(`Error de Resend: ${JSON.stringify(error)}`);
    }
    
    console.log('✅ Email enviado exitosamente:', data?.id);
    return { 
      success: true, 
      messageId: data?.id, 
      mode: 'resend',
      service: 'Resend v1.1.0'
    };
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

// Rutas de recuperación de contraseña
router.post('/request-reset', async (req, res) => {
  console.log('🔄 Request reset route called with body:', req.body);
  try {
    const { correo, tipo } = req.body;
    
    if (!correo || !tipo) {
      return res.status(400).json({ 
        message: 'Correo electrónico y tipo son requeridos' 
      });
    }
    
    const usuario = await Usuario.findOne({ correo, tipo });
    console.log('👤 User found:', usuario ? 'Yes' : 'No');
    
    if (!usuario) {
      // Por seguridad, siempre devolver éxito
      return res.status(200).json({ 
        message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
      });
    }
    
    if (!usuario.activo) {
      return res.status(401).json({ message: 'Usuario no activo' });
    }
    
    const resetToken = jwt.sign(
      { id: usuario._id, tipo: usuario.tipo, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    usuario.reset_token = resetToken;
    usuario.reset_token_expiry = Date.now() + 3600000;
    await usuario.save();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    console.log('🔗 Reset URL generada:', resetUrl);
    
    try {
      const emailResult = await enviarEmailRecuperacion(usuario, resetUrl);
      console.log('📧 Resultado del email:', emailResult);
    } catch (emailError) {
      console.error('❌ Error enviando email, pero continuando:', emailError.message);
      // No fallar aunque el email no se envíe
    }
    
    return res.status(200).json({ 
      message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
    });
  } catch (error) {
    console.error('❌ Error en request-reset:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta duplicada para compatibilidad
router.post('/request-password-reset', async (req, res) => {
  console.log('🔄 Request password reset route called with body:', req.body);
  try {
    const { correo, tipo } = req.body;
    
    if (!correo || !tipo) {
      return res.status(400).json({ 
        message: 'Correo electrónico y tipo son requeridos' 
      });
    }
    
    const usuario = await Usuario.findOne({ correo, tipo });
    
    if (!usuario) {
      return res.status(200).json({ 
        message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
      });
    }
    
    if (!usuario.activo) {
      return res.status(401).json({ message: 'Usuario no activo' });
    }
    
    const resetToken = jwt.sign(
      { id: usuario._id, tipo: usuario.tipo, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    usuario.reset_token = resetToken;
    usuario.reset_token_expiry = Date.now() + 3600000;
    await usuario.save();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    try {
      await enviarEmailRecuperacion(usuario, resetUrl);
    } catch (emailError) {
      console.error('Error enviando email:', emailError.message);
    }
    
    return res.status(200).json({ 
      message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
    });
  } catch (error) {
    console.error('Error en request-password-reset:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});
router.post('/debug-find-user', async (req, res) => {
  try {
    const { correo, tipo } = req.body;
    
    console.log(`🔍 Buscando usuario: ${correo} - tipo: ${tipo}`);
    
    // Búsqueda exacta
    const usuarioExacto = await Usuario.findOne({ correo, tipo });
    
    // Búsqueda solo por correo
    const usuarioPorCorreo = await Usuario.findOne({ correo });
    
    // Búsqueda case-insensitive
    const usuarioInsensitive = await Usuario.findOne({
      correo: { $regex: new RegExp(`^${correo}$`, 'i') }
    });
    
    // Todos los usuarios con correos similares
    const usuariosSimilares = await Usuario.find({
      correo: { $regex: correo, $options: 'i' }
    }).select('nombre_usuario correo tipo activo');
    
    res.json({
      searched: { correo, tipo },
      results: {
        exactMatch: usuarioExacto ? {
          nombre_usuario: usuarioExacto.nombre_usuario,
          correo: usuarioExacto.correo,
          tipo: usuarioExacto.tipo,
          activo: usuarioExacto.activo
        } : null,
        byEmailOnly: usuarioPorCorreo ? {
          nombre_usuario: usuarioPorCorreo.nombre_usuario,
          correo: usuarioPorCorreo.correo,
          tipo: usuarioPorCorreo.tipo,
          activo: usuarioPorCorreo.activo
        } : null,
        caseInsensitive: usuarioInsensitive ? {
          nombre_usuario: usuarioInsensitive.nombre_usuario,
          correo: usuarioInsensitive.correo,
          tipo: usuarioInsensitive.tipo,
          activo: usuarioInsensitive.activo
        } : null,
        similarEmails: usuariosSimilares.map(u => ({
          nombre_usuario: u.nombre_usuario,
          correo: u.correo,
          tipo: u.tipo,
          activo: u.activo
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error en debug-find-user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// POST - Forzar actualización de bienvenida para un usuario específico
router.post('/forzar-bienvenida/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    const usuario = await Usuario.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Actualizar bienvenida
    usuario.bienvenida_completada = true;
    usuario.opciones_bienvenida = {
      opcion_seleccionada: 'estoy_bien',
      fecha_completada: new Date()
    };
    
    await usuario.save();
    
    res.json({
      mensaje: 'Bienvenida actualizada correctamente',
      usuario: {
        _id: usuario._id,
        correo: usuario.correo,
        bienvenida_completada: usuario.bienvenida_completada,
        opciones_bienvenida: usuario.opciones_bienvenida
      }
    });
  } catch (error) {
    console.error('Error forzando bienvenida:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Actualizar TODOS los beneficiarios de una vez
router.post('/actualizar-todos-beneficiarios-bienvenida', async (req, res) => {
  try {
    const resultado = await Usuario.updateMany(
      {
        tipo: 'beneficiario',
        $or: [
          { bienvenida_completada: { $ne: true } },
          { bienvenida_completada: { $exists: false } }
        ]
      },
      {
        $set: {
          bienvenida_completada: true,
          'opciones_bienvenida.opcion_seleccionada': 'estoy_bien',
          'opciones_bienvenida.fecha_completada': new Date()
        }
      }
    );
    
    res.json({
      mensaje: 'Actualización masiva completada',
      encontrados: resultado.matchedCount,
      modificados: resultado.modifiedCount
    });
  } catch (error) {
    console.error('Error en actualización masiva:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para restablecer la contraseña
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.purpose !== 'password-reset') {
        return res.status(401).json({ message: 'Token inválido para esta operación' });
      }
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    
    const usuario = await Usuario.findOne({ 
      _id: decoded.id,
      reset_token: token,
      reset_token_expiry: { $gt: Date.now() }
    });
    
    if (!usuario) {
      return res.status(400).json({ 
        message: 'Token inválido o expirado'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    usuario.contrasena = newPassword;
    usuario.reset_token = undefined;
    usuario.reset_token_expiry = undefined;
    await usuario.save();
    
    // Email de confirmación opcional
    try {
      if (resend) {
        const confirmData = {
          from: process.env.RESEND_FROM_EMAIL || 'BNP Capital <onboarding@resend.dev>',
          to: [usuario.correo],
          subject: 'Contraseña restablecida - BNP Capital',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #065f46; color: white; padding: 20px; text-align: center;">
                <h2>BNP Capital</h2>
              </div>
              <div style="padding: 30px;">
                <h3 style="color: #065f46;">✅ Contraseña restablecida exitosamente</h3>
                <p>Hola ${usuario.nombre || usuario.nombre_usuario},</p>
                <p>Te confirmamos que tu contraseña ha sido restablecida correctamente.</p>
                <p>Si no realizaste este cambio, contacta inmediatamente con nuestro equipo de soporte.</p>
                <p>Saludos,<br><strong>Equipo BNP Capital</strong></p>
              </div>
            </div>
          `
        };
        
        await resend.emails.send(confirmData);
        console.log('✅ Email de confirmación enviado');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando email de confirmación:', emailError.message);
    }
    
    res.status(200).json({ 
      message: 'Contraseña restablecida con éxito'
    });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(400).json({ 
      message: 'Error al restablecer la contraseña'
    });
  }
});

export default router;