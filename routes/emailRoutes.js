import express from "express";
import fetch from "node-fetch";
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

console.log("📧 === INICIANDO emailRoutes.js ===");

// Configuración de EmailJS con los Template IDs correctos
const emailJSConfig = {
  serviceId: "service_kxb9m4s",
  publicKey: "YnTJfg1hrkxkj_umn",
  privateKey: "VlMx2Txj_54mvDOz_xw-f",

  // 3 Templates con nombres de servicios actualizados
  templates: {
    tipo_a: {
      id: "template_6yj09vs", // Colaboración EntradaFlex
      nombre: "Colaboración EntradaFlex",
      descripcion: "Contrato de colaboración para servicio EntradaFlex",
      icon: "🎫",
      color: "#10b981",
    },
    tipo_b: {
      id: "template_o9cxxn1", // Colaboración Flyback
      nombre: "Colaboración Flyback",
      descripcion: "Contrato de colaboración para servicio Flyback",
      icon: "✈️",
      color: "#9333ea",
    },
    tipo_c: {
      id: "template_ifkujpb", // Colaboración Refund360
      nombre: "Colaboración Refund360",
      descripcion: "Contrato de colaboración para servicio Refund360",
      icon: "💰",
      color: "#4f46e5",
    },
  },
};

console.log("📋 Templates EmailJS configurados:");
console.log("  - Colaboración EntradaFlex:", emailJSConfig.templates.tipo_a.id);
console.log("  - Colaboración Flyback:", emailJSConfig.templates.tipo_b.id);
console.log("  - Colaboración Refund360:", emailJSConfig.templates.tipo_c.id);

// Funciones auxiliares para mensajes personalizados
function getMensajeBienvenida(tipoPlantilla, nombreAliado) {
  const mensajes = {
    tipo_a: `Estimado/a ${nombreAliado}, nos complace presentarle el contrato de Colaboración EntradaFlex.`,
    tipo_b: `Estimado/a ${nombreAliado}, es un placer presentarle el contrato de Colaboración Flyback.`,
    tipo_c: `Estimado/a ${nombreAliado}, nos honra presentarle el contrato de Colaboración Refund360.`,
  };
  return mensajes[tipoPlantilla] || mensajes.tipo_a;
}

function getMensajeInstrucciones(tipoPlantilla) {
  const instrucciones = {
    tipo_a:
      "Por favor, revise los términos de EntradaFlex y proceda con la firma digital.",
    tipo_b:
      "Le invitamos a revisar los términos de Flyback y confirmar su aceptación mediante firma digital.",
    tipo_c:
      "Le solicitamos revisar los términos de Refund360 y formalizar el acuerdo mediante firma digital.",
  };
  return instrucciones[tipoPlantilla] || instrucciones.tipo_a;
}

// RUTA PRINCIPAL: Enviar email de contrato con EmailJS
router.post(
  "/enviar-contrato-equipo",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const {
        aliado,
        linkFirma,
        fechaInicio,
        fechaFin,
        observaciones,
        tipoPlantilla = "tipo_a",
      } = req.body;

      console.log("📧 === INICIANDO ENVÍO DE EMAIL CONTRATO EQUIPO ===");
      console.log("Tipo de plantilla:", tipoPlantilla);
      console.log("Destinatario:", aliado.correo);
      console.log("Link de firma:", linkFirma);

      // Validaciones
      if (!aliado || !aliado.correo) {
        console.log("❌ Datos de aliado incompletos");
        return res.status(400).json({
          success: false,
          message: "Datos del aliado incompletos o sin correo electrónico",
        });
      }

      if (!linkFirma) {
        console.log("❌ Link de firma no proporcionado");
        return res.status(400).json({
          success: false,
          message: "Link de firma requerido",
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(aliado.correo)) {
        console.log("❌ Formato de email inválido:", aliado.correo);
        return res.status(400).json({
          success: false,
          message: "Formato de email inválido",
        });
      }

      // Validar tipo de plantilla
      if (!emailJSConfig.templates[tipoPlantilla]) {
        console.log("❌ Tipo de plantilla inválido:", tipoPlantilla);
        return res.status(400).json({
          success: false,
          message: "Tipo de plantilla inválido",
          tiposPermitidos: Object.keys(emailJSConfig.templates),
        });
      }

      const templateInfo = emailJSConfig.templates[tipoPlantilla];
      const templateId = templateInfo.id;

      console.log(
        `📄 Usando template: ${templateInfo.nombre} (${templateInfo.icon})`
      );
      console.log(`📋 Template ID: ${templateId}`);

      // Formatear fechas
      const fechaInicioFormateada = new Date(fechaInicio).toLocaleDateString(
        "es-ES",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      const fechaFinFormateada = new Date(fechaFin).toLocaleDateString(
        "es-ES",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      // Número de contrato único con tipo
      const numeroContrato = `CONT-EQ-${tipoPlantilla.toUpperCase().replace("TIPO_", "")}-${Date.now()}`;

      // Parámetros para EmailJS
      const templateParams = {
        // Destinatario
        to_email: aliado.correo,
        to_name: aliado.nombre,

        // Datos del contrato
        fecha_inicio: fechaInicioFormateada,
        fecha_fin: fechaFinFormateada,
        observaciones: observaciones || "Sin observaciones adicionales",
        link_firma: linkFirma,
        numero_contrato: numeroContrato,
        fecha_envio: new Date().toLocaleDateString("es-ES"),

        // Tipo de contrato
        tipo_contrato: templateInfo.nombre,
        tipo_plantilla: tipoPlantilla,
        descripcion_contrato: templateInfo.descripcion,

        // Empresa
        empresa: "BNP Capital",
        contacto_empresa: "Equipo BNP Capital",
        email_contacto: "bnpcap.dev@gmail.com",

        // Aliado
        aliado_ruc: aliado.ruc || "No especificado",
        aliado_direccion: aliado.direccion || "No especificada",
        aliado_telefono: aliado.telefono || "No especificado",
        aliado_razon_social: aliado.razon_social || aliado.nombre,

        // Mensajes personalizados según tipo
        mensaje_bienvenida: getMensajeBienvenida(tipoPlantilla, aliado.nombre),
        mensaje_instrucciones: getMensajeInstrucciones(tipoPlantilla),

        // Legal
        tipo_firma: "Firma Digital",
        valor_legal:
          "La firma digital tiene la misma validez legal que una firma manuscrita",
        validez_enlace: "30 días",
      };

      console.log("📋 === PREPARANDO ENVÍO CON EMAILJS ===");
      console.log(
        "Template params preparados:",
        Object.keys(templateParams).length,
        "variables"
      );

      // Preparar datos para EmailJS API
      const emailData = {
        service_id: emailJSConfig.serviceId,
        template_id: templateId,
        user_id: emailJSConfig.publicKey,
        template_params: templateParams,
        accessToken: emailJSConfig.privateKey,
      };

      console.log("📤 === ENVIANDO A EMAILJS API ===");
      console.log("Service ID:", emailJSConfig.serviceId);
      console.log("Template ID:", templateId);

      // Enviar con EmailJS API
      const response = await fetch(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData),
        }
      );

      console.log("📨 Respuesta EmailJS status:", response.status);

      if (response.ok) {
        const result = await response.text();

        console.log("✅ === EMAIL ENVIADO EXITOSAMENTE CON EMAILJS ===");
        console.log("Response:", result);
        console.log("Destinatario:", aliado.correo);
        console.log("Template usado:", templateId, "-", templateInfo.nombre);
        console.log("Número de contrato:", numeroContrato);
        console.log("=== FIN ENVÍO EXITOSO ===");

        return res.status(200).json({
          success: true,
          message: "Email enviado exitosamente con EmailJS",
          data: {
            messageId: `emailjs_${Date.now()}`,
            numeroContrato: numeroContrato,
            tipoContrato: templateInfo.nombre,
            tipoPlantilla: tipoPlantilla,
            destinatario: aliado.correo,
            templateUsado: templateId,
            templateNombre: templateInfo.nombre,
            emailJsResponse: result,
          },
        });
      } else {
        const errorText = await response.text();
        console.error("❌ Error EmailJS:", response.status, errorText);

        return res.status(500).json({
          success: false,
          message: `Error EmailJS: ${response.status}`,
          error: errorText,
          tipoPlantilla: tipoPlantilla,
          templateId: templateId,
        });
      }
    } catch (error) {
      console.error("❌ === ERROR AL ENVIAR EMAIL CON EMAILJS ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("=== FIN ERROR ===");

      return res.status(500).json({
        success: false,
        message: "Error al enviar email",
        error: error.message,
      });
    }
  }
);

// RUTA: Obtener información de templates disponibles
router.get("/templates-info", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log("📋 Solicitando información de templates");

    res.json({
      success: true,
      templates: emailJSConfig.templates,
      serviceId: emailJSConfig.serviceId,
      totalTemplates: Object.keys(emailJSConfig.templates).length,
    });
  } catch (error) {
    console.error("❌ Error al obtener templates:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener información de templates",
      error: error.message,
    });
  }
});

// RUTA: Verificar configuración de EmailJS
router.get("/verificar-config", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log("🔍 Verificando configuración de EmailJS");

    const config = {
      serviceId: emailJSConfig.serviceId ? "CONFIGURADO" : "NO CONFIGURADO",
      publicKey: emailJSConfig.publicKey ? "CONFIGURADO" : "NO CONFIGURADO",
      privateKey: emailJSConfig.privateKey ? "CONFIGURADO" : "NO CONFIGURADO",
      templates: Object.keys(emailJSConfig.templates).map((key) => ({
        tipo: key,
        id: emailJSConfig.templates[key].id,
        nombre: emailJSConfig.templates[key].nombre,
        icon: emailJSConfig.templates[key].icon,
      })),
      totalTemplates: Object.keys(emailJSConfig.templates).length,
    };

    console.log("✅ Configuración verificada");
    console.log("Templates:", config.templates);

    res.json({
      success: true,
      message: "Configuración de EmailJS verificada",
      config: config,
      status: "OPERATIVO",
    });
  } catch (error) {
    console.error("❌ Error al verificar configuración:", error);
    res.status(500).json({
      success: false,
      message: "Error al verificar configuración",
      error: error.message,
    });
  }
});

console.log("✅ === emailRoutes.js configurado correctamente ===");
console.log("Rutas disponibles:");
console.log("  POST /api/email/enviar-contrato-equipo");
console.log("  GET  /api/email/templates-info");
console.log("  GET  /api/email/verificar-config");

export default router;
