import mongoose from "mongoose";

const contratoEquipoSchema = new mongoose.Schema(
  {
    tipo_plantilla: {
      type: String,
      enum: ["tipo_a", "tipo_b", "tipo_c"],
      default: "tipo_a",
      required: true,
      index: true,
    },
    aliado_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aliado",
      required: true,
    },
    fecha_inicio: {
      type: Date,
      required: true,
    },
    fecha_fin: {
      type: Date,
      required: true,
    },
    observaciones: String,
    terminos_condiciones: {
      type: String,
      required: true,
    },
    estado: {
      type: String,
      enum: ["enviado", "firmado", "rechazado", "vencido"],
      default: "enviado",
    },
    fecha_envio: {
      type: Date,
      default: Date.now,
    },
    fecha_firma: Date,
    contrato_firmado: {
      nombre: String,
      url: String,
      ruta: String,
      hash: String,
      tamano: Number,
    },

    validez_legal: {
      hash_documento: {
        type: String,
        default: null,
        required: false,
      },
      timestamp: {
        type: Date,
        default: null,
        required: false,
      },
      ip_firma: {
        type: String,
        default: null,
        required: false,
      },
      user_agent: {
        type: String,
        default: null,
        required: false,
      },
      verificado: {
        type: Boolean,
        default: false,
      },
    },
    motivo_rechazo: String,
    email_enviado: {
      type: Boolean,
      default: false,
    },
    token_firma: String,
    creado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para optimizar consultas
contratoEquipoSchema.index({ aliado_id: 1 });
contratoEquipoSchema.index({ estado: 1 });
contratoEquipoSchema.index({ token_firma: 1 });
contratoEquipoSchema.index({ creado_por: 1 });
contratoEquipoSchema.index({ tipo_plantilla: 1 }); 

export const ContratoEquipo = mongoose.model(
  "ContratoEquipo",
  contratoEquipoSchema
);