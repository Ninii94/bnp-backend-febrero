//resend prueba
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/index.js';
import bcrypt from 'bcrypt'; 
import { Resend } from 'resend';

// Configurar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Función para iniciar sesión
export const login = async (req, res) => {
  try {
    // 🔧 DEBUG: ver qué llega al backend
    console.log('🔍 LOGIN DEBUG - Body recibido:', req.body);
    console.log('🔍 LOGIN DEBUG - Headers:', req.headers);
    
    const { nombre_usuario, contrasena, tipo } = req.body;
    
    // 🔧 DEBUG: ver campos extraídos
    console.log('📋 Campos extraídos:');
    console.log('  - nombre_usuario:', nombre_usuario);
    console.log('  - contrasena:', contrasena ? 'PRESENTE' : 'FALTANTE');
    console.log('  - tipo:', tipo);
    
    // Verificar que todos los campos estén presentes
    if (!nombre_usuario || !contrasena || !tipo) {
      console.log('❌ Campos faltantes detectados');
      return res.status(400).json({ 
        message: 'Faltan campos requeridos',
        missing: {
          nombre_usuario: !nombre_usuario,
          contrasena: !contrasena,
          tipo: !tipo
        }
      });
    }
    
    // Buscar usuario por nombre de usuario y tipo
    console.log('🔍 Buscando usuario...');
    const usuario = await Usuario.findOne({ 
      nombre_usuario, 
      tipo
    });
    
    console.log('👤 Usuario encontrado:', !!usuario);
    
    if (!usuario) {
      // Debug: listar usuarios para comparar
      const usuarios = await Usuario.find({}).limit(5);
      console.log('📊 Usuarios en DB:', usuarios.map(u => ({
        nombre_usuario: u.nombre_usuario,
        tipo: u.tipo
      })));
      
      return res.status(400).json({ message: 'Usuario no encontrado' });
    }
    
    // Verificar contraseña (asumiendo que tienes un método para verificar la contraseña)
    const passwordMatch = await usuario.comparePassword(contrasena);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: usuario._id, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return res.status(200).json({
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombre_usuario: usuario.nombre_usuario,
        email: usuario.correo,
        tipo: usuario.tipo
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Función para solicitar recuperación de contraseña
export const requestPasswordReset = async (req, res) => {
  try {
    console.log('🔍 Datos recibidos:', req.body);
    const { email, correo, tipo } = req.body;
    
    // Usar correo o email (para compatibilidad)
    const emailToUse = correo || email;
    
    // Validar campos requeridos
    if (!emailToUse || !tipo) {
      return res.status(400).json({ 
        message: 'Correo electrónico y tipo son requeridos',
        received: { correo: !!emailToUse, tipo: !!tipo }
      });
    }
    
    // Buscar usuario por correo y tipo (el modelo usa 'correo', no 'email')
    const usuario = await Usuario.findOne({ correo: emailToUse, tipo });
    console.log('👤 Usuario encontrado:', !!usuario);
    
    if (!usuario) {
      // Por seguridad, no revelamos si el email existe o no
      return res.status(200).json({ 
        message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
      });
    }
    
    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(401).json({ message: 'Usuario no activo' });
    }
    
    // Generar token de recuperación de contraseña (válido por 1 hora)
    const resetToken = jwt.sign(
      { id: usuario._id, tipo: usuario.tipo, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Guardar el token en la base de datos
    usuario.reset_token = resetToken;
    usuario.reset_token_expiry = Date.now() + 3600000; // 1 hora en milisegundos
    await usuario.save();
    
    // URL para el restablecimiento de contraseña
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    // Configurar el mensaje para Resend
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'BNP Capital <noreply@tu-dominio.com>',
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
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <!-- Header -->
            <div style="background-color: #065f46; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">BNP Capital</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Sistema de recuperación de contraseña</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #065f46; margin: 0 0 20px 0; font-size: 24px;">¡Hola ${usuario.nombre}!</h2>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en BNP Capital.
              </p>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 30px;">
                Si no has solicitado este cambio, puedes ignorar este correo y tu contraseña permanecerá sin cambios.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}" 
                   style="display: inline-block; background-color: #065f46; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  Restablecer mi contraseña
                </a>
              </div>
              
              <!-- Alternative link -->
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                  Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
                </p>
                <p style="color: #065f46; word-break: break-all; margin: 0; font-family: monospace; font-size: 12px;">
                  ${resetUrl}
                </p>
              </div>
              
              <!-- Security notice -->
              <div style="border-left: 4px solid #fbbf24; background-color: #fffbeb; padding: 15px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                  ⚠️ Este enlace es válido por 1 hora por motivos de seguridad.
                </p>
              </div>
              
              <p style="color: #6b7280; line-height: 1.6; margin-bottom: 10px;">
                Saludos cordiales,
              </p>
              <p style="color: #065f46; font-weight: bold; margin: 0;">
                Equipo BNP Capital
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      // También incluir versión texto plano
      text: `
        Hola ${usuario.nombre},
        
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en BNP Capital.
        
        Para restablecer tu contraseña, visita el siguiente enlace (válido por 1 hora):
        ${resetUrl}
        
        Si no has solicitado este cambio, puedes ignorar este correo.
        
        Saludos,
        Equipo BNP Capital
      `
    };
    
    // Enviar correo con Resend
    console.log('📧 Enviando correo con Resend...');
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error('❌ Error de Resend:', error);
      return res.status(500).json({ 
        message: 'Error al enviar el correo de recuperación',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
    
    console.log('✅ Correo enviado exitosamente. ID:', data?.id);
    
    return res.status(200).json({ 
      message: 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña' 
    });
    
  } catch (error) {
    console.error('❌ Error en requestPasswordReset:', error);
    
    return res.status(500).json({ 
      message: 'Error del servidor al procesar la solicitud',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Función para restablecer la contraseña
export const resetPassword = async (req, res) => {
  try {
    const { token, contrasena } = req.body;
    
    if (!token || !contrasena) {
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    }
    
    // Verificar que el token sea válido
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el token sea específicamente para reset de contraseña
      if (decoded.purpose !== 'password-reset') {
        return res.status(401).json({ message: 'Token inválido para esta operación' });
      }
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    
    // Buscar usuario por ID
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(401).json({ message: 'Usuario no activo' });
    }
    
    // Verificar que el token almacenado coincide y no ha expirado
    if (usuario.reset_token !== token || Date.now() > usuario.reset_token_expiry) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    
    // Validar longitud mínima de contraseña
    if (contrasena.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    // Encriptar la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);
    
    // Actualizar contraseña y limpiar tokens de recuperación
    usuario.contrasena = hashedPassword;
    usuario.reset_token = undefined;
    usuario.reset_token_expiry = undefined;
    
    await usuario.save();
    
    // Opcional: Enviar email de confirmación
    try {
      const confirmEmailData = {
        from: process.env.RESEND_FROM_EMAIL || 'BNP Capital <noreply@tu-dominio.com>',
        to: [usuario.correo],
        subject: 'Contraseña restablecida exitosamente - BNP Capital',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #065f46; color: white; padding: 20px; text-align: center;">
              <h2>BNP Capital</h2>
            </div>
            <div style="padding: 20px;">
              <h3>✅ Contraseña restablecida exitosamente</h3>
              <p>Hola ${usuario.nombre},</p>
              <p>Te confirmamos que tu contraseña ha sido restablecida exitosamente.</p>
              <p>Si no realizaste este cambio, contacta inmediatamente con nuestro equipo de soporte.</p>
              <p>Saludos,<br>Equipo BNP Capital</p>
            </div>
          </div>
        `
      };
      
      await resend.emails.send(confirmEmailData);
    } catch (emailError) {
      console.error('Error enviando email de confirmación:', emailError);
      // No fallar si el email de confirmación falla
    }
    
    return res.status(200).json({ message: 'Contraseña restablecida con éxito' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Middleware para verificar el token JWT
export const checkAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No hay token, acceso denegado' });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({ message: 'Token no válido' });
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(401).json({ message: 'Usuario no activo' });
    }

    // Agregar usuario y tipo al request
    req.usuario = usuario;
    req.tipo = decoded.tipo;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token no válido' });
  }
};

// Middleware para verificar si es equipo BNP
export const isEquipoBNP = (req, res, next) => {
  if (req.tipo !== 'equipo_bnp') {
    return res.status(403).json({ 
      message: 'Acceso denegado - Se requieren permisos de equipo BNP' 
    });
  }
  next();
};

// Middleware para verificar si es aliado
export const isAliado = (req, res, next) => {
  if (req.tipo !== 'aliado') {
    return res.status(403).json({ 
      message: 'Acceso denegado - Se requieren permisos de aliado' 
    });
  }
  next();
};

// Middleware para verificar si es beneficiario
export const isBeneficiario = (req, res, next) => {
  if (req.tipo !== 'beneficiario') {
    return res.status(403).json({ 
      message: 'Acceso denegado - Se requieren permisos de beneficiario' 
    });
  }
  next();
};