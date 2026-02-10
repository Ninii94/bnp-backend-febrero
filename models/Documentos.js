// models/Documento.js - Modelo actualizado para documentos de beneficiarios
import mongoose from "mongoose";

// Esquema para comentarios
const ComentarioSchema = new mongoose.Schema({
  texto: {
    type: String,
    required: true,
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
});

// Esquema para solicitudes de actualización
const SolicitudActualizacionSchema = new mongoose.Schema({
  motivo: {
    type: String,
    required: true,
  },
  detalles: String,
  fecha: {
    type: Date,
    default: Date.now,
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  estado: {
    type: String,
    enum: ["pendiente", "procesada", "rechazada"],
    default: "pendiente",
  },
  fecha_respuesta: Date,
  respuesta: String,
});

// Esquema principal de documento
const DocumentoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    enum: [
      "Pasaporte",
      "DNI",
      "Visa",
      "Contrato",
      "ContratoAliado",
      "IdentificacionAliado",
      "ComprobanteReserva",
      "ComprobantePago",
      "Otro",
    ],
  },
  nombre: String,
  numero: String,
  fecha_emision: {
    type: Date,
    required: true,
  },
  fecha_vencimiento: {
    type: Date,
    required: true,
  },
  pais: {
    type: String,
    required: true,
  },
  archivo: {
    nombre: String,
    mimetype: String,
    ruta: String,
    tamano: Number,
    url: String,
    view_url: String,
    download_url: String,
    fecha_subida: {
      type: Date,
      default: Date.now,
    },
  },
  beneficiario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Beneficiario",
    required: true,
  },
  equipo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Equipo",
    default: null,
  },
  compartido_con: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipo",
    },
  ],
  comentarios: [ComentarioSchema],
  revisado_por_equipo: {
    type: Boolean,
    default: false,
  },
  fecha_revision: Date,
  usuario_revision: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
  },
  requiere_actualizacion: {
    type: Boolean,
    default: false,
  },
  solicitudes_actualizacion: [SolicitudActualizacionSchema],
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  activo: {
    type: Boolean,
    default: true,
  },
  creado_en: {
    type: Date,
    default: Date.now,
  },
  actualizado_en: {
    type: Date,
    default: Date.now,
  },
});

// Métodos virtuales para determinar si el documento está vencido
DocumentoSchema.virtual("vencido").get(function () {
  if (!this.fecha_vencimiento) return false;
  return new Date(this.fecha_vencimiento) < new Date();
});

// Índices para búsquedas eficientes
DocumentoSchema.index({ beneficiario_id: 1 });
DocumentoSchema.index({ equipo_id: 1 });
DocumentoSchema.index({ creado_por: 1 });
DocumentoSchema.index({ tipo: 1 });
DocumentoSchema.index({ compartido_con: 1 });
DocumentoSchema.index({ revisado_por_equipo: 1 });
DocumentoSchema.index({ requiere_actualizacion: 1 });
DocumentoSchema.index({ fecha_vencimiento: 1 });

// Configurar para incluir virtuals al convertir a JSON
DocumentoSchema.set("toJSON", { virtuals: true });
DocumentoSchema.set("toObject", { virtuals: true });

export const Documento = mongoose.model("Documento", DocumentoSchema);
