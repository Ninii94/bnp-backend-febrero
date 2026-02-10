// routes/contratoBeneficiarioRoutes.js - ACTUALIZADO
import express from "express";
import mongoose from "mongoose";
import { ContratoBeneficiario } from "../models/ContratoBeneficiario.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Estado } from '../models/Estado.js';
import { checkAuth, isAliado } from "../middleware/auth.js";
import multer from "multer";
import { bitacoraCentralMiddleware } from '../middleware/bitacoraCentralMiddleware.js';
import crypto from 'crypto';
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  generarHashArchivo,
  crearVersionDocumento,
  registrarNuevaVersion,
  generarCertificadoLGPD
} from "../utils/documentVersioningUtils.js";
import { 
  registrarContratoBeneficiarioCreado,
  registrarContratoBeneficiarioManual,
 registrarContratoBeneficiarioEnviado,  
  registrarContratoBeneficiarioFirmado,
    registrarContratoBeneficiarioRechazado
} from '../middleware/bitacoraHelpers.js';

const router = express.Router();

// ============================================
// 📋 CONFIGURACIÓN DE LOS 3 CONTRATOS CON PDFs PREDEFINIDOS
// ============================================
const CONTRATOS_CONFIG = {
  contrato_entradaflex: {
    id: "contrato_entradaflex",
    nombre: "Beneficio EntradaFlex",
    pdf: {
      nombre: "contratoentradaflex.pdf",
      ruta: "uploads/terminos-beneficiarios/contratoentradaflex.pdf",
      url: "/api/contrato-beneficiario/terminos-pdf/contrato_entradaflex",
    },
  },
  contrato_flyback: {
    id: "contrato_flyback",
    nombre: "Beneficio Flyback",
    pdf: {
      nombre: "contratoflyback.pdf",
      ruta: "uploads/terminos-beneficiarios/contratoflyback.pdf",
      url: "/api/contrato-beneficiario/terminos-pdf/contrato_flyback",
    },
  },
  contrato_refund360: {
    id: "contrato_refund360",
    nombre: "Beneficio Refund360",
    pdf: {
      nombre: "contratorefund360.pdf",
      ruta: "uploads/terminos-beneficiarios/contratorefund360.pdf",
      url: "/api/contrato-beneficiario/terminos-pdf/contrato_refund360",
    },
  },
};

console.log("📋 Contratos configurados:", Object.keys(CONTRATOS_CONFIG));

// ============================================
// 📧 CONFIGURACIÓN DE EMAILJS
// ============================================
const EMAILJS_CONFIG = {
  serviceId: "service_kxb9m4s",
  publicKey: "YnTJfg1hrkxkj_umn",
  privateKey: "VlMx2Txj_54mvDOz_xw-f",
  templates: {
    contrato_entradaflex: "template_k63einj",      
    contrato_flyback: "template_o7yj76o",        
    contrato_refund360: "template_fe6d9d7",        
  },
};

// URL del frontend - LOCALHOST
const FRONTEND_URL = "http://localhost:5173";

// ============================================
// 📁 CONFIGURACIÓN DE MULTER
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/contratosbeneficiarios/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "contrato-beneficiario-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos PDF"), false);
    }
  },
});

// ============================================
// 🔧 FUNCIONES AUXILIARES
// ============================================
const generarHashContrato = (contenido) => {
  return crypto.createHash("sha256").update(contenido).digest("hex");
};

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

const formatearFechaEspanol = (fecha) => {
  return new Date(fecha).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const construirDireccionCompleta = (beneficiario) => {
  let direccionCompleta = beneficiario.direccion || "No especificada";
  if (beneficiario.estado_provincia) {
    direccionCompleta += `, ${beneficiario.estado_provincia}`;
  }
  if (beneficiario.pais) {
    direccionCompleta += `, ${beneficiario.pais}`;
  }
  if (beneficiario.cep) {
    direccionCompleta += ` - ${beneficiario.cep}`;
  }
  return direccionCompleta;
};
function generarHashDocumento(contrato) {
 
  
  const contenido = JSON.stringify({
    numero_contrato: contrato.numero_contrato,
    beneficiario: contrato.beneficiario_id,
    tipo_contrato: contrato.tipo_contrato_config,
    monto: contrato.monto,
    fecha_inicio: contrato.fecha_inicio,
    fecha_fin: contrato.fecha_fin,
  });
  
  return crypto
    .createHash('sha256')
    .update(contenido)
    .digest('hex');
}




// ============================================
// 📧 FUNCIÓN DE ENVÍO DE EMAIL CON EMAILJS
// ============================================
async function enviarEmailContratoBeneficiario(
  contrato,
  linkFirma,
  tipoContrato
) {
  console.log("📤 === ENVIANDO EMAIL ===");
  console.log("Tipo contrato:", tipoContrato);
  console.log("Destinatario:", contrato.beneficiario_id.correo);

  try {
    const beneficiario = contrato.beneficiario_id;
    const aliado = contrato.aliado_id;
    const config = CONTRATOS_CONFIG[tipoContrato];

    if (!config) {
      throw new Error(`Tipo de contrato inválido: ${tipoContrato}`);
    }

    if (!beneficiario.correo) {
      throw new Error("El beneficiario no tiene correo electrónico");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(beneficiario.correo)) {
      throw new Error("Formato de email inválido");
    }

    const nombreCompleto = beneficiario.apellido
      ? `${beneficiario.nombre} ${beneficiario.apellido}`
      : beneficiario.nombre;

    const templateParams = {
      to_email: beneficiario.correo,
      to_name: nombreCompleto,
      beneficiario_nombre: nombreCompleto,
      beneficiario_email: beneficiario.correo,
      beneficiario_telefono: beneficiario.telefono || "No especificado",
      beneficiario_direccion: construirDireccionCompleta(beneficiario),
      beneficiario_documento:
        beneficiario.documento_identidad?.numero || "No especificado",
      beneficiario_tipo_documento:
        beneficiario.documento_identidad?.tipo || "No especificado",
      numero_contrato: contrato.numero_contrato,
      fecha_inicio: formatearFechaEspanol(contrato.fecha_inicio),
      fecha_fin: formatearFechaEspanol(contrato.fecha_fin),
      fecha_envio: formatearFechaEspanol(new Date()),
      observaciones: contrato.observaciones || "Sin observaciones adicionales",
      monto_valor: contrato.monto?.valor || "No especificado",
      monto_moneda: contrato.monto?.moneda === "dolares" ? "USD" : "BRL",
      metodo_pago: contrato.metodo_pago?.tipo || "No especificado",
      link_firma: linkFirma,
      empresa: "BNP Capital",
      contacto_empresa: "Equipo BNP Capital",
      email_contacto: "bnpcap.dev@gmail.com",
      aliado_nombre: aliado?.nombre || "BNP Capital",
      aliado_telefono: aliado?.telefono || "N/A",
      tipo_contrato: config.nombre,
      emoji_contrato: config.emoji,
      descripcion_contrato: config.descripcion,
      mensaje_bienvenida: `Estimado/a ${nombreCompleto}, nos complace enviarle el contrato de ${config.nombre}.`,
      mensaje_instrucciones:
        "Por favor, revise el contrato cuidadosamente y proceda con la firma digital.",
      tipo_firma: "Firma Digital",
      valor_legal:
        "La firma digital tiene la misma validez legal que una firma manuscrita",
      validez_enlace: "30 días",
      soporte_email: "bnpcap.dev@gmail.com",
    };

    const templateId = EMAILJS_CONFIG.templates[tipoContrato];
    const emailData = {
      service_id: EMAILJS_CONFIG.serviceId,
      template_id: templateId,
      user_id: EMAILJS_CONFIG.publicKey,
      template_params: templateParams,
      accessToken: EMAILJS_CONFIG.privateKey,
    };

    console.log("📧 Enviando a EmailJS...");
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
      return {
        exito: true,
        mensaje: "Email enviado exitosamente",
        destinatario: beneficiario.correo,
        numero_contrato: contrato.numero_contrato,
        template_usado: templateId,
      };
    } else {
      const errorText = await response.text();
      console.error("❌ Error EmailJS:", response.status, errorText);
      throw new Error(`EmailJS Error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("❌ Error al enviar email:", error);
    throw error;
  }
}

// ============================================
// 🔍 RUTA: Obtener configuración de contratos disponibles
// ============================================
router.get("/config/contratos", (req, res) => {
  try {
    const contratos = Object.entries(CONTRATOS_CONFIG).map(([id, config]) => ({
      id: config.id,
      nombre: config.nombre,
      descripcion: config.descripcion,
      emoji: config.emoji,
      color: config.color,
      gradiente: config.gradiente,
      pdf_disponible: fs.existsSync(
        path.join(process.cwd(), config.pdf.ruta)
      ),
    }));

    res.json({
      success: true,
      contratos,
      total: contratos.length,
    });
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener configuración",
      error: error.message,
    });
  }
});

// ============================================
//  RUTA: Verificar PDF disponible
// ============================================
router.get("/config/contratos/:tipo/verificar-pdf", (req, res) => {
  try {
    const { tipo } = req.params;
    const config = CONTRATOS_CONFIG[tipo];

    if (!config) {
      return res.status(404).json({
        success: false,
        mensaje: "Tipo de contrato no encontrado",
      });
    }

    const pdfPath = path.join(process.cwd(), config.pdf.ruta);
    const existe = fs.existsSync(pdfPath);

    let stats = null;
    if (existe) {
      stats = fs.statSync(pdfPath);
    }

    res.json({
      success: true,
      tipo: tipo,
      nombre: config.nombre,
      pdf: {
        nombre: config.pdf.nombre,
        url: config.pdf.url,
        existe: existe,
        tamano: stats ? `${(stats.size / 1024).toFixed(2)} KB` : null,
      },
    });
  } catch (error) {
    console.error("Error al verificar PDF:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al verificar PDF",
      error: error.message,
    });
  }
});

// ============================================
//  Servir PDFs de términos predefinidos
// ============================================
router.get("/terminos-pdf/:tipo", async (req, res) => {
  try {
    const { tipo } = req.params;
    const config = CONTRATOS_CONFIG[tipo];

    if (!config) {
      return res.status(404).json({
        mensaje: "Tipo de contrato no encontrado",
        tipos_disponibles: Object.keys(CONTRATOS_CONFIG),
      });
    }

    const filePath = path.join(process.cwd(), config.pdf.ruta);

    if (!fs.existsSync(filePath)) {
      console.error(`PDF no encontrado en: ${filePath}`);
      return res.status(404).json({
        mensaje: "Archivo PDF no encontrado",
        ruta_esperada: config.pdf.ruta,
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${config.pdf.nombre}"`
    );
    res.setHeader("Cache-Control", "public, max-age=86400");

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (error) => {
      console.error("Error al leer PDF:", error);
      res.status(500).json({ mensaje: "Error al leer el archivo PDF" });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error al servir PDF:", error);
    res.status(500).json({
      mensaje: "Error al servir PDF",
      error: error.message,
    });
  }
});


// ============================================
// RUTAS DE CONTRATOS (ALIADOS)
// ============================================

// Obtener todos los contratos del aliado
router.get("/", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;

    const contratos = await ContratoBeneficiario.find({ aliado_id })
      .sort({ createdAt: -1 })
      .populate(
        "beneficiario_id",
        "nombre apellido correo telefono nacionalidad"
      )
      .populate("creado_por", "nombre_usuario");

    res.json(contratos);
  } catch (error) {
    console.error("Error al obtener contratos:", error);
    res.status(500).json({
      mensaje: "Error al obtener contratos",
      error: error.message,
    });
  }
});

// Buscar beneficiarios

router.get("/buscar/beneficiarios", checkAuth, isAliado, async (req, res) => {
  try {
    const { q } = req.query;
    const aliado_id = req.aliado._id; // ✅ ID del aliado autenticado

    console.log("🔍 Buscando beneficiarios del aliado:", aliado_id);

    // ✅ Filtro base: SOLO beneficiarios del aliado actual
    const filtroBase = { aliado_id: aliado_id };

    // Si no hay query o es muy corto, devolver los primeros 20 beneficiarios DEL ALIADO
    if (!q || q.length < 1) {
      const beneficiarios = await Beneficiario.find(filtroBase)
        .select(
          "_id nombre apellido correo telefono nacionalidad codigo llave_unica aliado_id membresia vigencia_membresia_anos"
        )
        .populate("aliado_id", "nombre")
        .limit(20);

      console.log(
        `✅ Beneficiarios encontrados (sin query): ${beneficiarios.length} del aliado ${aliado_id}`
      );

      const beneficiariosConCorreo = await procesarBeneficiarios(beneficiarios);

      return res.status(200).json({
        success: true,
        beneficiarios: beneficiariosConCorreo,
      });
    }

    // ✅ Si el query tiene al menos 1 carácter, buscar EN LOS BENEFICIARIOS DEL ALIADO
    const beneficiarios = await Beneficiario.find({
      ...filtroBase, // ✅ Siempre incluye filtro de aliado
      $or: [
        { nombre: { $regex: q, $options: "i" } },
        { apellido: { $regex: q, $options: "i" } },
        { correo: { $regex: q, $options: "i" } },
        { "codigo.value": { $regex: q, $options: "i" } },
        { llave_unica: { $regex: q, $options: "i" } },
      ],
    })
      .select(
        "_id nombre apellido correo telefono nacionalidad codigo llave_unica aliado_id membresia vigencia_membresia_anos"
      )
      .populate("aliado_id", "nombre")
      .limit(50);

    console.log(
      `✅ Beneficiarios encontrados (con query '${q}'): ${beneficiarios.length} del aliado ${aliado_id}`
    );

    const beneficiariosConCorreo = await procesarBeneficiarios(beneficiarios);

    res.status(200).json({
      success: true,
      beneficiarios: beneficiariosConCorreo,
    });
  } catch (error) {
    console.error("❌ Error al buscar beneficiarios:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar beneficiarios",
      error: error.message,
    });
  }
});
console.log ("beneficiarios cargados");

async function procesarBeneficiarios(beneficiarios) {
  return await Promise.all(
    beneficiarios.map(async (beneficiario) => {
      const beneficiarioObj = beneficiario.toObject();

      // Si ya tiene correo directo, lo usamos
      if (beneficiarioObj.correo) {
        return beneficiarioObj;
      }

      // Si tiene usuario_id con correo, buscamos el usuario
      if (beneficiarioObj.usuario_id) {
        try {
          const usuario = await Usuario.findById(beneficiarioObj.usuario_id);
          if (usuario && usuario.correo) {
            beneficiarioObj.correo = usuario.correo;
          }
        } catch (error) {
          console.error("Error al buscar correo de usuario:", error);
        }
      }

      return beneficiarioObj;
    })
  );
}
router.get("/:id/versiones", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    const contrato = await ContratoBeneficiario.findOne({
      _id: id,
      aliado_id,
    }).select("numero_contrato versiones_documento validez_legal");

    if (!contrato) {
      return res.status(404).json({
        success: false,
        mensaje: "Contrato no encontrado",
      });
    }

    const versiones = contrato.versiones_documento || [];

    res.json({
      success: true,
      numero_contrato: contrato.numero_contrato,
      total_versiones: versiones.length,
      version_actual: versiones.length > 0 ? versiones[versiones.length - 1].version_numero : 0,
      versiones: versiones.map((v) => ({
        version_numero: v.version_numero,
        fecha_creacion: v.fecha_creacion,
        archivo: {
          nombre: v.archivo.nombre,
          tamano: v.archivo.tamano,
          hash_sha256: v.archivo.hash_sha256,
        },
        validez_legal_brasil: {
          ip_origen: v.validez_legal_brasil.ip_origen,
          timestamp_upload: v.validez_legal_brasil.timestamp_upload,
          pais_jurisdiccion: v.validez_legal_brasil.pais_jurisdiccion,
          cumple_lgpd: v.validez_legal_brasil.cumple_lgpd,
        },
        metadata: {
          tipo_operacion: v.metadata.tipo_operacion,
          motivo: v.metadata.motivo,
        },
      })),
    });
  } catch (error) {
    console.error("Error al obtener versiones:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener versiones del contrato",
      error: error.message,
    });
  }
});

// Verificar beneficiario
router.post(
  "/verificar-beneficiario",
  checkAuth,
  isAliado,
  async (req, res) => {
    try {
      const { beneficiario_id } = req.body;
      const aliado_id = req.aliado._id;

      if (!beneficiario_id) {
        return res.status(400).json({
          success: false,
          mensaje: "ID de beneficiario requerido",
        });
      }

      const beneficiario = await Beneficiario.findById(beneficiario_id).select(
        "nombre apellido correo telefono"
      );

      if (!beneficiario) {
        return res.status(404).json({
          success: false,
          mensaje: "Beneficiario no encontrado",
        });
      }

      const contratoActivo = await ContratoBeneficiario.findOne({
        aliado_id: aliado_id,
        beneficiario_id: beneficiario_id,
        estado: { $in: ["borrador", "enviado", "firmado"] },
      });

      const totalContratos = await ContratoBeneficiario.countDocuments({
        aliado_id: aliado_id,
        beneficiario_id: beneficiario_id,
      });

      res.json({
        success: true,
        beneficiario: {
          _id: beneficiario._id,
          nombre: beneficiario.nombre,
          apellido: beneficiario.apellido,
          correo: beneficiario.correo,
          telefono: beneficiario.telefono,
        },
        tiene_contrato_activo: !!contratoActivo,
        total_contratos_historicos: totalContratos,
        contrato_activo: contratoActivo
          ? {
              numero_contrato: contratoActivo.numero_contrato,
              estado: contratoActivo.estado,
              fecha_creacion: contratoActivo.createdAt,
            }
          : null,
        puede_crear_contrato: true,
        mensaje: contratoActivo
          ? `Beneficiario tiene un contrato ${contratoActivo.estado}. Se puede crear uno nuevo.`
          : totalContratos > 0
            ? `Beneficiario disponible (${totalContratos} contratos históricos)`
            : "Beneficiario disponible para primer contrato",
      });
    } catch (error) {
      console.error("Error al verificar beneficiario:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error al verificar beneficiario",
        error: error.message,
      });
    }
  }
);

// Crear nuevo contrato
router.post("/", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;
    const {
      beneficiario_id,
      monto,
      metodo_pago,
      fecha_inicio,
      fecha_fin,
      observaciones,
      tipo_contrato, // Nuevo: tipo de contrato (contrato_entradaflex, etc.)
    } = req.body;

    // Validar tipo de contrato
    if (!tipo_contrato || !CONTRATOS_CONFIG[tipo_contrato]) {
      return res.status(400).json({
        mensaje: "Tipo de contrato inválido o no especificado",
        tipos_disponibles: Object.keys(CONTRATOS_CONFIG),
      });
    }

    const config = CONTRATOS_CONFIG[tipo_contrato];

    // Validaciones básicas
    if (
      !beneficiario_id ||
      !monto ||
      !monto.valor ||
      !fecha_inicio ||
      !fecha_fin
    ) {
      return res.status(400).json({
        mensaje: "Todos los campos requeridos deben estar completos",
      });
    }

    // Verificar beneficiario
    const beneficiario = await Beneficiario.findById(beneficiario_id);
    if (!beneficiario) {
      return res.status(404).json({
        mensaje: "Beneficiario no encontrado",
      });
    }

    // Crear contrato SIN términos en texto
    const nuevoContrato = new ContratoBeneficiario({
      aliado_id,
      beneficiario_id,
      monto,
      metodo_pago: metodo_pago || { tipo: "Efectivo" },
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: new Date(fecha_fin),
      observaciones,
      tipo_contrato: tipo_contrato, // Guardar tipo
      tipo_contrato_config: {
        nombre: config.nombre,
        descripcion: config.descripcion,
        emoji: config.emoji,
        color: config.color,
      },
      pdf_terminos: {
        // Referencia al PDF predefinido
        nombre: config.pdf.nombre,
        url: config.pdf.url,
        ruta: config.pdf.ruta,
      },
      template_emailjs: config.template_emailjs,
      creado_por: req.usuario._id,
      historial: [
        {
          accion: "CREACION",
          fecha: new Date(),
          usuario_id: req.usuario._id,
          detalles: `Contrato ${config.nombre} creado con beneficiario ${beneficiario.nombre} ${beneficiario.apellido}`,
        },
      ],
    });

    const contratoGuardado = await nuevoContrato.save();

    await contratoGuardado.populate([
      { path: "beneficiario_id", select: "nombre apellido correo telefono" },
    ]);
    

await registrarContratoBeneficiarioCreado({
  contrato_id: contratoGuardado._id,
  beneficiario_id: beneficiario._id,
  beneficiario_nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
  beneficiario_codigo: beneficiario.codigo || beneficiario.llave_unica,
  aliado_id: req.aliado._id,
  aliado_nombre: req.aliado.nombre,
  numero_contrato: contratoGuardado.numero_contrato,
  tipo_contrato: tipo_contrato,
  fecha_inicio: contratoGuardado.fecha_inicio,
  fecha_fin: contratoGuardado.fecha_fin,
  estado: contratoGuardado.estado,
  monto: contratoGuardado.monto,
  metodo_pago: contratoGuardado.metodo_pago,
}, req);

    res.status(201).json({
      mensaje: `Contrato ${config.nombre} creado exitosamente`,
      contrato: contratoGuardado,
      tipo_contrato: {
        nombre: config.nombre,
        descripcion: config.descripcion,
        emoji: config.emoji,
      },
    });
  } catch (error) {
    console.error("Error al crear contrato:", error);
    res.status(500).json({
      mensaje: "Error al crear contrato",
      error: error.message,
    });
  }
});
router.post("/subir-manual", checkAuth, isAliado, upload.single("contrato"), async (req, res) => {
  try {
    const aliado_id = req.aliado._id;
    const {
      beneficiario_id,
      tipo_contrato,
      monto,
      metodo_pago,
      fecha_inicio,
      fecha_fin,
      observaciones,
    } = req.body;

    console.log("📤 === SUBIENDO CONTRATO MANUAL ===");
    console.log("Aliado ID:", aliado_id);
    console.log("Beneficiario ID:", beneficiario_id);
    console.log("Tipo contrato:", tipo_contrato);

    // Validar tipo de contrato
    if (!tipo_contrato || !CONTRATOS_CONFIG[tipo_contrato]) {
      return res.status(400).json({
        success: false,
        mensaje: "Tipo de contrato inválido o no especificado",
        tipos_disponibles: Object.keys(CONTRATOS_CONFIG),
      });
    }

    const config = CONTRATOS_CONFIG[tipo_contrato];

    // Validar campos requeridos
    if (!beneficiario_id || !fecha_inicio || !fecha_fin || !req.file) {
      return res.status(400).json({
        success: false,
        mensaje: "Faltan campos requeridos: beneficiario, fechas o archivo PDF",
      });
    }

    // Verificar beneficiario
    const beneficiario = await Beneficiario.findById(beneficiario_id);
    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: "Beneficiario no encontrado",
      });
    }

    // Parsear monto y método de pago
    const montoParsed = typeof monto === "string" ? JSON.parse(monto) : monto;
    const metodoPagoParsed = typeof metodo_pago === "string" ? JSON.parse(metodo_pago) : metodo_pago;

    // Obtener IP del aliado
    const clientIP = obtenerIPReal(req);
    console.log("📍 IP del aliado:", clientIP);

    // Generar hash del archivo PDF
    const hashArchivo = generarHashArchivo(req.file.path);
    console.log("🔐 Hash SHA-256 generado:", hashArchivo);

    // Información del archivo
    const archivoInfo = {
      nombre: req.file.filename,
      url: `/uploads/contratosbeneficiarios/${req.file.filename}`,
      ruta: req.file.path,
      tamano: req.file.size,
      hash: hashArchivo,
    };

    // Crear VERSIÓN 1 con certificado LGPD
    const { generarHashArchivo: genHash, crearVersionDocumento } = await import("../utils/documentVersioningUtils.js");
    
    const primeraVersion = crearVersionDocumento(
      archivoInfo,
      req.usuario._id,
      clientIP,
      "Carga inicial del contrato firmado manualmente"
    );

    console.log("✅ Versión 1 creada con certificado LGPD Brasil");

    // Crear contrato manual
    const nuevoContrato = new ContratoBeneficiario({
      aliado_id,
      beneficiario_id,
      tipo_contrato: tipo_contrato,
      tipo_contrato_config: {
        nombre: config.nombre,
        descripcion: config.descripcion,
        emoji: config.emoji,
        color: config.color,
      },
      pdf_terminos: {
        nombre: config.pdf.nombre,
        url: config.pdf.url,
        ruta: config.pdf.ruta,
      },
      monto: montoParsed,
      metodo_pago: metodoPagoParsed,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: new Date(fecha_fin),
      observaciones: observaciones || "",
      estado: "firmado",
      fecha_firma: new Date(),
      contrato_firmado: {
        nombre: req.file.filename,
        url: `/uploads/contratosbeneficiarios/${req.file.filename}`,
        ruta: req.file.path,
        hash: hashArchivo,
        tamano: req.file.size,
        fecha_subida: new Date(),
      },
      validez_legal: {
        hash_documento: hashArchivo,
        timestamp: new Date(),
        ip_firma: clientIP,
        user_agent: req.get("User-Agent") || "Upload manual",
        verificado: true,
        es_contrato_manual: true,
        version_actual: 1,
      },
      versiones_documento: [primeraVersion],
      historial: [
        {
          accion: "CREACION",
          fecha: new Date(),
          usuario_id: req.usuario._id,
          detalles: `Contrato manual ${config.nombre} creado y firmado`,
        },
        {
          accion: "FIRMA",
          fecha: new Date(),
          usuario_id: req.usuario._id,
          detalles: `Contrato firmado manualmente y subido por aliado desde IP: ${clientIP}`,
        },
      ],
      creado_por: req.usuario._id,
    });

    const contratoGuardado = await nuevoContrato.save();
    console.log("✅ Contrato manual guardado:", contratoGuardado.numero_contrato);

await registrarContratoBeneficiarioManual({
  contrato_id: contratoGuardado._id,
  beneficiario_id: beneficiario._id,
  beneficiario_nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
  beneficiario_codigo: beneficiario.codigo || beneficiario.llave_unica,
  aliado_id: req.aliado._id,
  aliado_nombre: req.aliado.nombre,
  numero_contrato: contratoGuardado.numero_contrato,
  tipo_contrato: tipo_contrato,
  fecha_inicio,
  fecha_fin,
  monto: montoParsed,
  archivo_nombre: req.file.filename,
  archivo_tamano: req.file.size,
}, req);
    // Activar beneficiario
    try {
      const estadoActivo = await Estado.findOne({ 
        codigo: 'BENE_ACTIVO',
        tipo: 'BENEFICIARIO'
      });
      
      if (estadoActivo) {
        const actualizacion = {
          estado_id: estadoActivo._id,
          verificado: true,
          fecha_activacion: new Date(),
          aliado_id: aliado_id,
        };

        if (!beneficiario.servicios.includes(tipo_contrato)) {
          actualizacion.$addToSet = { servicios: tipo_contrato };
        }

        const contratoActivo = {
          contrato_id: contratoGuardado._id,
          numero_contrato: contratoGuardado.numero_contrato,
          tipo_contrato: tipo_contrato,
          fecha_firma: new Date(),
          estado: 'firmado'
        };

        if (!actualizacion.$push) {
          actualizacion.$push = {};
        }
        actualizacion.$push.contratos_activos = contratoActivo;

        await Beneficiario.findByIdAndUpdate(beneficiario_id, actualizacion);
        console.log("✅ Beneficiario activado con servicio:", tipo_contrato);
      }
    } catch (errorActivacion) {
      console.error("❌ Error al activar beneficiario:", errorActivacion);
    }

    res.status(201).json({
      success: true,
      mensaje: `Contrato manual ${config.nombre} subido exitosamente`,
      numero_contrato: contratoGuardado.numero_contrato,
      tipo_contrato: {
        id: tipo_contrato,
        nombre: config.nombre,
        emoji: config.emoji,
      },
      estado: "firmado",
      validez_legal: {
        hash_sha256: hashArchivo,
        certificado_lgpd: true,
        version_inicial: 1,
        ip_subida: clientIP,
      },
      contrato: {
        _id: contratoGuardado._id,
        numero_contrato: contratoGuardado.numero_contrato,
        beneficiario: {
          nombre: beneficiario.nombre,
          apellido: beneficiario.apellido,
          correo: beneficiario.correo,
        },
        monto: contratoGuardado.monto,
        fecha_inicio: contratoGuardado.fecha_inicio,
        fecha_fin: contratoGuardado.fecha_fin,
        estado: contratoGuardado.estado,
      },
    });
  } catch (error) {
    console.error("❌ Error al subir contrato manual:", error);
    
    // Eliminar archivo si hubo error
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log("🗑️ Archivo eliminado tras error");
        }
      } catch (unlinkError) {
        console.error("Error al eliminar archivo:", unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      mensaje: "Error al subir contrato manual",
      error: error.message,
    });
  }
});

console.log("/subir-manual actualizadp ");




// Enviar contrato
router.post("/:id/enviar", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    const contrato = await ContratoBeneficiario.findOne({
      _id: id,
      aliado_id,
    })
      .populate(
        "beneficiario_id",
        "nombre apellido correo telefono nacionalidad direccion estado_provincia pais cep documento_identidad"
      )
      .populate("aliado_id", "nombre correo telefono direccion");

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    if (contrato.estado !== "borrador") {
      return res.status(400).json({
        mensaje: "Solo se pueden enviar contratos en estado borrador",
      });
    }

    if (!contrato.beneficiario_id.correo) {
      return res.status(400).json({
        mensaje:
          "El beneficiario no tiene una dirección de correo electrónico registrada",
      });
    }

    // Generar token y actualizar contrato
    const tokenFirma = uuidv4();
    contrato.estado = "enviado";
    contrato.fecha_envio = new Date();
    contrato.token_firma = tokenFirma;

    contrato.historial.push({
      accion: "ENVIO",
      fecha: new Date(),
      usuario_id: req.usuario._id,
      detalles: `Contrato enviado para firma`,
    });

    await contrato.save();

    // Generar link de firma - LOCALHOST
    const linkFirma = `http://localhost:5173/firmar-contrato-beneficiario/${tokenFirma}`;

    console.log("📤 Enviando contrato...");
    console.log("Tipo:", contrato.tipo_contrato);
    console.log("Link:", linkFirma);

    try {
      await enviarEmailContratoBeneficiario(
        contrato,
        linkFirma,
        contrato.tipo_contrato
      );

      contrato.email_enviado = true;
      contrato.historial.push({
        accion: "EMAIL_ENVIADO",
        fecha: new Date(),
        usuario_id: req.usuario._id,
        detalles: `Email enviado exitosamente a ${contrato.beneficiario_id.correo}`,
      });
      await contrato.save();

       await registrarContratoBeneficiarioEnviado({
    contrato_id: contrato._id,
    numero_contrato: contrato.numero_contrato,
    beneficiario_id: contrato.beneficiario_id._id,
    beneficiario_nombre: `${contrato.beneficiario_id.nombre} ${contrato.beneficiario_id.apellido || ''}`.trim(),
    beneficiario_codigo: contrato.beneficiario_id.codigo || contrato.beneficiario_id.llave_unica,
    beneficiario_email: contrato.beneficiario_id.correo,
    aliado_id: contrato.aliado_id._id,
    aliado_nombre: contrato.aliado_id.nombre,
    tipo_contrato: contrato.tipo_contrato,
    fecha_envio: contrato.fecha_envio,
    token_firma: contrato.token_firma,
    link_firma: linkFirma,
  }, req);

      res.json({
        mensaje: "Contrato enviado exitosamente",
        numero_contrato: contrato.numero_contrato,
        email_enviado_a: contrato.beneficiario_id.correo,
        fecha_envio: contrato.fecha_envio,
        link_firma: linkFirma,
      });
    } catch (emailError) {
      console.error("❌ Error al enviar email:", emailError);

      // Revertir cambios
      contrato.estado = "borrador";
      contrato.fecha_envio = null;
      contrato.token_firma = null;
      contrato.email_enviado = false;
      await contrato.save();


      return res.status(500).json({
        mensaje: "Error al enviar el email",
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error("Error al enviar contrato:", error);
    res.status(500).json({
      mensaje: "Error al enviar contrato",
      error: error.message,
    });
  }
});

// Eliminar contrato
router.delete("/:id", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    const contrato = await ContratoBeneficiario.findOne({
      _id: id,
      aliado_id,
    });

    if (!contrato) {
      return res.status(404).json({
        success: false,
        mensaje: "Contrato no encontrado",
      });
    }

    // Eliminar archivo si existe
    if (contrato.contrato_firmado?.ruta) {
      try {
        if (fs.existsSync(contrato.contrato_firmado.ruta)) {
          fs.unlinkSync(contrato.contrato_firmado.ruta);
        }
      } catch (err) {
        console.error("Error al eliminar archivo:", err);
      }
    }

    await ContratoBeneficiario.findByIdAndDelete(id);

    res.json({
      success: true,
      mensaje: "Contrato eliminado exitosamente",
      numero_contrato: contrato.numero_contrato,
    });
  } catch (error) {
    console.error("Error al eliminar contrato:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al eliminar contrato",
      error: error.message,
    });
  }
});

// Ver contrato
router.get("/:id", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    const contrato = await ContratoBeneficiario.findOne({
      _id: id,
      aliado_id,
    })
      .populate(
        "beneficiario_id",
        "nombre apellido correo telefono nacionalidad direccion"
      )
      .populate("creado_por", "nombre_usuario");

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    res.json(contrato);
  } catch (error) {
    console.error("Error al obtener contrato:", error);
    res.status(500).json({
      mensaje: "Error al obtener contrato",
      error: error.message,
    });
  }
});
router.get("/:id/verificar", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    const contrato = await ContratoBeneficiario.findOne({
      _id: id,
      aliado_id,
    }).populate("beneficiario_id", "nombre apellido correo llave_unica");

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    const esContratoManual = contrato.validez_legal?.es_contrato_manual || false;
    let integridadVerificada = false;

    if (esContratoManual) {
      integridadVerificada = !!(
        contrato.contrato_firmado && contrato.contrato_firmado.url
      );
    } else if (
      contrato.validez_legal?.hash_documento
    ) {
      const hashActual = generarHashDocumento(contrato);
      integridadVerificada = hashActual === contrato.validez_legal.hash_documento;
    }

    const esValido =
      contrato.estado === "firmado" &&
      contrato.validez_legal?.verificado &&
      integridadVerificada;

    // ✅ AGREGAR INFO DE VERSIONES:
    const versiones = contrato.versiones_documento || [];
    const totalVersiones = versiones.length;
    const versionActual = contrato.validez_legal?.version_actual || 
                         (totalVersiones > 0 ? versiones[versiones.length - 1].version_numero : 1);

    const verificacion = {
      valido: esValido,
      hash: contrato.validez_legal?.hash_documento || "No disponible",
      timestamp: contrato.validez_legal?.timestamp || contrato.fecha_firma,
      ip_firma: contrato.validez_legal?.ip_firma || "No disponible",
      user_agent: contrato.validez_legal?.user_agent || "No disponible",
      integridad_verificada: integridadVerificada,
      es_contrato_manual: esContratoManual,
      beneficiario: contrato.beneficiario_id
        ? {
            nombre: contrato.beneficiario_id.nombre,
            apellido: contrato.beneficiario_id.apellido,
            correo: contrato.beneficiario_id.correo,
            llave_unica: contrato.beneficiario_id.llave_unica,
          }
        : null,
      numero_contrato: contrato.numero_contrato,
      estado_contrato: contrato.estado,
      fecha_verificacion: new Date(),
      // ✅ NUEVO:
      total_versiones: totalVersiones,
      version_actual: versionActual,
        tipo_contrato_config: contrato.tipo_contrato_config || null,
    };

    res.json({
      verificacion,
      total_versiones: totalVersiones,
      version_actual: versionActual,
    });
  } catch (error) {
    console.error("Error en verificación:", error);
    res.status(500).json({
      mensaje: "Error al verificar contrato",
      error: error.message,
    });
  }
});

// ============================================
// 📄 RUTAS PÚBLICAS PARA FIRMA
// ============================================

// Obtener contrato para firma
router.get("/firmar/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log("🔍 === BUSCANDO CONTRATO PARA FIRMA ===");
    console.log("Token recibido:", token);

    // Validar que el token tiene formato válido
    if (!token || token.length < 10) {
      console.log("❌ Token inválido - muy corto");
      return res.status(400).json({
        mensaje: "Token de contrato inválido",
      });
    }

    // Buscar contrato sin populate primero
    console.log("Buscando contrato en BD...");
    const contratoBasico = await ContratoBeneficiario.findOne({ 
      token_firma: token 
    });

    if (!contratoBasico) {
      console.log("❌ Contrato no encontrado con token:", token);
      return res.status(404).json({
        mensaje: "Token de contrato inválido o expirado",
      });
    }

    console.log("✅ Contrato encontrado:", contratoBasico.numero_contrato);
    console.log("   Estado actual:", contratoBasico.estado);
    console.log("   Beneficiario ID:", contratoBasico.beneficiario_id);
    console.log("   Aliado ID:", contratoBasico.aliado_id);

    // Verificar estado
    if (contratoBasico.estado !== "enviado") {
      console.log("⚠️ Contrato no está en estado 'enviado'");
      return res.status(400).json({
        mensaje: `Este contrato no está disponible para firma. Estado actual: ${contratoBasico.estado}`,
        estado_actual: contratoBasico.estado,
      });
    }

    // Intentar populate con manejo de errores
    console.log("Cargando datos relacionados...");
    let contrato;
    try {
      contrato = await ContratoBeneficiario.findOne({ 
        token_firma: token 
      })
        .populate("beneficiario_id", "nombre apellido correo telefono")
        .populate("aliado_id", "nombre correo telefono");

      console.log("✅ Datos relacionados cargados");
    } catch (populateError) {
      console.error("❌ Error en populate:", populateError);
      // Si falla el populate, usar el contrato básico
      contrato = contratoBasico;
    }

    // Construir respuesta segura
    const respuesta = {
      contrato: {
        _id: contrato._id,
        numero_contrato: contrato.numero_contrato,
        beneficiario: contrato.beneficiario_id || {
          nombre: "Beneficiario",
          apellido: "",
          correo: "no-disponible@email.com",
          telefono: "N/A"
        },
        aliado: contrato.aliado_id || {
          nombre: "BNP Capital",
          correo: "bnpcap.dev@gmail.com",
          telefono: "N/A"
        },
        monto: contrato.monto || { valor: 0, moneda: "USD" },
        fecha_inicio: contrato.fecha_inicio,
        fecha_fin: contrato.fecha_fin,
        observaciones: contrato.observaciones || "",
        estado: contrato.estado,
        tipo_contrato: contrato.tipo_contrato,
        tipo_contrato_config: contrato.tipo_contrato_config || {
          nombre: "Contrato de Beneficios",
          descripcion: "Contrato de servicios BNP Capital",
          emoji: "📋"
        },
        pdf_terminos: contrato.pdf_terminos || {
          nombre: "contrato.pdf",
          url: "/api/contrato-beneficiario/terminos-pdf/" + (contrato.tipo_contrato || "contrato_entradaflex")
        },
      },
    };

    console.log("✅ Enviando respuesta exitosa");
    console.log("   Número contrato:", respuesta.contrato.numero_contrato);
    console.log("   Beneficiario:", respuesta.contrato.beneficiario.nombre);
    
    res.json(respuesta);

  } catch (error) {
    console.error("❌ === ERROR AL OBTENER CONTRATO PARA FIRMA ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    
    res.status(500).json({
      mensaje: "Error al obtener contrato",
      error: error.message,
      detalles: "Por favor contacte al administrador si el problema persiste"
    });
  }
});

console.log(" Ruta firmar actualizada ");

// Confirmar firma

router.post("/firmar/:token/confirmar", async (req, res) => {
  try {
    const { token } = req.params;
    const { fecha_firma, tipo_firma, user_agent, timestamp } = req.body;

    console.log('🔐 Confirmando firma digital con token:', token);

    // 1. Buscar el contrato por token
    const contrato = await ContratoBeneficiario.findOne({ 
      token_firma: token 
    }).populate('beneficiario_id aliado_id');

    if (!contrato) {
      console.log('❌ Token de contrato inválido');
      return res.status(404).json({
        mensaje: "Token de contrato inválido o expirado",
      });
    }

    // 2. Validar que el contrato puede ser firmado
    if (contrato.estado !== "enviado") {
      console.log('❌ Contrato no puede ser firmado, estado actual:', contrato.estado);
      return res.status(400).json({
        mensaje: "Este contrato no puede ser firmado en su estado actual",
        estado_actual: contrato.estado,
      });
    }

    // 3. Obtener IP del cliente
    const clientIP = obtenerIPReal(req);
    console.log('📍 IP del cliente:', clientIP);

    // 4. Actualizar el contrato
    contrato.estado = "firmado";
    contrato.fecha_firma = fecha_firma || new Date();
    
    // Actualizar validez legal
    contrato.validez_legal = {
      ...contrato.validez_legal,
      hash_documento: generarHashDocumento(contrato),
      timestamp: new Date(),
      ip_firma: clientIP,
      user_agent: user_agent,
      verificado: true,
    };

    // Agregar al historial
    contrato.historial.push({
      accion: "FIRMA",
      fecha: new Date(),
      detalles: `Contrato firmado digitalmente por el beneficiario desde IP: ${clientIP}`,
    });

    await contrato.save();
    console.log('✅ Contrato firmado:', contrato.numero_contrato);
    const reqSimulado = {
  ip: clientIP,
  get: (header) => {
    if (header === 'user-agent' || header === 'User-Agent') {
      return user_agent;
    }
    return null;
  },
  method: 'POST',
  originalUrl: `/api/contrato-beneficiario/firmar/${token}/confirmar`,
  usuario: null
};
await registrarContratoBeneficiarioFirmado({
  contrato_id: contrato._id,
  numero_contrato: contrato.numero_contrato,
  beneficiario_id: contrato.beneficiario_id._id,
  beneficiario_nombre: `${contrato.beneficiario_id.nombre} ${contrato.beneficiario_id.apellido || ''}`.trim(),
  beneficiario_codigo: contrato.beneficiario_id.codigo || contrato.beneficiario_id.llave_unica,
  aliado_id: contrato.aliado_id._id,
  aliado_nombre: contrato.aliado_id.nombre,
  tipo_contrato: contrato.tipo_contrato,
  fecha_firma: contrato.fecha_firma,
  ip_firma: clientIP,
  hash_documento: contrato.validez_legal.hash_documento,
  user_agent: user_agent,
}, reqSimulado);

    if (contrato.beneficiario_id && contrato.aliado_id) {
      try {
        const estadoActivo = await Estado.findOne({ 
          codigo: 'BENE_ACTIVO',
          tipo: 'BENEFICIARIO'
        });
        
        if (estadoActivo) {
          console.log('✅ Estado Activo encontrado:', estadoActivo._id);
          
          // Obtener beneficiario actual
          const beneficiarioActual = await Beneficiario.findById(contrato.beneficiario_id._id);
          
          if (beneficiarioActual) {
            // Preparar actualización
            const actualizacion = {
              estado_id: estadoActivo._id,
              verificado: true,
              fecha_activacion: new Date(),
              aliado_id: contrato.aliado_id._id, // ✅ CRÍTICO: Asignar aliado
            };

            // Agregar servicio si no existe
            const tipoContrato = contrato.tipo_contrato;
            if (tipoContrato && !beneficiarioActual.servicios.includes(tipoContrato)) {
              actualizacion.$addToSet = { servicios: tipoContrato };
            }

            // Agregar contrato activo
            const contratoActivo = {
              contrato_id: contrato._id,
              numero_contrato: contrato.numero_contrato,
              tipo_contrato: tipoContrato,
              fecha_firma: new Date(),
              estado: 'firmado'
            };

            if (!actualizacion.$push) {
              actualizacion.$push = {};
            }
            actualizacion.$push.contratos_activos = contratoActivo;

            // Actualizar beneficiario
            const beneficiarioActualizado = await Beneficiario.findByIdAndUpdate(
              contrato.beneficiario_id._id,
              actualizacion,
              { new: true }
            );
            
            if (beneficiarioActualizado) {
              console.log('✅ Beneficiario activado exitosamente');
              console.log(`   ID: ${beneficiarioActualizado._id}`);
              console.log(`   Nombre: ${beneficiarioActualizado.nombre} ${beneficiarioActualizado.apellido}`);
              console.log(`   Estado: ${estadoActivo.nombre} (${estadoActivo.codigo})`);
              console.log(`   Verificado: ${beneficiarioActualizado.verificado}`);
              console.log(`   Aliado ID: ${beneficiarioActualizado.aliado_id}`);
              console.log(`   Servicios: [${beneficiarioActualizado.servicios.join(', ')}]`);
              console.log(`   Contratos activos: ${beneficiarioActualizado.contratos_activos?.length || 0}`);
            }
          }
        } else {
          console.error('❌ Estado BENE_ACTIVO no encontrado');
        }
      } catch (errorActivacion) {
        console.error('❌ Error al activar beneficiario:', errorActivacion);
      }
    }

    // ============================================
    // 6. REGISTRAR EN BITÁCORA
    // ============================================
    try {
      // Si tienes el middleware de bitácora
      if (typeof registrarActividadBitacora === 'function') {
        await registrarActividadBitacora({
          tipo_actividad: 'CONTRATO_FIRMADO_BENEFICIARIO',
          descripcion: `Contrato ${contrato.numero_contrato} firmado digitalmente`,
          usuario_id: contrato.beneficiario_id._id,
          entidad_afectada: 'ContratoBeneficiario',
          id_entidad_afectada: contrato._id,
          detalles: {
            numero_contrato: contrato.numero_contrato,
            beneficiario: `${contrato.beneficiario_id.nombre} ${contrato.beneficiario_id.apellido}`,
            fecha_firma: fecha_firma,
            ip_firma: clientIP,
            tipo_firma: tipo_firma,
          },
          ip_address: clientIP,
          user_agent: user_agent,
        });
        console.log('✅ Registrado en bitácora');
      }
    } catch (errorBitacora) {
      console.error('⚠️ Error al registrar en bitácora:', errorBitacora);
      // No detener el flujo
    }

    // ============================================
    // 7. ENVIAR EMAIL DE CONFIRMACIÓN (Opcional)
    // ============================================
    try {
      // Si tienes servicio de email configurado
      if (typeof enviarEmailConfirmacionFirma === 'function') {
        await enviarEmailConfirmacionFirma({
          beneficiario: contrato.beneficiario_id,
          contrato: contrato,
          aliado: contrato.aliado_id,
        });
        console.log('✅ Email de confirmación enviado');
      }
    } catch (errorEmail) {
      console.error('⚠️ Error al enviar email:', errorEmail);
      // No detener el flujo
    }

    // 8. Responder con éxito
    console.log('✅ Proceso de firma completado exitosamente');
    res.json({
      mensaje: "Contrato firmado exitosamente",
      contrato: {
        _id: contrato._id,
        numero_contrato: contrato.numero_contrato,
        estado: contrato.estado,
        fecha_firma: contrato.fecha_firma,
        beneficiario_activado: true,
      },
      success: true
    });

  } catch (error) {
    console.error("❌ Error al confirmar firma:", error);
    res.status(500).json({
      mensaje: "Error al confirmar la firma",
      error: error.message,
      success: false
    });
  }
});
// Rechazar contrato
router.post("/firmar/:token/rechazar", async (req, res) => {
  try {
    const { token } = req.params;
    const contrato = await ContratoBeneficiario.findOne({ token_firma: token });
    const { motivo_rechazo } = req.body;

    if (!contrato) {
      return res.status(404).json({
        mensaje: "Token de contrato inválido o expirado",
      });
    }

    if (contrato.estado !== "enviado") {
      return res.status(400).json({
        mensaje: "Este contrato no puede ser rechazado en su estado actual",
        estado_actual: contrato.estado,
      });
    }

    contrato.estado = "rechazado";
    contrato.fecha_rechazo = new Date();

    contrato.historial.push({
      accion: "RECHAZO",
      fecha: new Date(),
      detalles: "Contrato rechazado por el beneficiario",
    });

    await contrato.save();
    const clientIP = obtenerIPReal(req);
    const reqSimulado = {
  ip: clientIP,
  get: (header) => {
    if (header === 'user-agent' || header === 'User-Agent') {
      return req.get('user-agent');
    }
    return null;
  },
  method: 'POST',
  originalUrl: `/api/contrato-beneficiario/firmar/${token}/rechazar`,
  usuario: null
};

await registrarContratoBeneficiarioRechazado({
  contrato_id: contrato._id,
  numero_contrato: contrato.numero_contrato,
  beneficiario_id: contrato.beneficiario_id._id,
  beneficiario_nombre: `${contrato.beneficiario_id.nombre} ${contrato.beneficiario_id.apellido || ''}`.trim(),
  beneficiario_codigo: contrato.beneficiario_id.codigo || contrato.beneficiario_id.llave_unica,
  aliado_id: contrato.aliado_id?._id,
  aliado_nombre: contrato.aliado_id?.nombre || 'N/A',
  tipo_contrato: contrato.tipo_contrato,
  fecha_rechazo: contrato.fecha_rechazo,
  motivo_rechazo: motivo_rechazo,
}, reqSimulado);

    res.json({
      mensaje: "Contrato rechazado exitosamente",
      numero_contrato: contrato.numero_contrato,
      estado: "rechazado",
      fecha_rechazo: contrato.fecha_rechazo,
    });
  } catch (error) {
    console.error("Error al rechazar contrato:", error);
    res.status(500).json({
      mensaje: "Error al rechazar contrato",
      error: error.message,
    });
  }
});

console.log("✅ === contratoBeneficiarioRoutes.js ACTUALIZADO ===");

export default router;