import mongoose from "mongoose";

const actividadBitacoraSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: [
        "aliado_creado",
        "aliado_actualizado",
        "aliado_eliminado",
        "informacion_actualizada",
        "servicios_actualizados",
        "colaborador_asignado",
        "beneficiario_creado",
        "beneficiario_actualizado",
        "beneficiario_eliminado",
        "beneficiario_asignado",
        "beneficiario_eliminado_seguimiento",
        "beneficiario_contactado_seguimiento",
        "servicio_asignado",
        "servicio_activado",
        "servicio_desactivado",
        "servicio_reactivado",
        "servicio_removido",
        "codigo_generado",
        "codigo_activado",
        "codigo_reactivado",
        "sucursal_creada",
        "sucursal_actualizada",
        "contrato_creado",
        "contrato_enviado",
        "contrato_firmado",
        "contrato_rechazado",
        "contrato_equipo_creado",
        "contrato_equipo_manual_subido",
        "contrato_equipo_enviado",
        "contrato_equipo_firmado",
        "contrato_equipo_rechazado",
        "contrato_beneficiario_creado",
        "contrato_beneficiario_firmado", 
        "contrato_beneficiario_enviado", 
        "contrato_beneficiario_rechazado",
        "contrato_beneficiario_manual_subido",
        "documento_subido",
        "comprobante_pago_subido",
        "ticket_creado",
        "ticket_creado_beneficiario",
        "ticket_creado_aliado",
        "ticket_beneficiario_creado",
        "ticket_beneficiario_calificado",
        "ticket_aliado_creado",
        "ticket_aliado_calificado",
        "ticket_equipo_creado",
        "ticket_estado_actualizado",
        "ticket_calificado",
        "ticket_eliminado",
        "notificacion_enviada",
        "solicitud_ayuda_bienvenida",
        "solicitud_enlace_pago_bienvenida",
        "enlace_pago_enviado",
            "fondo_creado",
             "financiamiento_creado",
        "financiamiento_estado_cambiado",
        "financiamiento_cuota_pagada",
        "financiamiento_cuota_morosa",
        "financiamiento_cuota_litigio",
        "financiamiento_liquidacion_anticipada",
        "reembolso_renovado",
        "reembolso_bloqueado",
        "reembolso_desbloqueado",
        "reembolso_aprobado",
        "reembolso_rechazado",
        "reembolso_solicitado",
        "chat_iniciado",
        "chat_finalizado",
        "login_usuario",
        "logout_usuario",
        "configuracion_cambiada",
        "backup_realizado",
        "error_sistema",
      ],
      required: true,
      index: true,
    },

    descripcion: {
      type: String,
      required: true,
      maxlength: 500,
    },

    metadata: {
      entidad_tipo: {
        type: String,
        enum: [
          "aliado",
          "beneficiario",
          "servicio",
          "usuario",
          "sucursal",
          "codigo",
          "documento",
          "contrato",
          "contrato_equipo",
          "contrato_beneficiario",
          "ticket",
          "notificacion",
          "financiamiento",
          "cuota",
          "reembolso",
          "fondo",
          "sistema",
         "reembolso",       
        "financiamiento",   
        "comprobante",    
        "perfil",           
        ],
        index: true,
      },
      entidad_id: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
      },
      entidad_nombre: String,

      datos_anteriores: mongoose.Schema.Types.Mixed,
      datos_nuevos: mongoose.Schema.Types.Mixed,
      parametros_accion: mongoose.Schema.Types.Mixed,

      ip_origen: String,
      user_agent: String,
      metodo_http: String,
      url_endpoint: String,
      codigo_respuesta: Number,
      tiempo_ejecucion: Number,

      aliado_relacionado: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Aliado",
        },
        nombre: String,
        correo: String,
      },
      beneficiario_relacionado: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Beneficiario",
        },
        nombre: String,
        codigo: String,
        correo: String,
      },
      servicio_relacionado: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Servicio",
        },
        nombre: String,
      },
      sucursal_relacionada: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Sucursal",
        },
        nombre: String,
      },
      financiamiento_relacionado: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Financiamiento",
        },
        numero_cuota: Number,
        estado_cuota: String,
      },
      fondo_relacionado: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Fondo",
        },
        tipo_fondo: String,
      },
      ticket_info: {
        fecha_creacion: Date,
        prioridad: String,
        categoria: String,
        estado: String,
      },
      contrato_info: {
        numero_contrato: String,
        tipo_contrato: String,
        fecha_inicio: Date,
        fecha_fin: Date,
        es_manual: Boolean,
        archivo_nombre: String,
      },
    },

    usuario: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        index: true,
      },
      nombre_usuario: String,
      tipo: {
        type: String,
        enum: ["aliado", "beneficiario", "equipo_bnp", "admin", "sistema"],
      },
      correo: String,
    },

    auditoria: {
      nivel_criticidad: {
        type: String,
        enum: ["bajo", "medio", "alto", "critico"],
        default: "bajo",
        index: true,
      },
      requiere_revision: {
        type: Boolean,
        default: false,
        index: true,
      },
      etiquetas: [String],
      notas_internas: String,

      es_error: {
        type: Boolean,
        default: false,
        index: true,
      },
      codigo_error: String,
      stack_trace: String,

      requiere_aprobacion: {
        type: Boolean,
        default: false,
      },
      aprobado_por: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
      },
      fecha_aprobacion: Date,
    },

    fecha_creacion: {
      type: Date,
      default: Date.now,
      index: true,
    },
    fecha_evento: {
      type: Date,
      default: Date.now,
      index: true,
    },

    activo: {
      type: Boolean,
      default: true,
      index: true,
    },
    archivado: {
      type: Boolean,
      default: false,
      index: true,
    },
    fecha_archivado: Date,

    datos_extra: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    collection: "actividades_bitacora",
  }
);

actividadBitacoraSchema.index({ fecha_creacion: -1, tipo: 1 });
actividadBitacoraSchema.index({ fecha_creacion: -1, "usuario.id": 1 });
actividadBitacoraSchema.index({
  fecha_creacion: -1,
  "metadata.entidad_tipo": 1,
});
actividadBitacoraSchema.index({
  fecha_creacion: -1,
  "auditoria.nivel_criticidad": 1,
});
actividadBitacoraSchema.index({
  "metadata.aliado_relacionado.id": 1,
  fecha_creacion: -1,
});
actividadBitacoraSchema.index({
  "metadata.beneficiario_relacionado.id": 1,
  fecha_creacion: -1,
});

actividadBitacoraSchema.index({
  descripcion: "text",
  "metadata.entidad_nombre": "text",
  "usuario.nombre_usuario": "text",
  "auditoria.notas_internas": "text",
});

actividadBitacoraSchema.pre("save", function (next) {
  if (!this.fecha_evento) {
    this.fecha_evento = this.fecha_creacion || new Date();
  }

  if (!this.descripcion && this.tipo) {
    this.descripcion = this.generarDescripcionAutomatica();
  }

  if (!this.auditoria) {
    this.auditoria = {};
  }

  if (!this.auditoria.nivel_criticidad) {
    this.auditoria.nivel_criticidad = this.determinarNivelCriticidad();
  }

  if (this.tipo === "error_sistema" || this.auditoria.codigo_error) {
    this.auditoria.es_error = true;
  }

  next();
});

actividadBitacoraSchema.methods.generarDescripcionAutomatica = function () {
  const entidadNombre = this.metadata?.entidad_nombre || "Sin nombre";
  const beneficiarioRelacionado = this.metadata?.beneficiario_relacionado;

  const descripciones = {
    aliado_creado: `Nuevo aliado registrado: ${entidadNombre}`,
    beneficiario_creado: `Nuevo beneficiario registrado: ${entidadNombre}`,
    servicio_asignado: `Servicio asignado: ${this.metadata?.servicio_relacionado?.nombre || "Servicio"}`,
    servicio_activado: `Servicio activado: ${this.metadata?.servicio_relacionado?.nombre || "Servicio"}${beneficiarioRelacionado ? ` para ${beneficiarioRelacionado.nombre}` : ""}`,
    servicio_desactivado: `Servicio desactivado: ${this.metadata?.servicio_relacionado?.nombre || "Servicio"}${beneficiarioRelacionado ? ` de ${beneficiarioRelacionado.nombre}` : ""}`,
    servicio_reactivado: `Servicio reactivado: ${this.metadata?.servicio_relacionado?.nombre || "Servicio"}${beneficiarioRelacionado ? ` para ${beneficiarioRelacionado.nombre}` : ""}`,
    servicio_removido: `Servicio removido: ${this.metadata?.servicio_relacionado?.nombre || "Servicio"}`,
    codigo_generado: `Código generado para: ${beneficiarioRelacionado?.nombre || "Beneficiario"}`,
    codigo_activado: `Código activado: ${beneficiarioRelacionado?.codigo || "Código"}`,
    codigo_reactivado: `Código reactivado: ${beneficiarioRelacionado?.codigo || "Código"}`,
    contrato_equipo_creado: `Contrato equipo creado para aliado: ${this.metadata?.aliado_relacionado?.nombre || "Aliado"}`,
    contrato_equipo_manual_subido: `Contrato equipo manual subido para aliado: ${this.metadata?.aliado_relacionado?.nombre || "Aliado"}`,
    contrato_beneficiario_creado: `Contrato beneficiario creado: ${beneficiarioRelacionado?.nombre || "Beneficiario"}`,
    contrato_beneficiario_manual_subido: `Contrato beneficiario manual subido: ${beneficiarioRelacionado?.nombre || "Beneficiario"}`,
    financiamiento_estado_cambiado: `Estado de financiamiento cambiado${beneficiarioRelacionado ? ` de ${beneficiarioRelacionado.nombre}` : ""}`,
    financiamiento_cuota_pagada: `Cuota marcada como pagada${beneficiarioRelacionado ? ` - ${beneficiarioRelacionado.nombre}` : ""}`,
    financiamiento_cuota_morosa: `Cuota marcada como morosa${beneficiarioRelacionado ? ` - ${beneficiarioRelacionado.nombre}` : ""}`,
    financiamiento_cuota_litigio: `Cuota marcada en litigio legal${beneficiarioRelacionado ? ` - ${beneficiarioRelacionado.nombre}` : ""}`,
    financiamiento_liquidacion_anticipada: `Liquidación anticipada aplicada${beneficiarioRelacionado ? ` - ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_renovado: `Fondo renovado${beneficiarioRelacionado ? ` para ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_bloqueado: `Fondo bloqueado${beneficiarioRelacionado ? ` de ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_desbloqueado: `Fondo desbloqueado${beneficiarioRelacionado ? ` de ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_aprobado: `Reembolso aprobado${beneficiarioRelacionado ? ` para ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_rechazado: `Reembolso rechazado${beneficiarioRelacionado ? ` de ${beneficiarioRelacionado.nombre}` : ""}`,
    reembolso_solicitado: `Reembolso solicitado${beneficiarioRelacionado ? ` por ${beneficiarioRelacionado.nombre}` : ""}`,
    comprobante_pago_subido: `Comprobante de pago subido${beneficiarioRelacionado ? ` por ${beneficiarioRelacionado.nombre}` : ""}`,
    login_usuario: `Usuario inició sesión: ${this.usuario?.nombre_usuario || "Usuario"}`,
    logout_usuario: `Usuario cerró sesión: ${this.usuario?.nombre_usuario || "Usuario"}`,
    error_sistema: `Error del sistema: ${this.auditoria?.codigo_error || "Error no especificado"}`,
  };

  return descripciones[this.tipo] || `Actividad ${this.tipo} realizada`;
};

actividadBitacoraSchema.methods.determinarNivelCriticidad = function () {
  const prioridad = this.metadata?.datos_nuevos?.prioridad || 
                    this.metadata?.ticket_info?.prioridad;
  
  if (this.tipo.includes('ticket') && this.tipo.includes('creado')) {
    if (prioridad === 'Crítica' || prioridad === 'Alta') {
      return 'alto';
    }
    if (prioridad === 'Media' || prioridad === 'Baja') {
      return 'medio';
    }
  }

  const criticidadPorTipo = {
    error_sistema: "critico",
    aliado_eliminado: "alto",
    beneficiario_eliminado: "alto",
    codigo_activado: "alto",
    codigo_reactivado: "alto",
    configuracion_cambiada: "alto",
    contrato_rechazado: "alto",
    contrato_equipo_rechazado: "alto",
    contrato_equipo_creado: "alto",
    contrato_equipo_manual_subido: "alto",
    contrato_beneficiario_creado: "alto",
    contrato_beneficiario_manual_subido: "alto",
    solicitud_ayuda_bienvenida: "alto",
    financiamiento_estado_cambiado: "alto",
    financiamiento_cuota_litigio: "critico",
    financiamiento_cuota_morosa: "alto",
    financiamiento_liquidacion_anticipada: "alto",
    reembolso_bloqueado: "alto",
    ticket_estado_actualizado: "bajo",
    ticket_calificado: "bajo",
    ticket_beneficiario_calificado: "bajo",
    ticket_aliado_calificado: "bajo",
    aliado_creado: "medio",
    beneficiario_creado: "medio",
    codigo_generado: "medio",
    contrato_creado: "medio",
    contrato_enviado: "medio",
    contrato_firmado: "medio",
    contrato_equipo_enviado: "medio",
    contrato_equipo_firmado: "medio",
    servicio_activado: "medio",
    servicio_desactivado: "medio",
    servicio_reactivado: "medio",
    financiamiento_cuota_pagada: "medio",
    reembolso_renovado: "medio",
    reembolso_desbloqueado: "medio",
    reembolso_aprobado: "medio",
    reembolso_rechazado: "medio",
    reembolso_solicitado: "medio",
    comprobante_pago_subido: "medio",
    servicio_asignado: "bajo",
    servicio_removido: "bajo",
    login_usuario: "bajo",
    logout_usuario: "bajo",
    chat_iniciado: "bajo",
    chat_finalizado: "bajo",
    solicitud_enlace_pago_bienvenida: "medio",
    enlace_pago_enviado: "bajo",
  };

  return criticidadPorTipo[this.tipo] || "bajo";
};

actividadBitacoraSchema.methods.marcarComoRevisado = function (usuarioId) {
  this.auditoria.requiere_revision = false;
  this.auditoria.aprobado_por = usuarioId;
  this.auditoria.fecha_aprobacion = new Date();
  return this.save();
};

actividadBitacoraSchema.methods.archivar = function () {
  this.archivado = true;
  this.fecha_archivado = new Date();
  return this.save();
};

actividadBitacoraSchema.statics.crearActividad = async function (datos) {
  try {
    const actividad = new this(datos);
    await actividad.save();
    return actividad;
  } catch (error) {
    console.error("Error al crear actividad de bitácora:", error);
    throw error;
  }
};

actividadBitacoraSchema.statics.obtenerEstadisticas = async function (
  filtros = {}
) {
  const hoy = new Date();
  const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioAno = new Date(hoy.getFullYear(), 0, 1);

  const condicionesBase = { activo: true, ...filtros };

  const estadisticas = await Promise.all([
    this.countDocuments(condicionesBase),

    this.countDocuments({
      ...condicionesBase,
      fecha_creacion: { $gte: inicioSemana },
    }),
    this.countDocuments({
      ...condicionesBase,
      fecha_creacion: { $gte: inicioMes },
    }),
    this.countDocuments({
      ...condicionesBase,
      fecha_creacion: { $gte: inicioAno },
    }),

    this.aggregate([
      { $match: condicionesBase },
      { $group: { _id: "$tipo", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    this.aggregate([
      { $match: condicionesBase },
      { $group: { _id: "$auditoria.nivel_criticidad", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    this.countDocuments({
      ...condicionesBase,
      "auditoria.requiere_revision": true,
    }),

    this.countDocuments({ ...condicionesBase, "auditoria.es_error": true }),

    this.aggregate([
      { $match: condicionesBase },
      {
        $group: {
          _id: "$usuario.id",
          nombre: { $first: "$usuario.nombre_usuario" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    this.aggregate([
      {
        $match: {
          ...condicionesBase,
          "metadata.aliado_relacionado.id": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$metadata.aliado_relacionado.id",
          nombre: { $first: "$metadata.aliado_relacionado.nombre" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return {
    resumen: {
      total: estadisticas[0],
      semana: estadisticas[1],
      mes: estadisticas[2],
      año: estadisticas[3],
    },
    por_tipo: estadisticas[4],
    por_criticidad: estadisticas[5],
    requieren_revision: estadisticas[6],
    errores: estadisticas[7],
    usuarios_activos: estadisticas[8],
    aliados_activos: estadisticas[9],
  };
};

actividadBitacoraSchema.statics.obtenerActividadesRecientes = async function (
  limite = 10,
  filtros = {}
) {
  return this.find({ activo: true, ...filtros })
    .sort({ fecha_creacion: -1 })
    .limit(limite)
    .populate("usuario.id", "nombre_usuario correo")
    .populate("metadata.aliado_relacionado.id", "nombre")
    .populate("metadata.beneficiario_relacionado.id", "nombre apellido")
    .populate("metadata.servicio_relacionado.id", "nombre");
};

actividadBitacoraSchema.statics.buscarActividades = async function (
  termino,
  opciones = {}
) {
  const {
    limite = 50,
    tipo = null,
    fechaDesde = null,
    fechaHasta = null,
  } = opciones;

  const filtros = {
    activo: true,
    $text: { $search: termino },
  };

  if (tipo) filtros.tipo = tipo;
  if (fechaDesde) filtros.fecha_creacion = { $gte: new Date(fechaDesde) };
  if (fechaHasta) {
    filtros.fecha_creacion = {
      ...filtros.fecha_creacion,
      $lte: new Date(fechaHasta),
    };
  }

  return this.find(filtros, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, fecha_creacion: -1 })
    .limit(limite);
};

actividadBitacoraSchema.statics.limpiarActividadesAntiguas = async function (
  diasAntiguedad = 365
) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

  const resultado = await this.updateMany(
    {
      fecha_creacion: { $lt: fechaLimite },
      "auditoria.nivel_criticidad": { $in: ["bajo", "medio"] },
      archivado: false,
    },
    {
      $set: {
        archivado: true,
        fecha_archivado: new Date(),
      },
    }
  );

  return resultado;
};

export const ActividadBitacora = mongoose.model(
  "ActividadBitacora",
  actividadBitacoraSchema
);