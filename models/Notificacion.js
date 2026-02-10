import mongoose from "mongoose";

const notificacionSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true,
  },
  mensaje: {
    type: String,
    required: true,
    trim: true,
  },
  tipo: {
    type: String,
    enum: ["INFO", "ALERTA", "PROMO", "IMPORTANTE"],
    default: "INFO",
  },
  metadatos: {
    type: Object,
    default: {},
  },
  global: {
    type: Boolean,
    default: false,
  },
  emisor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  nombreEmisor: {
    type: String,
    default: "Sistema",
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
  },
  receptores: [
    {
      beneficiario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Beneficiario",
      },
      aliado_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Aliado",
      },
      leida: {
        type: Boolean,
        default: false,
      },
      fecha_leida: Date,
    },
  ],
  // Campo para distinguir el tipo de receptor
  tipoReceptor: {
    type: String,
    enum: ["beneficiario", "aliado"],
    default: "beneficiario",
  },
  // Nuevo campo para expiración automática
  expiracion: {
    type: Date,
    default: null,
  },
  activo: {
    type: Boolean,
    default: true,
  },
});

// Método estático para crear notificación global para beneficiarios
notificacionSchema.statics.crearNotificacionGlobal = async function (
  datosNotificacion,
  emisorId
) {
  try {
    // Obtener todos los IDs de beneficiarios
    const beneficiarios = await mongoose.model("Beneficiario").find({}, "_id");

    // Crear array de receptores
    const receptores = beneficiarios.map((b) => ({
      beneficiario_id: b._id,
      leida: false,
    }));

    // Crear la notificación
    const notificacion = await this.create({
      ...datosNotificacion,
      emisor_id: emisorId,
      fecha_creacion: new Date(),
      receptores,
      global: true,
      activo: true,
      tipoReceptor: "beneficiario",
    });

    return notificacion;
  } catch (error) {
    console.error("Error al crear notificación global:", error);
    throw error;
  }
};

// Método estático para crear notificación global para aliados
notificacionSchema.statics.crearNotificacionGlobalAliados = async function (
  datosNotificacion,
  emisorId
) {
  try {
    // Obtener todos los IDs de aliados
    const aliados = await mongoose.model("Aliado").find({}, "_id");

    // Crear array de receptores
    const receptores = aliados.map((a) => ({
      aliado_id: a._id,
      leida: false,
    }));

    // Crear la notificación
    const notificacion = await this.create({
      ...datosNotificacion,
      emisor_id: emisorId,
      fecha_creacion: new Date(),
      receptores,
      global: true,
      activo: true,
      tipoReceptor: "aliado",
    });

    return notificacion;
  } catch (error) {
    console.error("Error al crear notificación global para aliados:", error);
    throw error;
  }
};

// Método estático para crear notificación específica para beneficiario
notificacionSchema.statics.crearNotificacionEspecifica = async function (
  datosNotificacion,
  emisorId,
  beneficiarioId
) {
  try {
    // Crear la notificación
    const notificacion = await this.create({
      ...datosNotificacion,
      emisor_id: emisorId,
      fecha_creacion: new Date(),
      receptores: [
        {
          beneficiario_id: beneficiarioId,
          leida: false,
        },
      ],
      global: false,
      activo: true,
      tipoReceptor: "beneficiario",
    });

    return notificacion;
  } catch (error) {
    console.error("Error al crear notificación específica:", error);
    throw error;
  }
};

// Método estático para crear notificación específica para aliado
notificacionSchema.statics.crearNotificacionEspecificaAliado = async function (
  datosNotificacion,
  emisorId,
  aliadoId
) {
  try {
    // Crear la notificación
    const notificacion = await this.create({
      ...datosNotificacion,
      emisor_id: emisorId,
      fecha_creacion: new Date(),
      receptores: [
        {
          aliado_id: aliadoId,
          leida: false,
        },
      ],
      global: false,
      activo: true,
      tipoReceptor: "aliado",
    });

    return notificacion;
  } catch (error) {
    console.error("Error al crear notificación específica para aliado:", error);
    throw error;
  }
};

// Método para obtener notificaciones de un beneficiario (paginadas)
notificacionSchema.statics.obtenerNotificacionesBeneficiario = async function (
  beneficiarioId,
  pagina = 1,
  limite = 10
) {
  try {
    // Calcular offset para paginación
    const skip = (pagina - 1) * limite;

    // Buscar notificaciones donde el beneficiario es receptor y la notificación está activa
    const notificaciones = await this.find(
      {
        "receptores.beneficiario_id": beneficiarioId,
        activo: true,
        tipoReceptor: "beneficiario",
      },
      {
        titulo: 1,
        mensaje: 1,
        tipo: 1,
        metadatos: 1,
        global: 1,
        nombreEmisor: 1,
        fecha_creacion: 1,
        expiracion: 1,
        "receptores.$": 1, // Solo devolver el elemento del array que coincide con el beneficiario
      }
    )
      .sort({ fecha_creacion: -1 }) // Ordenar por fecha descendente
      .skip(skip)
      .limit(limite)
      .lean(); // Convertir a objetos planos para mejor rendimiento

    // Transformar el resultado para mostrar solo lo que necesita el frontend
    return notificaciones.map((n) => ({
      _id: n._id,
      titulo: n.titulo,
      mensaje: n.mensaje,
      tipo: n.tipo,
      metadatos: n.metadatos,
      fecha: n.fecha_creacion,
      leida: n.receptores[0].leida,
      leido: n.receptores[0].leida,
      fecha_leida: n.receptores[0].fecha_leida,
      emisor: n.nombreEmisor,
      expiracion: n.expiracion,
    }));
  } catch (error) {
    console.error("Error al obtener notificaciones del beneficiario:", error);
    throw error;
  }
};

// Método para obtener notificaciones de un aliado (paginadas)
notificacionSchema.statics.obtenerNotificacionesAliado = async function (
  aliadoId,
  pagina = 1,
  limite = 10
) {
  try {
    // Calcular offset para paginación
    const skip = (pagina - 1) * limite;

    // Buscar notificaciones donde el aliado es receptor y la notificación está activa
    const notificaciones = await this.find(
      {
        "receptores.aliado_id": aliadoId,
        activo: true,
        tipoReceptor: "aliado",
      },
      {
        titulo: 1,
        mensaje: 1,
        tipo: 1,
        metadatos: 1,
        global: 1,
        nombreEmisor: 1,
        fecha_creacion: 1,
        expiracion: 1,
        "receptores.$": 1, // Solo devolver el elemento del array que coincide con el aliado
      }
    )
      .sort({ fecha_creacion: -1 }) // Ordenar por fecha descendente
      .skip(skip)
      .limit(limite)
      .lean(); // Convertir a objetos planos para mejor rendimiento

    // Transformar el resultado para mostrar solo lo que necesita el frontend
    return notificaciones.map((n) => ({
      _id: n._id,
      titulo: n.titulo,
      mensaje: n.mensaje,
      tipo: n.tipo,
      metadatos: n.metadatos,
      fecha: n.fecha_creacion,
      leida: n.receptores[0].leida,
      leido: n.receptores[0].leida,
      fecha_leida: n.receptores[0].fecha_leida,
      emisor: n.nombreEmisor,
      expiracion: n.expiracion,
    }));
  } catch (error) {
    console.error("Error al obtener notificaciones del aliado:", error);
    throw error;
  }
};

// Método para marcar una notificación como leída (para beneficiario)
notificacionSchema.statics.marcarLeida = async function (
  notificacionId,
  beneficiarioId
) {
  try {
    console.log("Marcando notificación como leída:", {
      notificacionId,
      beneficiarioId: beneficiarioId.toString(),
    });

    // Convertir IDs a ObjectId para asegurar comparación correcta
    const notifId = new mongoose.Types.ObjectId(notificacionId);
    const benId = new mongoose.Types.ObjectId(beneficiarioId);

    // Primero, verificar si la notificación y el receptor existen
    const notificacion = await this.findOne({
      _id: notifId,
      "receptores.beneficiario_id": benId,
      tipoReceptor: "beneficiario",
    });

    if (!notificacion) {
      console.log(
        "No se encontró la notificación o el beneficiario no es receptor"
      );
      return false;
    }

    // Usar updateOne con un filtro más específico
    const resultado = await this.updateOne(
      {
        _id: notifId,
        "receptores.beneficiario_id": benId,
      },
      {
        $set: {
          "receptores.$.leida": true,
          "receptores.$.fecha_leida": new Date(),
        },
      }
    );

    console.log("Resultado de actualización:", resultado);

    // Verificar el resultado directo de la operación
    if (resultado.modifiedCount === 0) {
      console.log("No se modificó ningún documento");
      return false;
    }

    // Para verificar, buscar de nuevo la notificación
    const verificacion = await this.findOne({
      _id: notifId,
      "receptores.beneficiario_id": benId,
    });

    const receptor = verificacion.receptores.find(
      (r) => r.beneficiario_id.toString() === benId.toString()
    );

    console.log("Estado después de actualizar:", receptor.leida);

    return receptor.leida === true;
  } catch (error) {
    console.error("Error al marcar notificación como leída:", error);
    throw error;
  }
};

// Método para marcar una notificación como leída (para aliado)
notificacionSchema.statics.marcarLeidaAliado = async function (
  notificacionId,
  aliadoId
) {
  try {
    console.log("Marcando notificación como leída (aliado):", {
      notificacionId,
      aliadoId: aliadoId.toString(),
    });

    // Convertir IDs a ObjectId para asegurar comparación correcta
    const notifId = new mongoose.Types.ObjectId(notificacionId);
    const aId = new mongoose.Types.ObjectId(aliadoId);

    // Primero, verificar si la notificación y el receptor existen
    const notificacion = await this.findOne({
      _id: notifId,
      "receptores.aliado_id": aId,
      tipoReceptor: "aliado",
    });

    if (!notificacion) {
      console.log("No se encontró la notificación o el aliado no es receptor");
      return false;
    }

    // Usar updateOne con un filtro más específico
    const resultado = await this.updateOne(
      {
        _id: notifId,
        "receptores.aliado_id": aId,
      },
      {
        $set: {
          "receptores.$.leida": true,
          "receptores.$.fecha_leida": new Date(),
        },
      }
    );

    console.log("Resultado de actualización:", resultado);

    // Verificar el resultado directo de la operación
    if (resultado.modifiedCount === 0) {
      console.log("No se modificó ningún documento");
      return false;
    }

    // Para verificar, buscar de nuevo la notificación
    const verificacion = await this.findOne({
      _id: notifId,
      "receptores.aliado_id": aId,
    });

    const receptor = verificacion.receptores.find(
      (r) => r.aliado_id.toString() === aId.toString()
    );

    console.log("Estado después de actualizar:", receptor.leida);

    return receptor.leida === true;
  } catch (error) {
    console.error("Error al marcar notificación como leída (aliado):", error);
    throw error;
  }
};

// Método para marcar todas las notificaciones como leídas (para beneficiario)
notificacionSchema.statics.marcarTodasLeidas = async function (beneficiarioId) {
  try {
    const resultado = await this.updateMany(
      {
        "receptores.beneficiario_id": beneficiarioId,
        "receptores.leida": false,
        activo: true,
        tipoReceptor: "beneficiario",
      },
      {
        $set: {
          "receptores.$[elem].leida": true,
          "receptores.$[elem].fecha_leida": new Date(),
        },
      },
      {
        arrayFilters: [{ "elem.beneficiario_id": beneficiarioId }],
      }
    );

    return resultado.modifiedCount;
  } catch (error) {
    console.error(
      "Error al marcar todas las notificaciones como leídas:",
      error
    );
    throw error;
  }
};

// Método para marcar todas las notificaciones como leídas (para aliado)
notificacionSchema.statics.marcarTodasLeidasAliado = async function (aliadoId) {
  try {
    const resultado = await this.updateMany(
      {
        "receptores.aliado_id": aliadoId,
        "receptores.leida": false,
        activo: true,
        tipoReceptor: "aliado",
      },
      {
        $set: {
          "receptores.$[elem].leida": true,
          "receptores.$[elem].fecha_leida": new Date(),
        },
      },
      {
        arrayFilters: [{ "elem.aliado_id": aliadoId }],
      }
    );

    return resultado.modifiedCount;
  } catch (error) {
    console.error(
      "Error al marcar todas las notificaciones como leídas (aliado):",
      error
    );
    throw error;
  }
};

// Método para contar notificaciones no leídas (para beneficiario)
notificacionSchema.statics.contarNoLeidas = async function (beneficiarioId) {
  try {
    const resultado = await this.countDocuments({
      "receptores.beneficiario_id": beneficiarioId,
      "receptores.leida": false,
      activo: true,
      tipoReceptor: "beneficiario",
    });

    return resultado;
  } catch (error) {
    console.error("Error al contar notificaciones no leídas:", error);
    throw error;
  }
};

// Método para contar notificaciones no leídas (para aliado)
notificacionSchema.statics.contarNoLeidasAliado = async function (aliadoId) {
  try {
    const resultado = await this.countDocuments({
      "receptores.aliado_id": aliadoId,
      "receptores.leida": false,
      activo: true,
      tipoReceptor: "aliado",
    });

    return resultado;
  } catch (error) {
    console.error("Error al contar notificaciones no leídas (aliado):", error);
    throw error;
  }
};

export const Notificacion = mongoose.model("Notificacion", notificacionSchema);
