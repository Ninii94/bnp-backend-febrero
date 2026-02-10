import mongoose from "mongoose";

const terminosCondicionesEquipoSchema = new mongoose.Schema(
  {
    // 🔥 Tipo de plantilla para diferenciar contratos
    tipo_plantilla: {
      type: String,
      enum: ["tipo_a", "tipo_b", "tipo_c", "general"],
      default: "general",
      index: true,
    },

    // ✅ CAMPO CORREGIDO: Contenido en texto (con validación condicional)
    contenido: {
      type: String,
      default: "",
      // ✅ Validación condicional: contenido O PDF deben existir
      validate: {
        validator: function(v) {
          // Si hay PDF, contenido puede estar vacío
          if (this.pdf_terminos && this.pdf_terminos.url) {
            return true;
          }
          // Si no hay PDF, contenido debe tener valor
          return v && v.trim().length > 0;
        },
        message: 'Debe haber contenido de texto o un PDF adjunto'
      }
    },

    // 🔥 PDF de términos y condiciones
    pdf_terminos: {
      nombre: String,
      url: String,
      ruta: String,
      hash: String,
      tamano: Number,
      fecha_subida: {
        type: Date,
        default: Date.now,
      },
    },

    // ✅ Versión
    version: {
      type: Number,
      default: 1,
    },

    // ✅ Activo
    activo: {
      type: Boolean,
      default: true,
    },

    // ✅ Creado por
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
terminosCondicionesEquipoSchema.index({ tipo_plantilla: 1, activo: 1 });
terminosCondicionesEquipoSchema.index({ creado_por: 1 });
terminosCondicionesEquipoSchema.index({ version: 1 });

// Método para incrementar versión
terminosCondicionesEquipoSchema.methods.incrementarVersion = function () {
  this.version += 1;
  return this.save();
};

export const TerminosCondicionesEquipo = mongoose.model(
  "TerminosCondicionesEquipo",
  terminosCondicionesEquipoSchema
);