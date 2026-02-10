import express from "express";
import { Notificacion } from "../models/Notificacion.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { checkAuth, isEquipoBNP, isBeneficiario } from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

// Middleware para verificar que sea miembro del equipo BNP
const verificarEquipoBNP = [checkAuth, isEquipoBNP];

// === RUTAS PARA EQUIPO BNP ===

// Ruta para enviar notificación global a todos los beneficiarios
router.post("/enviar/global", verificarEquipoBNP, async (req, res) => {
  try {
    const { titulo, mensaje, tipo, metadatos } = req.body;

    if (!titulo || !mensaje) {
      return res.status(400).json({
        success: false,
        message: "El título y mensaje son obligatorios",
      });
    }

    // Configurar expiración si se especifica en metadatos
    const expiracionHoras = metadatos?.expiracion_horas;
    let fechaExpiracion = null;

    if (expiracionHoras && expiracionHoras > 0) {
      fechaExpiracion = new Date();
      fechaExpiracion.setHours(fechaExpiracion.getHours() + expiracionHoras);
    }

    // Crear un nuevo objeto de metadatos sin el campo expiracion_horas
    const { expiracion_horas, ...metadatosLimpios } = metadatos || {};

    // Usamos el método estático que creamos en el modelo
    const notificacion = await Notificacion.crearNotificacionGlobal(
      {
        titulo,
        mensaje,
        tipo: tipo || "INFO",
        metadatos: metadatosLimpios || {},
        nombreEmisor: req.usuario.nombre,
        expiracion: fechaExpiracion,
      },
      req.usuario._id
    );

    res.status(201).json({
      success: true,
      message: "Notificación enviada a todos los beneficiarios",
      notificacion: {
        _id: notificacion._id,
        titulo: notificacion.titulo,
        tipo: notificacion.tipo,
        totalReceptores: notificacion.receptores.length,
        expiracion: notificacion.expiracion,
      },
    });
  } catch (error) {
    console.error("Error al enviar notificación global:", error);
    res.status(500).json({
      success: false,
      message: "Error al enviar notificación global",
    });
  }
});

// Ruta para enviar notificación a múltiples beneficiarios
router.post("/enviar/multiple", verificarEquipoBNP, async (req, res) => {
  try {
    const { titulo, mensaje, tipo, metadatos, beneficiarios } = req.body;

    if (!titulo || !mensaje) {
      return res.status(400).json({
        success: false,
        message: "El título y mensaje son obligatorios",
      });
    }

    if (
      !beneficiarios ||
      !Array.isArray(beneficiarios) ||
      beneficiarios.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Se debe especificar al menos un beneficiario",
      });
    }

    // Configurar expiración si se especifica en metadatos
    const expiracionHoras = metadatos?.expiracion_horas;
    let fechaExpiracion = null;

    if (expiracionHoras && expiracionHoras > 0) {
      fechaExpiracion = new Date();
      fechaExpiracion.setHours(fechaExpiracion.getHours() + expiracionHoras);
    }

    // Crear un nuevo objeto de metadatos sin el campo expiracion_horas
    const { expiracion_horas, ...metadatosLimpios } = metadatos || {};

    // Verificar que todos los beneficiarios existen
    const beneficiariosEncontrados = await Beneficiario.find({
      _id: { $in: beneficiarios },
    }).select("_id nombre");

    if (beneficiariosEncontrados.length !== beneficiarios.length) {
      return res.status(404).json({
        success: false,
        message: "Uno o más beneficiarios no fueron encontrados",
      });
    }

    // Crear notificación base
    const notificacionBase = {
      titulo,
      mensaje,
      tipo: tipo || "INFO",
      metadatos: metadatosLimpios || {},
      nombreEmisor: req.usuario.nombre,
      expiracion: fechaExpiracion,
      emisor_id: req.usuario._id,
      fecha_creacion: new Date(),
      receptores: beneficiariosEncontrados.map((b) => ({
        beneficiario_id: b._id,
        leida: false,
      })),
      global: false,
      activo: true,
    };

    // Guardar la notificación
    const notificacion = await Notificacion.create(notificacionBase);

    res.status(201).json({
      success: true,
      message: `Notificación enviada a ${beneficiariosEncontrados.length} beneficiarios`,
      notificacion: {
        _id: notificacion._id,
        titulo: notificacion.titulo,
        tipo: notificacion.tipo,
        totalReceptores: notificacion.receptores.length,
        expiracion: notificacion.expiracion,
      },
    });
  } catch (error) {
    console.error("Error al enviar notificación múltiple:", error);
    res.status(500).json({
      success: false,
      message: "Error al enviar notificación a múltiples beneficiarios",
    });
  }
});

// Ruta para enviar notificación a un beneficiario específico
router.post(
  "/enviar/especifico/:beneficiarioId",
  verificarEquipoBNP,
  async (req, res) => {
    try {
      const { beneficiarioId } = req.params;
      const { titulo, mensaje, tipo, metadatos } = req.body;

      if (!titulo || !mensaje) {
        return res.status(400).json({
          success: false,
          message: "El título y mensaje son obligatorios",
        });
      }

      // Verificar que el beneficiario existe
      const beneficiario = await Beneficiario.findById(beneficiarioId).select(
        "_id nombre"
      );
      if (!beneficiario) {
        return res.status(404).json({
          success: false,
          message: "Beneficiario no encontrado",
        });
      }

      // Configurar expiración si se especifica en metadatos
      const expiracionHoras = metadatos?.expiracion_horas;
      let fechaExpiracion = null;

      if (expiracionHoras && expiracionHoras > 0) {
        fechaExpiracion = new Date();
        fechaExpiracion.setHours(fechaExpiracion.getHours() + expiracionHoras);
      }

      // Crear un nuevo objeto de metadatos sin el campo expiracion_horas
      const { expiracion_horas, ...metadatosLimpios } = metadatos || {};

      // Crear la notificación específica
      const notificacion = await Notificacion.crearNotificacionEspecifica(
        {
          titulo,
          mensaje,
          tipo: tipo || "INFO",
          metadatos: metadatosLimpios || {},
          nombreEmisor: req.usuario.nombre,
          expiracion: fechaExpiracion,
        },
        req.usuario._id,
        beneficiarioId
      );

      res.status(201).json({
        success: true,
        message: `Notificación enviada a ${
          beneficiario.nombre || "beneficiario"
        }`,
        notificacion: {
          _id: notificacion._id,
          titulo: notificacion.titulo,
          tipo: notificacion.tipo,
          expiracion: notificacion.expiracion,
        },
      });
    } catch (error) {
      console.error("Error al enviar notificación específica:", error);
      res.status(500).json({
        success: false,
        message: "Error al enviar notificación específica",
      });
    }
  }
);

// === RUTAS PARA ADMINISTRACIÓN DE NOTIFICACIONES ===

// notificaciones para equipo BNP
router.get("/admin/listar", verificarEquipoBNP, async (req, res) => {
  try {
    const {
      pagina = 1,
      limite = 10,
      tipo,
      global,
      busqueda,
      fechaInicio,
      fechaFin,
    } = req.query;

    const filtros = { activo: true };

    if (tipo) {
      filtros.tipo = tipo;
    }

    if (global !== undefined) {
      filtros.global = global === "true";
    }

    if (busqueda) {
      filtros.$or = [
        { titulo: { $regex: busqueda, $options: "i" } },
        { mensaje: { $regex: busqueda, $options: "i" } },
      ];
    }

    if (fechaInicio && fechaFin) {
      filtros.fecha_creacion = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin),
      };
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const notificaciones = await Notificacion.find(filtros)
      .select(
        "titulo mensaje tipo global expiracion nombreEmisor fecha_creacion receptores"
      )
      .sort({ fecha_creacion: -1 })
      .skip(skip)
      .limit(parseInt(limite))
      .lean();

    const notificacionesConReceptores = notificaciones.map((n) => ({
      ...n,
      totalReceptores: n.receptores.length,
      receptores: undefined,
    }));

    const totalItems = await Notificacion.countDocuments(filtros);

    res.status(200).json({
      success: true,
      notificaciones: notificacionesConReceptores,
      meta: {
        totalItems,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(totalItems / parseInt(limite)),
      },
    });
  } catch (error) {
    console.error("Error al listar notificaciones admin:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener las notificaciones",
    });
  }
});

// detalle de una notificación específica
router.get("/admin/:id", verificarEquipoBNP, async (req, res) => {
  try {
    const notificacionId = req.params.id;

    const notificacion = await Notificacion.findById(notificacionId)
      .select("-__v")
      .lean();

    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: "Notificación no encontrada",
      });
    }

    const totalReceptores = notificacion.receptores.length;

    const receptoresLeidos = notificacion.receptores.filter(
      (r) => r.leida
    ).length;

    res.status(200).json({
      success: true,
      notificacion: {
        ...notificacion,
        estadisticas: {
          totalReceptores,
          receptoresLeidos,
          porcentajeLectura:
            totalReceptores > 0
              ? Math.round((receptoresLeidos / totalReceptores) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error al obtener notificación:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la notificación",
    });
  }
});

// receptores de una notificación
router.get("/admin/:id/receptores", verificarEquipoBNP, async (req, res) => {
  try {
    const notificacionId = req.params.id;

    const notificacion = await Notificacion.findById(notificacionId)
      .select("receptores")
      .lean();

    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: "Notificación no encontrada",
      });
    }

    if (notificacion.receptores.length === 0) {
      return res.status(200).json({
        success: true,
        receptores: [],
      });
    }

    const beneficiariosIds = notificacion.receptores.map(
      (r) => r.beneficiario_id
    );

    const beneficiarios = await Beneficiario.find({
      _id: { $in: beneficiariosIds },
    })
      .select("_id nombre codigo")
      .lean();

    const mapaBeneficiarios = {};
    beneficiarios.forEach((b) => {
      mapaBeneficiarios[b._id.toString()] = {
        nombre: b.nombre,
        codigo: b.codigo?.value,
      };
    });

    const receptoresCompletos = notificacion.receptores.map((r) => {
      const beneficiarioId = r.beneficiario_id.toString();
      const beneficiarioInfo = mapaBeneficiarios[beneficiarioId] || {};

      return {
        beneficiario_id: beneficiarioId,
        nombre: beneficiarioInfo.nombre || "Beneficiario",
        codigo: beneficiarioInfo.codigo || "",
        leida: r.leida,
        fecha_leida: r.fecha_leida,
      };
    });

    res.status(200).json({
      success: true,
      receptores: receptoresCompletos,
    });
  } catch (error) {
    console.error("Error al obtener receptores:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los receptores de la notificación",
    });
  }
});

// Eliminar una notificación marcarla como inactiva
router.delete("/admin/:id", verificarEquipoBNP, async (req, res) => {
  try {
    const notificacionId = req.params.id;

    const notificacion = await Notificacion.findById(notificacionId);
    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: "Notificación no encontrada",
      });
    }

    notificacion.activo = false;
    await notificacion.save();

    res.status(200).json({
      success: true,
      message: "Notificación eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar notificación:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la notificación",
    });
  }
});

// Eliminar múltiples notificaciones
router.post(
  "/admin/eliminar-multiples",
  verificarEquipoBNP,
  async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar un array de IDs de notificaciones",
        });
      }

      const idsValidos = ids.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (idsValidos.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No se proporcionaron IDs válidos",
        });
      }

      const resultado = await Notificacion.updateMany(
        { _id: { $in: idsValidos } },
        { $set: { activo: false } }
      );

      res.status(200).json({
        success: true,
        message: `${resultado.modifiedCount} notificaciones eliminadas correctamente`,
      });
    } catch (error) {
      console.error("Error al eliminar múltiples notificaciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar las notificaciones",
      });
    }
  }
);

// Programar borrado de notificaciones expiradas (se ejecuta automáticamente)
const programarLimpiezaAutomatica = () => {
  console.log("Iniciando sistema de limpieza automática de notificaciones...");

  limpiarNotificacionesExpiradas();

  setInterval(limpiarNotificacionesExpiradas, 3600000);
};

// Función para limpiar notificaciones expiradas
const limpiarNotificacionesExpiradas = async () => {
  try {
    const ahora = new Date();
    console.log(`Ejecutando limpieza automática: ${ahora.toISOString()}`);

    const resultado = await Notificacion.updateMany(
      {
        expiracion: { $lt: ahora },
        activo: true,
      },
      {
        $set: { activo: false },
      }
    );

    console.log(
      `Limpieza automática completada: ${resultado.modifiedCount} notificaciones expiradas marcadas como inactivas`
    );

    if (resultado.modifiedCount > 0) {
      const notificacionesExpiradas = await Notificacion.find({
        expiracion: { $lt: ahora },
        activo: false,
      })
        .select("_id titulo expiracion")
        .limit(20);

      console.log(
        "Notificaciones recién expiradas:",
        notificacionesExpiradas.map((n) => ({
          id: n._id.toString(),
          titulo: n.titulo,
          expiracion: n.expiracion,
        }))
      );
    }
  } catch (error) {
    console.error(
      "Error al realizar limpieza automática de notificaciones:",
      error
    );
  }
};
programarLimpiezaAutomatica();

router.post(
  "/admin/limpiar-expiradas",
  verificarEquipoBNP,
  async (req, res) => {
    try {
      const ahora = new Date();
      console.log(`Limpieza manual forzada: ${ahora.toISOString()}`);

      const resultado = await Notificacion.updateMany(
        {
          expiracion: { $lt: ahora },
          activo: true,
        },
        {
          $set: { activo: false },
        }
      );

      // Encontrar qué notificaciones fueron afectadas
      const notificacionesExpiradas = await Notificacion.find({
        expiracion: { $lt: ahora },
        activo: false,
      })
        .select("_id titulo expiracion")
        .limit(50);

      res.status(200).json({
        success: true,
        message: `Limpieza forzada: ${resultado.modifiedCount} notificaciones expiradas marcadas como inactivas`,
        notificacionesAfectadas: notificacionesExpiradas.map((n) => ({
          id: n._id.toString(),
          titulo: n.titulo,
          expiracion: n.expiracion,
        })),
      });
    } catch (error) {
      console.error("Error al forzar limpieza:", error);
      res.status(500).json({
        success: false,
        message: "Error al realizar limpieza de notificaciones",
      });
    }
  }
);

// === RUTAS PARA BENEFICIARIOS ===

// Obtener notificaciones del beneficiario autenticado (paginadas)
router.get("/", checkAuth, isBeneficiario, async (req, res) => {
  try {
    const beneficiarioId = req.beneficiario._id;
    const pagina = parseInt(req.query.pagina || "1");
    const limite = parseInt(req.query.limite || "10");

    // Obtener notificaciones paginadas para el beneficiario
    const notificaciones = await Notificacion.obtenerNotificacionesBeneficiario(
      beneficiarioId,
      pagina,
      limite
    );

    // Contar no leídas (para badge del frontend)
    const totalNoLeidas = await Notificacion.contarNoLeidas(beneficiarioId);

    // Contar total de notificaciones para paginación
    const totalNotificaciones = await Notificacion.countDocuments({
      "receptores.beneficiario_id": beneficiarioId,
      activo: true,
    });

    res.status(200).json({
      success: true,
      notificaciones,
      meta: {
        totalNoLeidas,
        totalItems: totalNotificaciones,
        pagina,
        limite,
        totalPaginas: Math.ceil(totalNotificaciones / limite),
      },
    });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener notificaciones",
    });
  }
});

// Ruta alternativa para obtener notificaciones (para mantener compatibilidad)
router.get(
  "/mis-notificaciones",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const beneficiarioId = req.beneficiario._id;
      const pagina = parseInt(req.query.pagina || "1");
      const limite = parseInt(req.query.limite || "10");

      // Obtener notificaciones paginadas
      const notificaciones =
        await Notificacion.obtenerNotificacionesBeneficiario(
          beneficiarioId,
          pagina,
          limite
        );

      // Contar no leídas (para badge del frontend)
      const totalNoLeidas = await Notificacion.contarNoLeidas(beneficiarioId);

      // Contar total de notificaciones para paginación
      const totalNotificaciones = await Notificacion.countDocuments({
        "receptores.beneficiario_id": beneficiarioId,
        activo: true,
      });

      res.status(200).json({
        success: true,
        notificaciones,
        meta: {
          totalNoLeidas,
          totalItems: totalNotificaciones,
          pagina,
          limite,
          totalPaginas: Math.ceil(totalNotificaciones / limite),
        },
      });
    } catch (error) {
      console.error("Error al obtener notificaciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener notificaciones",
      });
    }
  }
);

// Marcar notificación como leída
router.patch(
  "/marcar-leida/:notificacionId",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const { notificacionId } = req.params;
      const beneficiarioId = req.beneficiario._id;

      console.log("Solicitud para marcar como leída:", {
        notificacionId,
        beneficiarioId: beneficiarioId.toString(),
      });

      const resultado = await Notificacion.marcarLeida(
        notificacionId,
        beneficiarioId
      );

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la notificación para este beneficiario",
        });
      }

      console.log("Notificación marcada como leída exitosamente");

      res.status(200).json({
        success: true,
        message: "Notificación marcada como leída",
      });
    } catch (error) {
      console.error("Error al marcar notificación como leída:", error);
      res.status(500).json({
        success: false,
        message: "Error al marcar notificación",
      });
    }
  }
);

// Marcar todas las notificaciones como leídas
router.post(
  "/marcar-todas-leidas",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const beneficiarioId = req.beneficiario._id;

      // Actualizar todas las notificaciones no leídas para este beneficiario
      const totalActualizadas = await Notificacion.marcarTodasLeidas(
        beneficiarioId
      );

      res.status(200).json({
        success: true,
        message: "Todas las notificaciones han sido marcadas como leídas",
        actualizadas: totalActualizadas,
      });
    } catch (error) {
      console.error(
        "Error al marcar todas las notificaciones como leídas:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Error al marcar las notificaciones",
      });
    }
  }
);
router.get(
  "/verificar-estado/:notificacionId",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const { notificacionId } = req.params;
      const beneficiarioId = req.beneficiario._id;

      // Buscar la notificación específica
      const notificacion = await Notificacion.findOne({
        _id: notificacionId,
        "receptores.beneficiario_id": beneficiarioId,
      });

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: "Notificación no encontrada",
        });
      }

      // Encontrar el receptor específico
      const receptor = notificacion.receptores.find(
        (r) => r.beneficiario_id.toString() === beneficiarioId.toString()
      );

      res.status(200).json({
        success: true,
        leida: receptor.leida,
        fecha_leida: receptor.fecha_leida,
      });
    } catch (error) {
      console.error("Error al verificar estado de notificación:", error);
      res.status(500).json({
        success: false,
        message: "Error al verificar estado",
      });
    }
  }
);
// Obtener contador de notificaciones no leídas
router.get(
  "/no-leidas/contador",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const beneficiarioId = req.beneficiario._id;

      const totalNoLeidas = await Notificacion.contarNoLeidas(beneficiarioId);

      res.status(200).json({
        success: true,
        totalNoLeidas,
      });
    } catch (error) {
      console.error("Error al obtener contador de notificaciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener contador",
      });
    }
  }
);

export default router;
