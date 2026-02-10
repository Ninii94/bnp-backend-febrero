import mongoose from "mongoose";

const solicitudEnlaceSchema = new mongoose.Schema(
  {
    beneficiario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beneficiario",
      required: true,
    },
    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    servicios_solicitados: [
      {
        servicio_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Servicio",
        },
        nombre_servicio: String,
        descripcion: String,
      },
    ],
    estado: {
      type: String,
      enum: ["pendiente", "enviado", "rechazado", "cancelado"],
      default: "pendiente",
    },
    fecha_solicitud: {
      type: Date,
      default: Date.now,
    },
    fecha_envio: {
      type: Date,
    },
    notas_usuario: {
      type: String,
    },
    mensaje_enviado: {
      type: String,
    },
    link_pago: {
      type: String,
    },
    procesado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
    },
  },
  {
    timestamps: true,
  }
);

solicitudEnlaceSchema.index({ beneficiario_id: 1 });
solicitudEnlaceSchema.index({ usuario_id: 1 });
solicitudEnlaceSchema.index({ estado: 1 });
solicitudEnlaceSchema.index({ fecha_solicitud: -1 });

export const SolicitudEnlace = mongoose.model(
  "SolicitudEnlace",
  solicitudEnlaceSchema
);