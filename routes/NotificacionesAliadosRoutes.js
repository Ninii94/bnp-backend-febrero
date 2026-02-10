import express from "express";
import { Notificacion } from "../models/Notificacion.js";
import { Aliado } from "../models/Aliado.js";
import { checkAuth, isEquipoBNP, isAliado } from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

// Middleware para verificar que sea miembro del equipo BNP
const verificarEquipoBNP = [checkAuth, isEquipoBNP];

// === RUTAS PARA EQUIPO BNP ===

// Ruta para enviar notificación global a todos los aliados
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

    // Usar el método estático del modelo para crear notificación global a aliados
    const notificacion = await Notificacion.crearNotificacionGlobalAliados(
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
      message: "Notificación enviada a todos los aliados",
      notificacion: {
        _id: notificacion._id,
        titulo: notificacion.titulo,
        tipo: notificacion.tipo,
        totalReceptores: notificacion.receptores.length,
        expiracion: notificacion.expiracion,
      },
    });
  } catch (error) {
    console.error("Error al enviar notificación global a aliados:", error);
    res.status(500).json({
      success: false,
      message: "Error al enviar notificación global a aliados",
    });
  }
});

// Ruta para enviar notificación a múltiples aliados
router.post("/enviar/multiple", verificarEquipoBNP, async (req, res) => {
  try {
    const { titulo, mensaje, tipo, metadatos, aliados } = req.body;

    if (!titulo || !mensaje) {
      return res.status(400).json({
        success: false,
        message: "El título y mensaje son obligatorios",
      });
    }

    if (!aliados || !Array.isArray(aliados) || aliados.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Se debe especificar al menos un aliado",
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

    // Verificar que todos los aliados existen
    const aliadosEncontrados = await Aliado.find({
      _id: { $in: aliados },
    }).select("_id nombre");

    if (aliadosEncontrados.length !== aliados.length) {
      return res.status(404).json({
        success: false,
        message: "Uno o más aliados no fueron encontrados",
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
      receptores: aliadosEncontrados.map((a) => ({
        aliado_id: a._id,
        leida: false,
      })),
      global: false,
      activo: true,
      tipoReceptor: "aliado",
    };

    // Guardar la notificación
    const notificacion = await Notificacion.create(notificacionBase);

    res.status(201).json({
      success: true,
      message: `Notificación enviada a ${aliadosEncontrados.length} aliados`,
      notificacion: {
        _id: notificacion._id,
        titulo: notificacion.titulo,
        tipo: notificacion.tipo,
        totalReceptores: notificacion.receptores.length,
        expiracion: notificacion.expiracion,
      },
    });
  } catch (error) {
    console.error("Error al enviar notificación múltiple a aliados:", error);
    res.status(500).json({
      success: false,
      message: "Error al enviar notificación a múltiples aliados",
    });
  }
});

// Ruta para enviar notificación a un aliado específico
router.post(
  "/enviar/especifico/:aliadoId",
  verificarEquipoBNP,
  async (req, res) => {
    try {
      const { aliadoId } = req.params;
      const { titulo, mensaje, tipo, metadatos } = req.body;

      if (!titulo || !mensaje) {
        return res.status(400).json({
          success: false,
          message: "El título y mensaje son obligatorios",
        });
      }

      // Verificar que el aliado existe
      const aliado = await Aliado.findById(aliadoId).select("_id nombre");
      if (!aliado) {
        return res.status(404).json({
          success: false,
          message: "Aliado no encontrado",
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

      // Usar el método estático del modelo para crear notificación específica a un aliado
      const notificacion = await Notificacion.crearNotificacionEspecificaAliado(
        {
          titulo,
          mensaje,
          tipo: tipo || "INFO",
          metadatos: metadatosLimpios || {},
          nombreEmisor: req.usuario.nombre,
          expiracion: fechaExpiracion,
        },
        req.usuario._id,
        aliadoId
      );

      res.status(201).json({
        success: true,
        message: `Notificación enviada a ${aliado.nombre || "aliado"}`,
        notificacion: {
          _id: notificacion._id,
          titulo: notificacion.titulo,
          tipo: notificacion.tipo,
          expiracion: notificacion.expiracion,
        },
      });
    } catch (error) {
      console.error("Error al enviar notificación específica a aliado:", error);
      res.status(500).json({
        success: false,
        message: "Error al enviar notificación específica a aliado",
      });
    }
  }
);

// === RUTAS PARA ADMINISTRACIÓN DE NOTIFICACIONES ===

// Listar notificaciones para aliados (panel de administración)
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

    const filtros = {
      activo: true,
      tipoReceptor: "aliado", // Solo notificaciones de aliados
    };

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

// === RUTAS PARA ALIADOS ===

// Obtener notificaciones del aliado autenticado (paginadas)
router.get("/", checkAuth, isAliado, async (req, res) => {
  try {
    // Verifica si req.aliado existe
    if (!req.aliado || !req.aliado._id) {
      console.error("Error: req.aliado no está definido o no tiene _id");
      return res.status(400).json({
        success: false,
        message: "No se pudo identificar el aliado",
        notificaciones: [],
        meta: {
          totalNoLeidas: 0,
          totalItems: 0,
          pagina: 1,
          limite: 10,
          totalPaginas: 0,
        },
      });
    }

    const aliadoId = req.aliado._id;
    console.log(
      "Obteniendo notificaciones para aliado ID:",
      aliadoId.toString()
    );

    const pagina = parseInt(req.query.pagina || "1");
    const limite = parseInt(req.query.limite || "10");

    try {
      // Usar el método estático del modelo
      const notificaciones = await Notificacion.obtenerNotificacionesAliado(
        aliadoId,
        pagina,
        limite
      );

      // Contar no leídas
      const totalNoLeidas = await Notificacion.contarNoLeidasAliado(aliadoId);

      // Contar total de notificaciones para paginación
      const totalNotificaciones = await Notificacion.countDocuments({
        "receptores.aliado_id": aliadoId,
        activo: true,
        tipoReceptor: "aliado",
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
      console.error("Error al obtener datos de notificaciones:", error);
      // Devolver una respuesta vacía en lugar de un error
      res.status(200).json({
        success: true,
        notificaciones: [],
        meta: {
          totalNoLeidas: 0,
          totalItems: 0,
          pagina,
          limite,
          totalPaginas: 0,
        },
      });
    }
  } catch (error) {
    console.error("Error en el endpoint de notificaciones de aliado:", error);
    // Devolver una respuesta vacía en vez de un error 500
    res.status(200).json({
      success: true,
      notificaciones: [],
      meta: {
        totalNoLeidas: 0,
        totalItems: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      },
    });
  }
});

// Marcar notificación como leída
router.patch(
  "/marcar-leida/:notificacionId",
  checkAuth,
  isAliado,
  async (req, res) => {
    try {
      const { notificacionId } = req.params;
      const aliadoId = req.aliado._id;

      // Usar el método estático del modelo
      const resultado = await Notificacion.marcarLeidaAliado(
        notificacionId,
        aliadoId
      );

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la notificación para este aliado",
        });
      }

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
router.post("/marcar-todas-leidas", checkAuth, isAliado, async (req, res) => {
  try {
    const aliadoId = req.aliado._id;

    // Usar el método estático del modelo
    const totalActualizadas = await Notificacion.marcarTodasLeidasAliado(
      aliadoId
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
});

// Verificar estado de una notificación específica
router.get(
  "/verificar-estado/:notificacionId",
  checkAuth,
  isAliado,
  async (req, res) => {
    try {
      const { notificacionId } = req.params;
      const aliadoId = req.aliado._id;

      // Buscar la notificación específica
      const notificacion = await Notificacion.findOne({
        _id: notificacionId,
        "receptores.aliado_id": aliadoId,
        tipoReceptor: "aliado",
      });

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: "Notificación no encontrada",
        });
      }

      // Encontrar el receptor específico
      const receptor = notificacion.receptores.find(
        (r) => r.aliado_id.toString() === aliadoId.toString()
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
router.get("/no-leidas/contador", checkAuth, isAliado, async (req, res) => {
  try {
    const aliadoId = req.aliado?._id || req.user?.id || req.query.aliadoId;

    // Usar el método estático del modelo
    const totalNoLeidas = await Notificacion.contarNoLeidasAliado(aliadoId);

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
});

// Eliminar una notificación específica (opcional, solo para administradores)
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

    // Marcar como inactiva en lugar de eliminar
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

// Obtener receptores de una notificación
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

    const aliadosIds = notificacion.receptores
      .filter((r) => r.aliado_id) // Filtrar solo los que tienen aliado_id
      .map((r) => r.aliado_id);

    const aliados = await Aliado.find({
      _id: { $in: aliadosIds },
    })
      .select("_id nombre telefono")
      .lean();

    const mapaAliados = {};
    aliados.forEach((a) => {
      mapaAliados[a._id.toString()] = {
        nombre: a.nombre,
        telefono: a.telefono,
      };
    });

    const receptoresCompletos = notificacion.receptores
      .filter((r) => r.aliado_id) // Solo incluir receptores con aliado_id
      .map((r) => {
        const aliadoId = r.aliado_id.toString();
        const aliadoInfo = mapaAliados[aliadoId] || {};

        return {
          aliado_id: aliadoId,
          nombre: aliadoInfo.nombre || "Aliado",
          telefono: aliadoInfo.telefono || "",
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

export default router;
