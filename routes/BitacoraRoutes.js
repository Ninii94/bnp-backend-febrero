import express from "express";
import { ActividadBitacora } from "../models/ActividadBitacora.js";
import { Aliado } from "../models/Aliado.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Servicio } from "../models/Servicio.js";
import { Usuario } from "../models/Usuario.js";
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

// Obtener todas las actividades de la bitácora con filtros y paginación

router.get("/actividades", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filtros = { activo: true };
    if (req.query.tipo) filtros.tipo = req.query.tipo;
    if (req.query.entidad_tipo)
      filtros["metadata.entidad_tipo"] = req.query.entidad_tipo;
    if (req.query.nivel_criticidad)
      filtros["auditoria.nivel_criticidad"] = req.query.nivel_criticidad;
    if (req.query.fecha_desde) {
      filtros.fecha_creacion = { $gte: new Date(req.query.fecha_desde) };
    }
    if (req.query.fecha_hasta) {
      filtros.fecha_creacion = {
        ...filtros.fecha_creacion,
        $lte: new Date(req.query.fecha_hasta),
      };
    }
    if (req.query.aliado_id) {
      filtros["metadata.aliado_relacionado.id"] = req.query.aliado_id;
    }

    const actividades = await ActividadBitacora.find(filtros)
      .populate("usuario.id", "nombre_usuario tipo correo")
      .sort({ fecha_creacion: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ActividadBitacora.countDocuments(filtros);

    const actividadesFormateadas = actividades.map((actividad) => ({
      _id: actividad._id,
      tipo: actividad.tipo,
      descripcion: actividad.descripcion,
      fecha: actividad.fecha_creacion,
      fecha_creacion: actividad.fecha_creacion,
      creado_por: actividad.usuario?.nombre_usuario || "Sistema",
      usuario: actividad.usuario?.nombre_usuario || "Sistema",
      entidad_tipo: actividad.metadata?.entidad_tipo,
      entidad_nombre: actividad.metadata?.entidad_nombre,
      nivel_criticidad: actividad.auditoria?.nivel_criticidad || "bajo",
      requiere_revision: actividad.auditoria?.requiere_revision || false,
      es_error: actividad.auditoria?.es_error || false,
      metadata: {
        entidad_tipo: actividad.metadata?.entidad_tipo,
        entidad_id: actividad.metadata?.entidad_id,
        entidad_nombre: actividad.metadata?.entidad_nombre,
        datos_nuevos: actividad.metadata?.datos_nuevos,
        datos_anteriores: actividad.metadata?.datos_anteriores,
        parametros_accion: actividad.metadata?.parametros_accion,
        aliado_relacionado: actividad.metadata?.aliado_relacionado,
        beneficiario_relacionado: actividad.metadata?.beneficiario_relacionado,
        servicio_relacionado: actividad.metadata?.servicio_relacionado,
        sucursal_relacionada: actividad.metadata?.sucursal_relacionada,
        ticket_info: actividad.metadata?.ticket_info,
        ip_origen: actividad.metadata?.ip_origen,
        metodo_http: actividad.metadata?.metodo_http,
        url_endpoint: actividad.metadata?.url_endpoint,
        user_agent: actividad.metadata?.user_agent,
      },
      auditoria: actividad.auditoria,
      detalles: {
        aliado_nombre: actividad.metadata?.aliado_relacionado?.nombre,
        beneficiario_nombre: actividad.metadata?.beneficiario_relacionado?.nombre,
        servicio_nombre: actividad.metadata?.servicio_relacionado?.nombre,
        ip_origen: actividad.metadata?.ip_origen,
        metodo_http: actividad.metadata?.metodo_http,
        tiempo_ejecucion: actividad.metadata?.tiempo_ejecucion,
        etiquetas: actividad.auditoria?.etiquetas || [],
        datos_extra: actividad.datos_extra,
      },
    }));

    res.json({
      actividades: actividadesFormateadas,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error al obtener actividades de bitácora:", error);
    res.status(500).json({
      error: "Error al obtener actividades",
      mensaje: error.message,
    });
  }
});
// Obtener estadísticas de la bitácora
router.get("/estadisticas", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const hoy = new Date();
    const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Estadísticas por tipo de actividad
    const estadisticasPorTipo = await ActividadBitacora.aggregate([
      { $match: { activo: true } }, // ✅ Agregar filtro de activo
      {
        $group: {
          _id: "$tipo",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } }, // ✅ Ordenar por cantidad
    ]);

    // Actividades de esta semana
    const actividadesSemana = await ActividadBitacora.countDocuments({
      activo: true, // ✅ Agregar filtro
      fecha_creacion: { $gte: inicioSemana }, // ✅ Corregido: era "fecha"
    });

    // Actividades de este mes
    const actividadesMes = await ActividadBitacora.countDocuments({
      activo: true, // ✅ Agregar filtro
      fecha_creacion: { $gte: inicioMes }, // ✅ Corregido: era "fecha"
    });

    // Total de actividades
    const totalActividades = await ActividadBitacora.countDocuments({
      activo: true,
    });

    // Actividades recientes (últimas 5) - POPULATE CORREGIDO
    const actividadesRecientes = await ActividadBitacora.find({
      activo: true, // ✅ Agregar filtro
    })
      .populate("usuario.id", "nombre_usuario tipo correo") // ✅ Corregido: era "creado_por"
      .sort({ fecha_creacion: -1 }) // ✅ Corregido: era "fecha"
      .limit(5);

    // Aliados más activos (con más actividades registradas)
    const aliadosActivos = await ActividadBitacora.aggregate([
      {
        $match: {
          activo: true, // ✅ Agregar filtro
          "metadata.aliado_relacionado.id": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$metadata.aliado_relacionado.id", // ✅ Corregido path
          count: { $sum: 1 },
          nombre: { $first: "$metadata.aliado_relacionado.nombre" }, // ✅ Corregido path
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    res.json({
      resumen: {
        total_actividades: totalActividades,
        actividades_semana: actividadesSemana,
        actividades_mes: actividadesMes,
      },
      por_tipo: estadisticasPorTipo, // ✅ Corregido nombre
      actividades_recientes: actividadesRecientes.map((act) => ({
        tipo: act.tipo,
        descripcion: act.descripcion,
        fecha: act.fecha_creacion, // ✅ Usar fecha_creacion
        creado_por: act.usuario?.nombre_usuario || "Sistema",
      })),
      aliados_activos: aliadosActivos, // ✅ Corregido nombre
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      error: "Error al obtener estadísticas",
      mensaje: error.message,
    });
  }
});

// Registrar manualmente una actividad (útil para casos especiales)
router.post(
  "/registrar-actividad",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const {
        tipo,
        descripcion,
        aliado_id,
        beneficiario_id,
        servicio_id,
        detalles,
      } = req.body;

      if (!tipo || !descripcion) {
        return res.status(400).json({
          error: "Tipo y descripción son requeridos",
        });
      }

      // ✅ Importar la función registrarActividad
      const { registrarActividad } = await import("../middleware/Bitacora.js");

      await registrarActividad(
        tipo,
        descripcion,
        {
          entidad_tipo: detalles?.entidad_tipo,
          aliado_relacionado: aliado_id ? { id: aliado_id } : null,
          beneficiario_relacionado: beneficiario_id
            ? { id: beneficiario_id }
            : null,
          servicio_relacionado: servicio_id ? { id: servicio_id } : null,
          ...detalles,
        },
        req
      );

      res.json({
        mensaje: "Actividad registrada correctamente",
      });
    } catch (error) {
      console.error("Error al registrar actividad manual:", error);
      res.status(500).json({
        error: "Error al registrar actividad",
        mensaje: error.message,
      });
    }
  }
);

// Endpoint para obtener actividades filtradas por aliado
router.get(
  "/actividades/aliado/:aliadoId",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { aliadoId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filtros = {
        activo: true,
        "metadata.aliado_relacionado.id": aliadoId,
      };

      const actividades = await ActividadBitacora.find(filtros)
        .sort({ fecha_creacion: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ActividadBitacora.countDocuments(filtros);

      res.json({
        actividades,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Error al obtener actividades del aliado:", error);
      res.status(500).json({
        error: "Error al obtener actividades del aliado",
        mensaje: error.message,
      });
    }
  }
);

// Endpoint para buscar actividades
router.get("/buscar", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { q, tipo, fecha_desde, fecha_hasta, limite = 50 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: "Se requieren al menos 2 caracteres para buscar",
      });
    }

    const actividades = await ActividadBitacora.buscarActividades(q, {
      limite: parseInt(limite),
      tipo,
      fechaDesde: fecha_desde,
      fechaHasta: fecha_hasta,
    });

    res.json({
      actividades,
      total: actividades.length,
    });
  } catch (error) {
    console.error("Error al buscar actividades:", error);
    res.status(500).json({
      error: "Error al buscar actividades",
      mensaje: error.message,
    });
  }
});

// Endpoint para marcar actividad como revisada
router.put(
  "/actividades/:id/revisar",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { notas } = req.body;

      const actividad = await ActividadBitacora.findById(id);
      if (!actividad) {
        return res.status(404).json({
          error: "Actividad no encontrada",
        });
      }

      await actividad.marcarComoRevisado(req.usuario._id);

      if (notas) {
        actividad.auditoria.notas_internas = notas;
        await actividad.save();
      }

      res.json({
        mensaje: "Actividad marcada como revisada",
        actividad_id: actividad._id,
      });
    } catch (error) {
      console.error("Error al marcar actividad como revisada:", error);
      res.status(500).json({
        error: "Error al marcar actividad como revisada",
        mensaje: error.message,
      });
    }
  }
);

// Obtener resumen de actividad por fechas
router.get("/resumen-por-fechas", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        error: "Se requieren fecha_inicio y fecha_fin",
      });
    }

    const resumen = await ActividadBitacora.aggregate([
      {
        $match: {
          activo: true,
          fecha_creacion: {
            $gte: new Date(fecha_inicio),
            $lte: new Date(fecha_fin),
          },
        },
      },
      {
        $group: {
          _id: {
            fecha: {
              $dateToString: { format: "%Y-%m-%d", date: "$fecha_creacion" },
            },
            tipo: "$tipo",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.fecha",
          actividades: {
            $push: {
              tipo: "$_id.tipo",
              count: "$count",
            },
          },
          total: { $sum: "$count" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json(resumen);
  } catch (error) {
    console.error("Error al obtener resumen por fechas:", error);
    res.status(500).json({
      error: "Error al obtener resumen",
      mensaje: error.message,
    });
  }
});

// Endpoint para limpiar/archivar actividades antiguas
router.post(
  "/mantenimiento/archivar-antiguas",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { dias = 365 } = req.body;

      const resultado = await ActividadBitacora.limpiarActividadesAntiguas(
        dias
      );

      res.json({
        mensaje: `Se archivaron ${resultado.modifiedCount} actividades`,
        archivadas: resultado.modifiedCount,
      });
    } catch (error) {
      console.error("Error al archivar actividades:", error);
      res.status(500).json({
        error: "Error al archivar actividades",
        mensaje: error.message,
      });
    }
  }
);

// Endpoint para exportar actividades
router.get("/exportar", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { formato = "json", ...filtros } = req.query;

    // Aplicar filtros similares al endpoint principal
    const condiciones = { activo: true };
    if (filtros.tipo) condiciones.tipo = filtros.tipo;
    if (filtros.fecha_desde)
      condiciones.fecha_creacion = { $gte: new Date(filtros.fecha_desde) };
    if (filtros.fecha_hasta) {
      condiciones.fecha_creacion = {
        ...condiciones.fecha_creacion,
        $lte: new Date(filtros.fecha_hasta),
      };
    }

    const actividades = await ActividadBitacora.find(condiciones)
      .sort({ fecha_creacion: -1 })
      .limit(10000); // Límite de seguridad

    if (formato === "csv") {
      // Convertir a CSV
      const csv = [
        "Fecha,Tipo,Descripción,Usuario,Entidad,Nivel Criticidad",
        ...actividades.map(
          (act) =>
            `"${act.fecha_creacion}","${act.tipo}","${act.descripcion}","${
              act.usuario?.nombre_usuario || "Sistema"
            }","${act.metadata?.entidad_nombre || ""}","${
              act.auditoria?.nivel_criticidad || "bajo"
            }"`
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="bitacora.csv"'
      );
      res.send(csv);
    } else {
      res.json({
        actividades,
        total: actividades.length,
        exportado_en: new Date(),
      });
    }
  } catch (error) {
    console.error("Error al exportar actividades:", error);
    res.status(500).json({
      error: "Error al exportar actividades",
      mensaje: error.message,
    });
  }
});

export default router;
