// contratoEquipoRoutes.js - VERSIÓN COMPLETA INTEGRADA
import express from "express";
import mongoose from "mongoose";
import { ContratoEquipo } from "../models/ContratoEquipo.js";
import { TerminosCondicionesEquipo } from "../models/TerminosCondicionesEquipo.js";
import { Aliado } from "../models/Aliado.js";
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import fetch from "node-fetch";
import { 
  registrarContratoEquipoCreado,
  registrarContratoEquipoManual 
} from '../middleware/bitacoraHelpers.js';



const router = express.Router();

console.log("🚀 === INICIANDO contratoEquipoRoutes.js ===");

// ============================================
// 🔥 CONFIGURACIÓN DE EMAILJS CON 3 TEMPLATES
// ============================================
const emailJSConfig = {
  serviceId: "service_kxb9m4s",
  publicKey: "YnTJfg1hrkxkj_umn",
  privateKey: "VlMx2Txj_54mvDOz_xw-f",
  templates: {
    tipo_a: "template_6yj09vs",
    tipo_b: "template_o9cxxn1",
    tipo_c: "template_ifkujpb",
  },
};

console.log("📋 Configuración EmailJS Multi-Template:", {
  serviceId: emailJSConfig.serviceId,
  publicKey: emailJSConfig.publicKey ? "CONFIGURADO" : "NO CONFIGURADO",
  privateKey: emailJSConfig.privateKey ? "CONFIGURADO" : "NO CONFIGURADO",
  templates: emailJSConfig.templates,
});

// ============================================
// 🔥 FUNCIÓN DE ENVÍO DE EMAIL
// ============================================
async function enviarEmailContratoEquipo(
  aliado,
  linkFirma,
  fechaInicio,
  fechaFin,
  observaciones,
  tipoPlantilla = "tipo_a"
) {
  console.log("📤 === INICIANDO ENVÍO DE EMAIL ===");
  console.log("Destinatario:", aliado.correo);
  console.log("Tipo de plantilla:", tipoPlantilla);

  if (!aliado.correo) {
    throw new Error("El aliado no tiene correo electrónico");
  }

  if (!["tipo_a", "tipo_b", "tipo_c"].includes(tipoPlantilla)) {
    throw new Error(`Tipo de plantilla inválido: ${tipoPlantilla}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(aliado.correo)) {
    throw new Error("Formato de email inválido");
  }

  try {
    const fechaInicioFormateada = new Date(fechaInicio).toLocaleDateString(
      "es-ES",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const fechaFinFormateada = new Date(fechaFin).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const templateParams = {
      email: aliado.correo,
      to_name: aliado.nombre,
      fecha_inicio: fechaInicioFormateada,
      fecha_fin: fechaFinFormateada,
      observaciones: observaciones || "Sin observaciones adicionales",
      link_firma: linkFirma,
      numero_contrato: `CONT-EQ-${Date.now()}`,
      fecha_envio: new Date().toLocaleDateString("es-ES"),
      empresa: "BNP Capital",
      contacto_empresa: "Equipo BNP Capital",
      email_contacto: "bnpcap.dev@gmail.com",
      aliado_nombre: aliado.nombre,
      aliado_ruc: aliado.ruc || "No especificado",
      aliado_direccion: aliado.direccion || "No especificada",
      aliado_telefono: aliado.telefono || "No especificado",
      aliado_razon_social: aliado.razon_social || aliado.nombre,
      mensaje_bienvenida: `Estimado/a ${aliado.nombre}, nos complace enviarle el contrato de colaboración.`,
      mensaje_instrucciones:
        "Por favor, revise el contrato y proceda con la firma digital.",
      tipo_firma: "Firma Digital",
      valor_legal:
        "La firma digital tiene la misma validez legal que una firma manuscrita",
      validez_enlace: "30 días",
    };

    const templateId = emailJSConfig.templates[tipoPlantilla];
    const emailData = {
      service_id: emailJSConfig.serviceId,
      template_id: templateId,
      user_id: emailJSConfig.publicKey,
      template_params: templateParams,
      accessToken: emailJSConfig.privateKey,
    };

    const response = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      }
    );

    if (response.ok) {
      console.log("✅ Email enviado exitosamente");
      return true;
    } else {
      const errorText = await response.text();
      console.error("❌ Error EmailJS:", response.status, errorText);
      throw new Error(`EmailJS Error: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Error al enviar email:", error);
    throw error;
  }
}

// ============================================
// CONFIGURACIÓN DE MULTER
// ============================================

// Multer para contratos firmados
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/contratosequipo/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `contratoequipo-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten archivos PDF"));
  },
});

// Multer para términos y condiciones
const storageTerminos = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/terminos-condiciones/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `terminos-${req.body.tipo_plantilla || "general"}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

const uploadTerminos = multer({
  storage: storageTerminos,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten archivos PDF"));
  },
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================
const obtenerIPReal = (req) => {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  let clientIp = cfConnectingIp;
  if (!clientIp && xForwardedFor) {
    clientIp = xForwardedFor.split(",")[0].trim();
  }
  if (!clientIp) {
    clientIp = xRealIp || req.ip;
  }
  return clientIp || "127.0.0.1";
};

const generarHashContrato = (contenido) => {
  return crypto.createHash("sha256").update(contenido).digest("hex");
};

// ============================================
// RUTAS DE ALIADOS
// ============================================
router.get("/aliados", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const aliados = await Aliado.find()
      .select(
        "nombre correo telefono direccion razon_social ruc servicios tipo_servicio inicio_contrato fin_contrato"
      )
      .populate("servicios", "nombre descripcion")
      .populate("tipo_servicio", "nombre descripcion")
      .sort({ nombre: 1 });

    const aliadosFormateados = aliados.map((aliado) => {
      const aliadoObj = aliado.toObject();
      let serviciosCompletos = [];

      if (aliado.servicios && aliado.servicios.length > 0) {
        serviciosCompletos = [...serviciosCompletos, ...aliado.servicios];
      }
      if (aliado.tipo_servicio && aliado.tipo_servicio.length > 0) {
        serviciosCompletos = [...serviciosCompletos, ...aliado.tipo_servicio];
      }

      const serviciosUnicos = serviciosCompletos.filter(
        (servicio, index, self) =>
          index ===
          self.findIndex((s) => s._id?.toString() === servicio._id?.toString())
      );

      aliadoObj.servicios = serviciosUnicos;
      return aliadoObj;
    });

    res.json(aliadosFormateados);
  } catch (error) {
    console.error("Error al obtener aliados:", error);
    res
      .status(500)
      .json({ message: "Error al obtener aliados", error: error.message });
  }
});

// ============================================
// RUTAS DE CONTRATOS
// ============================================
router.get("/contratos", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const contratos = await ContratoEquipo.find()
      .populate({
        path: "aliado_id",
        select:
          "nombre correo telefono razon_social ruc direccion servicios tipo_servicio",
        populate: [
          { path: "servicios", select: "nombre descripcion" },
          { path: "tipo_servicio", select: "nombre descripcion" },
        ],
      })
      .populate("creado_por", "nombre_usuario")
      .sort({ createdAt: -1 });

    const contratosFormateados = contratos.map((contrato) => {
      const contratoObj = contrato.toObject();
      if (contratoObj.aliado_id) {
        let serviciosCompletos = [];
        if (contratoObj.aliado_id.servicios) {
          serviciosCompletos = [
            ...serviciosCompletos,
            ...contratoObj.aliado_id.servicios,
          ];
        }
        if (contratoObj.aliado_id.tipo_servicio) {
          serviciosCompletos = [
            ...serviciosCompletos,
            ...contratoObj.aliado_id.tipo_servicio,
          ];
        }
        const serviciosUnicos = serviciosCompletos.filter(
          (servicio, index, self) =>
            index ===
            self.findIndex(
              (s) => s._id?.toString() === servicio._id?.toString()
            )
        );
        contratoObj.aliado_id.servicios = serviciosUnicos;
      }
      return contratoObj;
    });

    res.json(contratosFormateados);
  } catch (error) {
    console.error("Error al obtener contratos:", error);
    res
      .status(500)
      .json({ message: "Error al obtener contratos", error: error.message });
  }
});

router.post("/crear-sin-email", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const {
      aliado_id,
      tipo_plantilla = "tipo_a",
      fecha_inicio,
      fecha_fin,
      observaciones,
      terminos,
    } = req.body;

    console.log("📋 === CREANDO CONTRATO ===");
    console.log("Aliado ID:", aliado_id);
    console.log("Tipo de plantilla:", tipo_plantilla);

    if (!["tipo_a", "tipo_b", "tipo_c"].includes(tipo_plantilla)) {
      return res.status(400).json({
        message: "Tipo de plantilla inválido",
        tiposPermitidos: ["tipo_a", "tipo_b", "tipo_c"],
      });
    }

    const aliado = await Aliado.findById(aliado_id);
    if (!aliado) {
      return res.status(404).json({ message: "Aliado no encontrado" });
    }

    if (!aliado.correo) {
      return res.status(400).json({
        message: "El aliado no tiene correo electrónico registrado",
        aliado: aliado.nombre,
      });
    }

    const tokenFirma = uuidv4();
    const nuevoContrato = new ContratoEquipo({
      aliado_id,
      tipo_plantilla,
      fecha_inicio,
      fecha_fin,
      observaciones,
      terminos_condiciones: terminos,
      token_firma: tokenFirma,
      email_enviado: false,
      creado_por: req.usuario._id,
    });

    const contratoGuardado = await nuevoContrato.save();
    await registrarContratoEquipoCreado({
  contrato_id: contratoGuardado._id,
  aliado_id: aliado._id,
  aliado_nombre: aliado.nombre || aliado.razon_social,
  fecha_inicio,
  fecha_fin,
  observaciones,
  estado: contratoGuardado.estado,
}, req);

    const linkFirma = `http://localhost:5173/firmar-contratoequipo/${tokenFirma}`;
    
    res.status(201).json({
      message: "Contrato creado exitosamente",
      contrato: contratoGuardado,
      aliado: {
        _id: aliado._id,
        nombre: aliado.nombre,
        correo: aliado.correo,
        ruc: aliado.ruc,
        direccion: aliado.direccion,
        telefono: aliado.telefono,
        razon_social: aliado.razon_social,
      },
      linkFirma,
      tokenFirma,
      tipoPlantilla: tipo_plantilla,
      emailEnviado: false,
    });
  } catch (error) {
    console.error("❌ Error al crear contrato:", error);
    res
      .status(500)
      .json({ message: "Error al crear contrato", error: error.message });
  }
});

router.patch(
  "/:id/marcar-email-enviado",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { email_enviado, email_enviado_timestamp } = req.body;

      const contrato = await ContratoEquipo.findById(id);
      if (!contrato) {
        return res.status(404).json({ message: "Contrato no encontrado" });
      }

      contrato.email_enviado = email_enviado;
      if (email_enviado_timestamp) {
        contrato.email_enviado_timestamp = new Date(email_enviado_timestamp);
      }
      await contrato.save();

      res.json({
        message: "Estado de email actualizado exitosamente",
        contrato_id: id,
        email_enviado: contrato.email_enviado,
      });
    } catch (error) {
      console.error("❌ Error al marcar email:", error);
      res
        .status(500)
        .json({
          message: "Error al actualizar estado de email",
          error: error.message,
        });
    }
  }
);

router.post(
  "/subir-manual",
  checkAuth,
  isEquipoBNP,
  upload.single("contrato"),
  async (req, res) => {
    try {
      const { aliado_id, fecha_inicio, fecha_fin, observaciones } = req.body;

      if (!req.file) {
        return res
          .status(400)
          .json({ message: "No se proporcionó archivo PDF" });
      }

      const aliado = await Aliado.findById(aliado_id);
      if (!aliado) {
        return res.status(404).json({ message: "Aliado no encontrado" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const hashDocumento = generarHashContrato(fileBuffer);
      const clientIP = obtenerIPReal(req);
      const userAgent =
        req.headers["user-agent"] || "Navegador no identificado";

      const validezLegal = {
        hash_documento: hashDocumento,
        timestamp: new Date(),
        ip_firma: clientIP,
        user_agent: userAgent,
        verificado: true,
      };

      const nuevoContrato = new ContratoEquipo({
        aliado_id,
        fecha_inicio: new Date(fecha_inicio),
        fecha_fin: new Date(fecha_fin),
        observaciones: observaciones || "Contrato subido manualmente",
        terminos_condiciones: "Contrato físico - Ver documento adjunto",
        estado: "firmado",
        fecha_firma: new Date(),
        contrato_firmado: {
          nombre: req.file.originalname,
          url: `${req.protocol}://${req.get("host")}/uploads/contratosequipo/${req.file.filename}`,
          ruta: req.file.path,
          hash: hashDocumento,
          tamano: req.file.size,
        },
        validez_legal: validezLegal,
        email_enviado: false,
        creado_por: req.usuario._id,
      });

      const contratoGuardado = await nuevoContrato.save();
      await registrarContratoEquipoManual({
  contrato_id: contratoGuardado._id,
  aliado_id: aliado._id,
  aliado_nombre: aliado.nombre || aliado.razon_social,
  fecha_inicio: req.body.fecha_inicio,
  fecha_fin: req.body.fecha_fin,
  observaciones: req.body.observaciones,
  archivo_nombre: req.file.filename,
  archivo_tamano: req.file.size,
}, req);

      await Aliado.findByIdAndUpdate(aliado_id, {
        inicio_contrato: new Date(fecha_inicio),
        fin_contrato: new Date(fecha_fin),
      });

      res.status(201).json({
        message: "Contrato subido exitosamente",
        contrato: contratoGuardado,
        validez_legal: contratoGuardado.validez_legal,
      });
    } catch (error) {
      console.error("❌ Error en subida manual:", error);
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error al eliminar archivo temporal:", err);
        });
      }
      res
        .status(500)
        .json({ message: "Error al subir contrato", error: error.message });
    }
  }
);

router.get(
  "/contratos/:id/datos-reenvio",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { id } = req.params;
      const contrato = await ContratoEquipo.findById(id).populate({
        path: "aliado_id",
        select: "nombre correo telefono razon_social ruc direccion",
      });

      if (!contrato) {
        return res.status(404).json({ message: "Contrato no encontrado" });
      }

      const linkFirma = `${process.env.FRONTEND_URL || "https://www.beneficiosbnp.com.br"}/firmar-contratoequipo/${contrato.token_firma}`;

      res.json({
        _id: contrato._id,
        aliado_id: contrato.aliado_id,
        fecha_inicio: contrato.fecha_inicio,
        fecha_fin: contrato.fecha_fin,
        observaciones: contrato.observaciones,
        tipo_plantilla: contrato.tipo_plantilla || "tipo_a",
        linkFirma,
        token_firma: contrato.token_firma,
      });
    } catch (error) {
      console.error("❌ Error al obtener datos de reenvío:", error);
      res
        .status(500)
        .json({
          message: "Error al obtener datos de reenvío",
          error: error.message,
        });
    }
  }
);

router.post(
  "/contratos/:id/subir",
  checkAuth,
  isEquipoBNP,
  upload.single("contrato"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo" });
      }

      const contrato = await ContratoEquipo.findById(id);
      if (!contrato) {
        return res.status(404).json({ message: "Contrato no encontrado" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const hashDocumento = generarHashContrato(fileBuffer);
      const clientIP = obtenerIPReal(req);
      const userAgent =
        req.headers["user-agent"] || "Navegador no identificado";

      contrato.contrato_firmado = {
        nombre: req.file.originalname,
        url: `${req.protocol}://${req.get("host")}/uploads/contratosequipo/${req.file.filename}`,
        ruta: req.file.path,
        hash: hashDocumento,
        tamano: req.file.size,
      };

      contrato.estado = "firmado";
      contrato.fecha_firma = new Date();
      contrato.validez_legal = {
        hash_documento: hashDocumento,
        timestamp: new Date(),
        ip_firma: clientIP,
        user_agent: userAgent,
        verificado: true,
      };

      const contratoActualizado = await contrato.save();

      res.json({
        message: "Contrato firmado subido exitosamente",
        contrato: contratoActualizado,
        validez_legal: contratoActualizado.validez_legal,
      });
    } catch (error) {
      console.error("❌ Error en subida firmado:", error);
      res
        .status(500)
        .json({ message: "Error al subir contrato", error: error.message });
    }
  }
);

router.get("/contratos/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const contrato = await ContratoEquipo.findById(req.params.id)
      .populate({
        path: "aliado_id",
        select:
          "nombre correo telefono direccion razon_social ruc servicios tipo_servicio",
        populate: [
          { path: "servicios", select: "nombre descripcion" },
          { path: "tipo_servicio", select: "nombre descripcion" },
        ],
      })
      .populate("creado_por", "nombre_usuario");

    if (!contrato) {
      return res.status(404).json({ message: "Contrato no encontrado" });
    }

    const contratoObj = contrato.toObject();
    if (contratoObj.aliado_id) {
      let serviciosCompletos = [];
      if (contratoObj.aliado_id.servicios) {
        serviciosCompletos = [
          ...serviciosCompletos,
          ...contratoObj.aliado_id.servicios,
        ];
      }
      if (contratoObj.aliado_id.tipo_servicio) {
        serviciosCompletos = [
          ...serviciosCompletos,
          ...contratoObj.aliado_id.tipo_servicio,
        ];
      }
      const serviciosUnicos = serviciosCompletos.filter(
        (servicio, index, self) =>
          index ===
          self.findIndex((s) => s._id?.toString() === servicio._id?.toString())
      );
      contratoObj.aliado_id.servicios = serviciosUnicos;
    }

    res.json(contratoObj);
  } catch (error) {
    console.error("Error al obtener contrato:", error);
    res
      .status(500)
      .json({ message: "Error al obtener contrato", error: error.message });
  }
});

router.get(
  "/contratos/:id/verificar",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const contrato = await ContratoEquipo.findById(req.params.id);

      if (!contrato) {
        return res.status(404).json({ message: "Contrato no encontrado" });
      }

      if (!contrato.validez_legal) {
        return res.status(400).json({
          message: "Contrato no tiene datos de validez legal",
        });
      }

      const tieneValidezLegal =
        contrato.validez_legal.hash_documento &&
        contrato.validez_legal.timestamp &&
        contrato.validez_legal.ip_firma;

      if (!tieneValidezLegal) {
        return res.status(400).json({
          message: "Contrato tiene datos de validez legal incompletos",
        });
      }

      let integridadVerificada = false;
      let hashActual = null;

      const tieneArchivoFisico =
        contrato.contrato_firmado &&
        contrato.contrato_firmado.ruta &&
        fs.existsSync(contrato.contrato_firmado.ruta);

      if (tieneArchivoFisico) {
        try {
          const fileBuffer = fs.readFileSync(contrato.contrato_firmado.ruta);
          hashActual = generarHashContrato(fileBuffer);
          integridadVerificada =
            hashActual === contrato.validez_legal.hash_documento;
        } catch (error) {
          integridadVerificada = false;
        }
      } else {
        if (
          contrato.validez_legal.hash_documento &&
          contrato.terminos_condiciones
        ) {
          const hashTerminos = generarHashContrato(
            contrato.terminos_condiciones
          );
          integridadVerificada =
            hashTerminos === contrato.validez_legal.hash_documento;
          hashActual = hashTerminos;
        }
      }

      res.json({
        hash: contrato.validez_legal.hash_documento || "No disponible",
        timestamp: contrato.validez_legal.timestamp || new Date(),
        ip_firma: contrato.validez_legal.ip_firma || "No disponible",
        user_agent: contrato.validez_legal.user_agent || "No disponible",
        integridad_verificada: integridadVerificada,
        fecha_verificacion: new Date(),
        valido: integridadVerificada && contrato.validez_legal.verificado,
        hash_actual: hashActual,
        tiene_archivo_fisico: tieneArchivoFisico,
      });
    } catch (error) {
      console.error("❌ Error en verificación:", error);
      res
        .status(500)
        .json({ message: "Error al verificar contrato", error: error.message });
    }
  }
);

router.delete("/contratos/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const contrato = await ContratoEquipo.findById(id);

    if (!contrato) {
      return res.status(404).json({ message: "Contrato no encontrado" });
    }

    if (contrato.contrato_firmado && contrato.contrato_firmado.ruta) {
      try {
        if (fs.existsSync(contrato.contrato_firmado.ruta)) {
          fs.unlinkSync(contrato.contrato_firmado.ruta);
        }
      } catch (err) {
        console.error("Error al eliminar archivo:", err);
      }
    }

    await ContratoEquipo.findByIdAndDelete(id);
    res.json({ message: "Contrato eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar contrato:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar contrato", error: error.message });
  }
});

router.get("/contratos/:id/descargar", async (req, res) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Token de acceso requerido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== "equipo_bnp") {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const { id } = req.params;
    const { view } = req.query;
    const contrato = await ContratoEquipo.findById(id);

    if (!contrato || !contrato.contrato_firmado) {
      return res
        .status(404)
        .json({ message: "Contrato firmado no encontrado" });
    }

    const filePath = contrato.contrato_firmado.ruta;
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Archivo no encontrado en el servidor" });
    }

    if (view === "true") {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${contrato.contrato_firmado.nombre}"`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${contrato.contrato_firmado.nombre}"`
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error al servir contrato:", error);
    res
      .status(500)
      .json({ message: "Error al servir contrato", error: error.message });
  }
});

router.get("/archivo/:filename", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { filename } = req.params;
    const { download } = req.query;
    const filePath = path.join(
      process.cwd(),
      "uploads/contratosequipo",
      filename
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Archivo no encontrado" });
    }

    const stats = fs.statSync(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", stats.size);

    if (download === "true") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (error) => {
      console.error("Error al leer archivo:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error al leer el archivo" });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error al servir archivo:", error);
    res
      .status(500)
      .json({ message: "Error al servir archivo", error: error.message });
  }
});

// ============================================
// RUTAS PÚBLICAS PARA FIRMA
// ============================================
router.get("/firmar/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const contrato = await ContratoEquipo.findOne({
      token_firma: token,
    }).populate(
      "aliado_id",
      "nombre correo telefono direccion razon_social ruc"
    );

    if (!contrato) {
      return res
        .status(404)
        .json({ message: "Token de contrato inválido o expirado" });
    }

    // 🔥 OBTENER PDF DE TÉRMINOS SEGÚN TIPO DE PLANTILLA
    const tipoPlantilla = contrato.tipo_plantilla || "tipo_a";
    const terminos = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: tipoPlantilla,
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    res.json({
      contrato: {
        _id: contrato._id,
        aliado: contrato.aliado_id,
        tipo_plantilla: contrato.tipo_plantilla || "tipo_a",
        fecha_inicio: contrato.fecha_inicio,
        fecha_fin: contrato.fecha_fin,
        observaciones: contrato.observaciones,
        terminos_condiciones: contrato.terminos_condiciones,
        estado: contrato.estado,
        fecha_firma: contrato.fecha_firma,
        fecha_envio: contrato.fecha_envio,
        createdAt: contrato.createdAt,
        updatedAt: contrato.updatedAt,
        // ✅ AGREGAR PDF DE TÉRMINOS
        pdf_terminos: terminos?.pdf_terminos || null,
      },
    });
  } catch (error) {
    console.error("Error al obtener contrato para firma:", error);
    res
      .status(500)
      .json({ message: "Error al obtener contrato", error: error.message });
  }
});

router.post("/firmar/:token/confirmar", async (req, res) => {
  try {
    const { token } = req.params;
    const { firma_digital, fecha_firma } = req.body;

    const contrato = await ContratoEquipo.findOne({ token_firma: token });
    if (!contrato) {
      return res
        .status(404)
        .json({ message: "Token de contrato inválido o expirado" });
    }

    if (contrato.estado === "firmado") {
      return res
        .status(400)
        .json({ message: "Este contrato ya ha sido firmado" });
    }

    const hashTerminos = generarHashContrato(contrato.terminos_condiciones);
    const clientIP = obtenerIPReal(req);
    const userAgent = req.headers["user-agent"] || "Navegador no identificado";

    const validezLegal = {
      hash_documento: hashTerminos,
      timestamp: new Date(),
      ip_firma: clientIP,
      user_agent: userAgent,
      verificado: true,
    };

    contrato.estado = "firmado";
    contrato.fecha_firma = fecha_firma || new Date();
    contrato.validez_legal = validezLegal;

    const contratoFirmado = await contrato.save();

    await Aliado.findByIdAndUpdate(contrato.aliado_id, {
      inicio_contrato: contrato.fecha_inicio,
      fin_contrato: contrato.fecha_fin,
    });

    res.json({
      message: "Contrato firmado exitosamente con validez legal",
      estado: "firmado",
      hash_validez: hashTerminos,
      validez_legal: contratoFirmado.validez_legal,
    });
  } catch (error) {
    console.error("❌ Error en confirmación de firma:", error);
    res
      .status(500)
      .json({ message: "Error al confirmar firma", error: error.message });
  }
});

router.post("/firmar/:token/rechazar", async (req, res) => {
  try {
    const { token } = req.params;
    const { motivo_rechazo } = req.body;

    const contrato = await ContratoEquipo.findOne({ token_firma: token });
    if (!contrato) {
      return res
        .status(404)
        .json({ message: "Token de contrato inválido o expirado" });
    }

    contrato.estado = "rechazado";
    contrato.motivo_rechazo = motivo_rechazo;
    await contrato.save();

    res.json({
      message: "Contrato rechazado",
      estado: "rechazado",
    });
  } catch (error) {
    console.error("Error al rechazar contrato:", error);
    res
      .status(500)
      .json({ message: "Error al rechazar contrato", error: error.message });
  }
});

// ============================================
// RUTAS DE TÉRMINOS Y CONDICIONES
// ============================================

// Obtener todos los términos (por tipo)
router.get("/terminos/todos", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const terminosTipoA = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: "tipo_a",
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    const terminosTipoB = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: "tipo_b",
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    const terminosTipoC = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: "tipo_c",
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    const terminosGeneral = await TerminosCondicionesEquipo.findOne({
      $or: [
        { tipo_plantilla: "general" },
        { tipo_plantilla: { $exists: false } },
        { tipo_plantilla: null },
      ],
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    const terminos = {
      tipo_a: {
        texto: terminosTipoA?.contenido || terminosGeneral?.contenido || "",
        pdf: terminosTipoA?.pdf_terminos || null,
        version: terminosTipoA?.version || terminosGeneral?.version || 1,
      },
      tipo_b: {
        texto: terminosTipoB?.contenido || terminosGeneral?.contenido || "",
        pdf: terminosTipoB?.pdf_terminos || null,
        version: terminosTipoB?.version || terminosGeneral?.version || 1,
      },
      tipo_c: {
        texto: terminosTipoC?.contenido || terminosGeneral?.contenido || "",
        pdf: terminosTipoC?.pdf_terminos || null,
        version: terminosTipoC?.version || terminosGeneral?.version || 1,
      },
    };

    res.json({ success: true, terminos });
  } catch (error) {
    console.error("❌ Error al obtener términos:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al obtener términos",
        error: error.message,
      });
  }
});

// Obtener términos de un tipo específico
router.get("/terminos/:tipo", async (req, res) => {
  try {
    const { tipo } = req.params;

    if (!["tipo_a", "tipo_b", "tipo_c", "general"].includes(tipo)) {
      return res
        .status(400)
        .json({ success: false, message: "Tipo de plantilla inválido" });
    }

    let terminos = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: tipo,
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    if (!terminos) {
      terminos = await TerminosCondicionesEquipo.findOne({
        $or: [
          { tipo_plantilla: "general" },
          { tipo_plantilla: { $exists: false } },
          { tipo_plantilla: null },
        ],
        activo: true,
      }).sort({ version: -1, createdAt: -1 });
    }

    if (!terminos) {
      return res.json({
        success: true,
        terminos: { texto: "", pdf: null, version: 1 },
      });
    }

    res.json({
      success: true,
      terminos: {
        texto: terminos.contenido || "",
        pdf: terminos.pdf_terminos || null,
        version: terminos.version || 1,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener términos:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al obtener términos",
        error: error.message,
      });
  }
});

// Actualizar términos en texto
router.put("/terminos/texto", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { tipo_plantilla, contenido } = req.body;

    if (!["tipo_a", "tipo_b", "tipo_c", "general"].includes(tipo_plantilla)) {
      return res
        .status(400)
        .json({ success: false, message: "Tipo de plantilla inválido" });
    }

    let terminos = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla,
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    if (terminos) {
      // 🔥 ELIMINAR PDF ANTERIOR SI EXISTE
      if (
        terminos.pdf_terminos?.ruta &&
        fs.existsSync(terminos.pdf_terminos.ruta)
      ) {
        try {
          fs.unlinkSync(terminos.pdf_terminos.ruta);
          console.log(
            "✅ PDF anterior eliminado:",
            terminos.pdf_terminos.nombre
          );
        } catch (err) {
          console.error("Error al eliminar PDF anterior:", err);
        }
      }

      terminos.contenido = contenido;
      terminos.pdf_terminos = undefined; // 🔥 LIMPIAR REFERENCIA AL PDF
      terminos.version += 1;
      terminos.updatedAt = new Date();
      await terminos.save();

      console.log(
        `✅ Términos actualizados para ${tipo_plantilla} - Solo texto, PDF eliminado`
      );
    } else {
      terminos = new TerminosCondicionesEquipo({
        tipo_plantilla,
        contenido,
        version: 1,
        activo: true,
        creado_por: req.usuario._id,
      });
      await terminos.save();

      console.log(
        `✅ Nuevos términos creados para ${tipo_plantilla} - Solo texto`
      );
    }

    res.json({
      success: true,
      message: "Términos guardados exitosamente (PDF eliminado si existía)",
      terminos: {
        texto: terminos.contenido,
        pdf: terminos.pdf_terminos, // Será null/undefined
        version: terminos.version,
      },
    });
  } catch (error) {
    console.error("❌ Error al guardar términos:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al guardar términos",
        error: error.message,
      });
  }
});

// Subir PDF de términos
router.post(
  "/terminos/pdf",
  checkAuth,
  isEquipoBNP,
  uploadTerminos.single("pdf"),
  async (req, res) => {
    try {
      const { tipo_plantilla } = req.body;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No se proporcionó archivo PDF" });
      }

      if (!["tipo_a", "tipo_b", "tipo_c", "general"].includes(tipo_plantilla)) {
        fs.unlinkSync(req.file.path);
        return res
          .status(400)
          .json({ success: false, message: "Tipo de plantilla inválido" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const hashArchivo = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      const pdfData = {
        nombre: req.file.originalname,
        url: `${req.protocol}://${req.get("host")}/api/contratoequipo/terminos/pdf/${tipo_plantilla}/archivo`,
        ruta: req.file.path,
        hash: hashArchivo,
        tamano: req.file.size,
        fecha_subida: new Date(),
      };

      let terminos = await TerminosCondicionesEquipo.findOne({
        tipo_plantilla,
        activo: true,
      }).sort({ version: -1, createdAt: -1 });

      if (terminos) {
        if (
          terminos.pdf_terminos?.ruta &&
          fs.existsSync(terminos.pdf_terminos.ruta)
        ) {
          try {
            fs.unlinkSync(terminos.pdf_terminos.ruta);
          } catch (err) {
            console.error("Error al eliminar PDF anterior:", err);
          }
        }
        terminos.pdf_terminos = pdfData;
        terminos.version += 1;
        terminos.updatedAt = new Date();
        await terminos.save();
      } else {
        terminos = new TerminosCondicionesEquipo({
          tipo_plantilla,
          contenido: "",
          pdf_terminos: pdfData,
          version: 1,
          activo: true,
          creado_por: req.usuario._id,
        });
        await terminos.save();
      }

      res.json({
        success: true,
        message: "PDF de términos subido exitosamente",
        pdf: terminos.pdf_terminos,
        version: terminos.version,
      });
    } catch (error) {
      console.error("❌ Error al subir PDF:", error);
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error al eliminar archivo temporal:", err);
        });
      }
      res
        .status(500)
        .json({
          success: false,
          message: "Error al subir PDF",
          error: error.message,
        });
    }
  }
);

// Servir PDF de términos
router.get("/terminos/pdf/:tipo/archivo", async (req, res) => {
  try {
    const { tipo } = req.params;
    const { download, token } = req.query;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.tipo !== "equipo_bnp") {
          return res.status(403).json({ message: "Acceso denegado" });
        }
      } catch (err) {
        return res.status(401).json({ message: "Token inválido" });
      }
    }

    if (!["tipo_a", "tipo_b", "tipo_c", "general"].includes(tipo)) {
      return res
        .status(400)
        .json({ success: false, message: "Tipo de plantilla inválido" });
    }

    const terminos = await TerminosCondicionesEquipo.findOne({
      tipo_plantilla: tipo,
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    if (!terminos || !terminos.pdf_terminos) {
      return res
        .status(404)
        .json({ success: false, message: "PDF de términos no encontrado" });
    }

    const filePath = terminos.pdf_terminos.ruta;
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Archivo no encontrado en el servidor",
        });
    }

    res.setHeader("Content-Type", "application/pdf");

    if (download === "true") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${terminos.pdf_terminos.nombre}"`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${terminos.pdf_terminos.nombre}"`
      );
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("❌ Error al servir PDF:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al servir PDF",
        error: error.message,
      });
  }
});

// Eliminar PDF de términos
router.delete(
  "/terminos/pdf/:tipo",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { tipo } = req.params;

      if (!["tipo_a", "tipo_b", "tipo_c", "general"].includes(tipo)) {
        return res
          .status(400)
          .json({ success: false, message: "Tipo de plantilla inválido" });
      }

      const terminos = await TerminosCondicionesEquipo.findOne({
        tipo_plantilla: tipo,
        activo: true,
      }).sort({ version: -1, createdAt: -1 });

      if (!terminos || !terminos.pdf_terminos) {
        return res
          .status(404)
          .json({ success: false, message: "No hay PDF para eliminar" });
      }

      // ✅ VALIDACIÓN MANUAL: Advertir si no hay contenido
      const tieneContenido = terminos.contenido && terminos.contenido.trim() !== "";
      
      if (!tieneContenido) {
        console.warn("⚠️ Eliminando PDF sin contenido de texto alternativo");
      }

      // Eliminar archivo físico
      if (
        terminos.pdf_terminos.ruta &&
        fs.existsSync(terminos.pdf_terminos.ruta)
      ) {
        try {
          fs.unlinkSync(terminos.pdf_terminos.ruta);
          console.log("✅ PDF eliminado del servidor:", terminos.pdf_terminos.nombre);
        } catch (err) {
          console.error("⚠️ Error al eliminar archivo físico:", err);
        }
      }

      // Eliminar referencia del PDF
      terminos.pdf_terminos = undefined;
      terminos.version += 1;
      terminos.updatedAt = new Date();
      
      // 🔥 SOLUCIÓN: Guardar sin validación de Mongoose
      await terminos.save({ validateBeforeSave: false });

      res.json({
        success: true,
        message: tieneContenido 
          ? "PDF de términos eliminado exitosamente" 
          : "PDF eliminado. Recuerda agregar contenido de texto.",
        version: terminos.version,
        advertencia: !tieneContenido ? "No hay contenido de texto alternativo" : null
      });
    } catch (error) {
      console.error("❌ Error al eliminar PDF:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar PDF",
        error: error.message,
      });
    }
  }
);

// RUTAS DE COMPATIBILIDAD (mantienen funcionamiento actual)
router.get("/terminos", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const terminos = await TerminosCondicionesEquipo.findOne({
      $or: [
        { tipo_plantilla: "general" },
        { tipo_plantilla: { $exists: false } },
        { tipo_plantilla: null },
      ],
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    res.json({
      contenido: terminos?.contenido || "",
      version: terminos?.version || 1,
    });
  } catch (error) {
    console.error("Error al obtener términos:", error);
    res
      .status(500)
      .json({ message: "Error al obtener términos", error: error.message });
  }
});

router.put("/terminos", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { contenido } = req.body;

    let terminos = await TerminosCondicionesEquipo.findOne({
      $or: [
        { tipo_plantilla: "general" },
        { tipo_plantilla: { $exists: false } },
      ],
      activo: true,
    }).sort({ version: -1, createdAt: -1 });

    if (terminos) {
      terminos.contenido = contenido;
      terminos.version += 1;
      terminos.tipo_plantilla = "general";
      await terminos.save();
    } else {
      terminos = new TerminosCondicionesEquipo({
        tipo_plantilla: "general",
        contenido,
        version: 1,
        activo: true,
        creado_por: req.usuario._id,
      });
      await terminos.save();
    }

    res.json({
      message: "Términos y condiciones actualizados exitosamente",
      version: terminos.version,
    });
  } catch (error) {
    console.error("Error al actualizar términos:", error);
    res
      .status(500)
      .json({ message: "Error al actualizar términos", error: error.message });
  }
});

// ============================================
// FUNCIÓN PARA GENERAR HTML DEL CONTRATO
// ============================================
function generarHTMLContrato(contrato) {
  const aliado = contrato.aliado_id;

  const temas = {
    tipo_a: {
      nombre: "Colaboración EntradaFlex",
      color: "#10b981",
      gradiente: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      emoji: "🎫",
    },
    tipo_b: {
      nombre: "Colaboración Flyback",
      color: "#9333ea",
      gradiente: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)",
      emoji: "✈️",
    },
    tipo_c: {
      nombre: "Colaboración Refund360",
      color: "#4f46e5",
      gradiente: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
      emoji: "💰",
    },
  };

  const tema = temas[contrato.tipo_plantilla] || temas.tipo_a;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tema.nombre} - ${aliado.nombre}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: ${tema.gradiente};
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .header .emoji {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .content { padding: 40px; }
    .section { margin-bottom: 30px; }
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: ${tema.color};
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid ${tema.color};
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .info-item {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid ${tema.color};
    }
    .info-label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .info-value {
      font-size: 16px;
      color: #1f2937;
      font-weight: 500;
    }
    .terminos {
      background: #f9fafb;
      padding: 25px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      white-space: pre-wrap;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.8;
      max-height: 600px;
      overflow-y: auto;
    }
    .legal-notice {
      background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 25px;
      margin-top: 30px;
    }
    .legal-notice h3 {
      color: #1e40af;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .legal-notice p {
      color: #1e3a8a;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .legal-notice ul {
      list-style: none;
      padding-left: 0;
    }
    .legal-notice li {
      color: #1e40af;
      font-size: 13px;
      margin-bottom: 8px;
      padding-left: 25px;
      position: relative;
    }
    .legal-notice li:before {
      content: "✓";
      position: absolute;
      left: 0;
      font-weight: bold;
      color: #10b981;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #6b7280;
      font-size: 13px;
    }
    .badge {
      display: inline-block;
      background: ${tema.color};
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
    }
    @media print {
      body { padding: 0; background: white; }
      .container { box-shadow: none; border-radius: 0; }
      .terminos { max-height: none; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">${tema.emoji}</div>
      <h1>${tema.nombre}</h1>
      <p>Contrato de Colaboración Empresarial</p>
      <span class="badge">ID: ${contrato._id}</span>
    </div>
    
    <div class="content">
      <div class="section">
        <h2 class="section-title">📋 Información del Aliado</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nombre</div>
            <div class="info-value">${aliado.nombre}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${aliado.correo}</div>
          </div>
          ${
            aliado.telefono
              ? `
          <div class="info-item">
            <div class="info-label">Teléfono</div>
            <div class="info-value">${aliado.telefono}</div>
          </div>`
              : ""
          }
          ${
            aliado.ruc
              ? `
          <div class="info-item">
            <div class="info-label">RUC</div>
            <div class="info-value">${aliado.ruc}</div>
          </div>`
              : ""
          }
          ${
            aliado.razon_social
              ? `
          <div class="info-item">
            <div class="info-label">Razón Social</div>
            <div class="info-value">${aliado.razon_social}</div>
          </div>`
              : ""
          }
          ${
            aliado.direccion
              ? `
          <div class="info-item">
            <div class="info-label">Dirección</div>
            <div class="info-value">${aliado.direccion}</div>
          </div>`
              : ""
          }
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">📅 Detalles del Contrato</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Fecha de Inicio</div>
            <div class="info-value">${new Date(
              contrato.fecha_inicio
            ).toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Fecha de Fin</div>
            <div class="info-value">${new Date(
              contrato.fecha_fin
            ).toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Estado</div>
            <div class="info-value" style="text-transform: capitalize;">${contrato.estado}</div>
          </div>
          ${
            contrato.fecha_firma
              ? `
          <div class="info-item">
            <div class="info-label">Fecha de Firma</div>
            <div class="info-value">${new Date(
              contrato.fecha_firma
            ).toLocaleString("es-ES", {
              dateStyle: "full",
              timeStyle: "medium",
            })}</div>
          </div>`
              : ""
          }
        </div>
        ${
          contrato.observaciones
            ? `
        <div class="info-item" style="margin-top: 15px;">
          <div class="info-label">Observaciones</div>
          <div class="info-value">${contrato.observaciones}</div>
        </div>`
            : ""
        }
      </div>
      
      <div class="section">
        <h2 class="section-title">📜 Términos y Condiciones</h2>
        <div class="terminos">${contrato.terminos_condiciones}</div>
      </div>
      
      <div class="legal-notice">
        <h3>⚖️ Validez Legal en Brasil</h3>
        <p>
          Este contrato de firma digital cumple con la <strong>Medida Provisória nº 2.200-2/2001</strong> 
          y el <strong>Decreto nº 10.543/2020</strong> que regulan la firma electrónica en Brasil.
        </p>
        <ul>
          <li>Firma electrónica con validez jurídica</li>
          <li>Autenticidad garantizada por certificación digital</li>
          <li>Integridad del documento verificable</li>
          <li>Trazabilidad completa del proceso</li>
        </ul>
        <p style="margin-top: 15px; font-weight: 600;">
          <strong>Marco Legal:</strong> La firma digital tiene la misma validez que una firma 
          manuscrita, de acuerdo con el Art. 10 de la MP 2.200-2/2001 y la Lei nº 14.063/2020.
        </p>
      </div>
      
      ${
        contrato.validez_legal && contrato.validez_legal.hash_documento
          ? `
      <div class="section" style="margin-top: 30px;">
        <h2 class="section-title">🔐 Información de Validez Legal</h2>
        <div class="info-grid">
          <div class="info-item" style="grid-column: 1 / -1;">
            <div class="info-label">Hash de Validación (SHA-256)</div>
            <div class="info-value" style="font-family: monospace; font-size: 12px; word-break: break-all;">
              ${contrato.validez_legal.hash_documento}
            </div>
          </div>
          ${
            contrato.validez_legal.timestamp
              ? `
          <div class="info-item">
            <div class="info-label">Timestamp de Firma</div>
            <div class="info-value">${new Date(contrato.validez_legal.timestamp).toLocaleString("es-ES")}</div>
          </div>`
              : ""
          }
          ${
            contrato.validez_legal.ip_firma
              ? `
          <div class="info-item">
            <div class="info-label">IP de Firma</div>
            <div class="info-value">${contrato.validez_legal.ip_firma}</div>
          </div>`
              : ""
          }
        </div>
      </div>`
          : ""
      }
    </div>
    
    <div class="footer">
      <p><strong>BNP Capital</strong></p>
      <p>Documento generado electrónicamente el ${new Date().toLocaleString("es-ES")}</p>
      <p style="margin-top: 10px; font-size: 11px;">
        Este documento tiene validez legal de acuerdo con la legislación brasileña sobre firma electrónica
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================
// RUTAS PARA PREVIEW Y DESCARGA DE PDF
// ============================================

// Ruta para generar preview del PDF del contrato (pública)
router.get("/contratos/:id/pdf-preview", async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await ContratoEquipo.findById(id).populate({
      path: "aliado_id",
      select: "nombre correo telefono razon_social ruc direccion",
    });

    if (!contrato) {
      return res.status(404).json({ message: "Contrato no encontrado" });
    }

    // Si existe archivo firmado, servirlo
    if (contrato.contrato_firmado && contrato.contrato_firmado.ruta) {
      const filePath = contrato.contrato_firmado.ruta;

      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${contrato.contrato_firmado.nombre}"`
        );
        const fileStream = fs.createReadStream(filePath);
        return fileStream.pipe(res);
      }
    }

    // Si no hay PDF firmado, generar vista HTML
    const html = generarHTMLContrato(contrato);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("❌ Error al generar preview:", error);
    res.status(500).json({
      message: "Error al generar preview del contrato",
      error: error.message,
    });
  }
});

// Ruta para descargar PDF del contrato (pública)
router.get("/contratos/:id/descargar-pdf", async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await ContratoEquipo.findById(id).populate({
      path: "aliado_id",
      select: "nombre correo telefono razon_social ruc direccion",
    });

    if (!contrato) {
      return res.status(404).json({ message: "Contrato no encontrado" });
    }

    // Si existe archivo firmado, descargarlo
    if (contrato.contrato_firmado && contrato.contrato_firmado.ruta) {
      const filePath = contrato.contrato_firmado.ruta;

      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${contrato.contrato_firmado.nombre}"`
        );
        const fileStream = fs.createReadStream(filePath);
        return fileStream.pipe(res);
      }
    }

    // Si no hay PDF firmado, generar HTML para descarga
    const html = generarHTMLContrato(contrato);
    const filename = `Contrato-${contrato.aliado_id.nombre.replace(/\s+/g, "_")}-${id}.html`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (error) {
    console.error("❌ Error al descargar PDF:", error);
    res.status(500).json({
      message: "Error al descargar el contrato",
      error: error.message,
    });
  }
});

export default router;
