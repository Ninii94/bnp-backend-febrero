
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/Usuario.js';

const verificarToken = async (req, res, next) => {
  try {
    // Obtener el token del header o de los query params (para las descargas de documentos)
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Acceso no autorizado', 
        mensaje: 'No se proporcionó un token de autenticación.' 
      });
    }
    
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_development');
    
    // Buscar usuario en la base de datos para asegurar que existe y está activo
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({ 
        error: 'Acceso no autorizado', 
        mensaje: 'Usuario no encontrado.' 
      });
    }
    
    if (!usuario.activo) {
      return res.status(401).json({ 
        error: 'Acceso no autorizado', 
        mensaje: 'Usuario desactivado.' 
      });
    }
    
    // Añadir información del usuario a la request
    req.usuario = {
      id: usuario._id,
      nombre_usuario: usuario.nombre_usuario,
      correo: usuario.correo,
      tipo: usuario.tipo || decoded.tipo
    };
    
    // Mantener compatibilidad con código existente que usa req.tipo
    req.tipo = usuario.tipo || decoded.tipo;
    
    next();
  } catch (error) {
    console.error('Error al verificar token:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado', 
        mensaje: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token inválido', 
        mensaje: 'Token de autenticación inválido.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Error de autenticación', 
      mensaje: 'Error al procesar la autenticación.' 
    });
  }
};

export default verificarToken;