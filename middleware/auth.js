import jwt from "jsonwebtoken";
import { Usuario } from "../models/Usuario.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Aliado } from "../models/Aliado.js";
import mongoose from "mongoose";

// Middleware para verificar el token JWT
export const checkAuth = async (req, res, next) => {
  try {
    // ===== DEBUG SUPER DETALLADO =====
    console.log('🔐 === CHECKAUTH DEBUG INICIADO ===');
    console.log('  URL:', req.originalUrl);
    console.log('  Method:', req.method);
    console.log('  Headers recibidos:', Object.keys(req.headers));
    console.log('  Headers completos:', JSON.stringify(req.headers, null, 2));
    
    // Probar diferentes formas de obtener el header
    const authHeader1 = req.headers.authorization;
    const authHeader2 = req.headers['authorization'];
    const authHeader3 = req.header("Authorization");
    const authHeader4 = req.get("Authorization");
    
    console.log('  AuthHeader method 1 (req.headers.authorization):', authHeader1);
    console.log('  AuthHeader method 2 (req.headers["authorization"]):', authHeader2);
    console.log('  AuthHeader method 3 (req.header("Authorization")):', authHeader3);
    console.log('  AuthHeader method 4 (req.get("Authorization")):', authHeader4);
    
    // Verificar si algún header contiene "Bearer"
    const headersWithBearer = Object.entries(req.headers).filter(([key, value]) => 
      typeof value === 'string' && value.includes('Bearer')
    );
    console.log('  Headers que contienen "Bearer":', headersWithBearer);
    
    const authHeader = req.header("Authorization");
    console.log("Authorization Header final:", authHeader);

    const token = authHeader?.replace("Bearer ", "");

    console.log('  Token extraído:', {
      authHeaderExists: !!authHeader,
      authHeaderValue: authHeader,
      tokenAfterReplace: token,
      tokenLength: token?.length
    });

    if (!token) {
      console.log("❌ CHECKAUTH: No token provided");
      console.log('🔍 DUMP COMPLETO DE HEADERS:');
      for (const [key, value] of Object.entries(req.headers)) {
        console.log(`    ${key}: ${value}`);
      }
      return res.status(401).json({ message: "No hay token, acceso denegado" });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decodificado:', decoded);

    // Buscar usuario
    const usuario = await Usuario.findById(decoded.id);

    if (!usuario) {
      console.log('❌ Usuario no encontrado para ID:', decoded.id);
      return res.status(401).json({ message: "Token no válido" });
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      console.log('❌ Usuario no activo:', usuario.nombre_usuario);
      return res.status(401).json({ message: "Usuario no activo" });
    }

    console.log('✅ Usuario autenticado exitosamente:', {
      id: usuario._id,
      nombre: usuario.nombre_usuario,
      tipo: decoded.tipo
    });

    // Agregar usuario y tipo al request
    req.usuario = usuario;
    req.tipo = decoded.tipo;

    console.log('🔐 === CHECKAUTH DEBUG COMPLETADO ===');
    next();
  } catch (error) {
    console.error("❌ Authentication middleware error:", error);
    console.error('🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ message: "Authentication failed", error: error.message });
  }
};
// Middleware para verificar si es equipo BNP
export const isEquipoBNP = (req, res, next) => {
  console.log("Checking BNP Team Access:", {
    userType: req.tipo,
    userId: req.usuario?._id,
  });

  if (req.tipo !== "equipo_bnp") {
    console.warn("Access denied - Not BNP team", {
      attemptedType: req.tipo,
      expectedType: "equipo_bnp",
    });
    return res.status(403).json({
      message: "Acceso denegado - Se requieren permisos de equipo BNP",
      details: {
        attemptedType: req.tipo,
        expectedType: "equipo_bnp",
      },
    });
  }
  next();
};

// Middleware para verificar si es aliado
export const isAliado = async (req, res, next) => {
  try {
    // Verificar el tipo de usuario
    if (req.tipo !== "aliado") {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado - Se requieren permisos de aliado",
      });
    }

    // Verificar que el usuario exista en req
    if (!req.usuario || !req.usuario._id) {
      return res.status(400).json({
        success: false,
        message: "No se pudo identificar el usuario",
      });
    }

    // Buscar el perfil de aliado asociado con este usuario
    try {
      const aliado = await Aliado.findOne({
        usuario_id: req.usuario._id,
      });

      if (!aliado) {
        console.error(
          `No se encontró perfil de aliado para el usuario ${req.usuario._id}`
        );
        return res.status(404).json({
          success: false,
          message: "No se encontró un perfil de aliado para este usuario",
        });
      }

      // Asignar el aliado al objeto request
      req.aliado = aliado;

      console.log("Aliado verificado:", {
        id: aliado._id,
        nombre: aliado.nombre,
        usuarioId: aliado.usuario_id,
      });

      next();
    } catch (dbError) {
      console.error("Error al buscar aliado en DB:", dbError);
      return res.status(500).json({
        success: false,
        message: "Error al verificar perfil de aliado",
        error: dbError.message,
      });
    }
  } catch (error) {
    console.error("Error en middleware isAliado:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

// Middleware para verificar si es beneficiario
export const isBeneficiario = async (req, res, next) => {
  // First, check user type
  if (req.tipo !== "beneficiario") {
    return res.status(403).json({
      message: "Acceso denegado - Se requieren permisos de beneficiario",
    });
  }

  try {
    // Log additional debugging information
    console.log("Verificando beneficiario para usuario:", {
      usuarioId: req.usuario._id,
      usuarioTipo: req.usuario.tipo,
      usuarioNombre: req.usuario.nombre_usuario,
    });

    // Debugging: Log the actual _id type and value
    console.log("Tipo de usuarioId:", typeof req.usuario._id);
    console.log("Valor de usuarioId:", req.usuario._id.toString());

    // Find beneficiary record with explicit conversion to string
    const beneficiario = await Beneficiario.findOne({
      usuario_id: req.usuario._id.toString(),
    });

    console.log("Resultado de búsqueda de beneficiario:", beneficiario);

    // If no beneficiario found, log all beneficiarios to help diagnose
    if (!beneficiario) {
      const todosLosBeneficiarios = await Beneficiario.find({});
      console.log(
        "Todos los beneficiarios:",
        todosLosBeneficiarios.map((b) => ({
          _id: b._id,
          usuario_id: b.usuario_id,
          nombre: b.nombre,
        }))
      );
    }

    // If still no beneficiario, return a more informative error
    if (!beneficiario) {
      return res.status(404).json({
        message: "No se encontró un perfil de beneficiario para este usuario",
        usuarioId: req.usuario._id.toString(),
      });
    }

    req.beneficiario = beneficiario;
    next();
  } catch (error) {
    console.error("Error detallado en middleware de beneficiario:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return res.status(500).json({
      message: "Error al verificar beneficiario",
      error: error.message,
      detalles: {
        usuarioId: req.usuario._id.toString(),
        usuarioTipo: req.usuario.tipo,
      },
    });
  }
};
