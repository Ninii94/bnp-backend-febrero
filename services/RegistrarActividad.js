import { ActividadBitacora } from "../models/ActividadBitacora.js";

export const registrarActividad = async (
  tipo,
  descripcion,
  opciones = {},
  req = null,
  nivelCriticidad = null
) => {
  try {
    const {
      entidad_tipo = null,
      entidad_id = null,
      entidad_nombre = null,
      aliado_relacionado = null,
      beneficiario_relacionado = null,
      servicio_relacionado = null,
      sucursal_relacionada = null,
      ticket_info = null,
      datos_anteriores = null,
      datos_nuevos = null,
      parametros_accion = null,
      requiere_revision = false,
      etiquetas = [],
      notas_internas = null,
      datos_extra = null,
    } = opciones;

    const auditoriaData = {
      requiere_revision,
      etiquetas,
      notas_internas,
    };

    if (nivelCriticidad) {
      auditoriaData.nivel_criticidad = nivelCriticidad;
    }

    const nuevaActividad = await ActividadBitacora.crearActividad({
      tipo,
      descripcion,
      metadata: {
        entidad_tipo,
        entidad_id,
        entidad_nombre,
        datos_anteriores,
        datos_nuevos,
        parametros_accion,
        ip_origen: req?.ip,
        user_agent: req?.get("User-Agent"),
        metodo_http: req?.method,
        url_endpoint: req?.originalUrl,
        aliado_relacionado,
        beneficiario_relacionado,
        servicio_relacionado,
        sucursal_relacionada,
        ticket_info,
      },
      usuario: req?.usuario
        ? {
            id: req.usuario._id,
            nombre_usuario: req.usuario.nombre_usuario,
            tipo: req.usuario.tipo,
            correo: req.usuario.correo,
          }
        : null,
      auditoria: auditoriaData,
      datos_extra,
    });

    console.log(`[BITÁCORA] ✅ Actividad registrada: ${tipo} - ${descripcion} - Criticidad: ${nivelCriticidad || 'auto'}`);
    return nuevaActividad;
  } catch (error) {
    console.error("[BITÁCORA] ❌ Error al registrar actividad:", error);
    return null;
  }
};