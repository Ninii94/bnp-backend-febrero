import mongoose from "mongoose";

const contratoSchema = new mongoose.Schema({
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Aliado",
    required: true,
  },
  beneficiario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Beneficiario",
  },
  // Si el beneficiario no existe en el sistema - Estructura actualizada
  beneficiario_datos: {
    nombre: String,
    apellido: String,
    fecha_nacimiento: String,
    estado_civil: {
      type: String,
      enum: ["soltero", "casado", "divorciado", "viudo", "no especificado"],
      default: "no especificado",
    },
    profesion: String,
    telefono: String,
    telefono_residencial: String,
    correo: String,
    nacionalidad: String,
    direccion: String,
    estado_provincia: String,
    cep: String,
    pais: String,
    documento_identidad: {
      tipo: {
        type: String,
        enum: ["Pasaporte", "DNI", "CPF", "Visa", "Otro"],
      },
      numero: String,
    },
  },
  // Datos complementarios para cuando se usa un beneficiario existente
  datos_complementarios: {
    fecha_nacimiento: String,
    estado_civil: String,
    profesion: String,
    telefono_residencial: String,
    direccion_complementaria: String,
    estado_provincia: String,
    cep: String,
    pais: String,
    nacionalidad_complementaria: String,
  },
  razon_social: String,
  ruc: String,
  tipo_servicio: String,
  colaborador_bnp: String,
  numero_contrato: {
    type: String,
    unique: true,
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
  },
  fecha_firma: Date,
  estado: {
    type: String,
    enum: ["BORRADOR", "ENVIADO", "FIRMADO", "CANCELADO", "EXPIRADO"],
    default: "BORRADOR",
  },
  monto: {
    valor: {
      type: Number,
      required: true,
    },
    moneda: {
      type: String,
      enum: ["reales", "dolares"],
      default: "reales",
    },
  },
  enganche_pagado: {
    valor: {
      type: Number,
      default: 0,
    },
    moneda: {
      type: String,
      enum: ["reales", "dolares"],
      default: "reales",
    },
    fecha_pago: Date,
  },
  servicios_incluidos: [
    {
      type: String,
    },
  ],
  terminos_aceptados: {
    type: Boolean,
    default: false,
  },
  url_documento: String,
  firma_electronica: {
    id_sesion: String,
    url_firma: String,
    completado: {
      type: Boolean,
      default: false,
    },
    fecha_completado: Date,
  },
  historial: [
    {
      accion: {
        type: String,
        enum: [
          "CREACION",
          "ENVIO",
          "FIRMA",
          "MODIFICACION",
          "CANCELACION",
          "EXPIRACION",
        ],
        required: true,
      },
      fecha: {
        type: Date,
        default: Date.now,
      },
      usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
      },
      detalles: String,
    },
  ],
  fecha_vencimiento: {
    type: Date,
    default: function () {
      // Por defecto, 7 días desde la creación
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    },
  },
  metodo_pago: {
    tipo: {
      type: String,
      enum: ["Efectivo", "Tarjeta", "Transferencia", "Otro"],
      default: "Efectivo",
    },
    detalles: String,
  },
  notas: String,
  url_terminos_condiciones: {
    type: String,
    default: "/docs/terminos-condiciones.pdf",
  },
});

// Middleware para generar automáticamente el número de contrato
contratoSchema.pre("save", async function (next) {
  try {
    // Si ya tiene número de contrato, continuar
    if (this.numero_contrato) {
      return next();
    }

    const Contrato = mongoose.model("Contrato");
    const año = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;

    // Contar cuántos contratos hay en el mes actual para generar el secuencial
    const count = await Contrato.countDocuments({
      fecha_creacion: {
        $gte: new Date(año, mes - 1, 1),
        $lt: new Date(año, mes, 1),
      },
    });

    // Formato: CNT-AÑOMM-XXXX (Ej: CNT-202405-0001)
    const secuencial = (count + 1).toString().padStart(4, "0");
    this.numero_contrato = `CNT-${año}${mes
      .toString()
      .padStart(2, "0")}-${secuencial}`;

    next();
  } catch (error) {
    next(error);
  }
});

// Método para verificar si el contrato ha expirado
contratoSchema.methods.haExpirado = function () {
  if (
    this.estado === "FIRMADO" ||
    this.estado === "CANCELADO" ||
    this.estado === "EXPIRADO"
  ) {
    return false; // No aplica expiración para contratos ya completados o cancelados
  }

  return new Date() > this.fecha_vencimiento;
};

// Método para calcular el tiempo restante para expiración
contratoSchema.methods.tiempoRestante = function () {
  if (this.haExpirado()) {
    return { dias: 0, horas: 0, minutos: 0 };
  }

  const now = new Date();
  const diff = this.fecha_vencimiento - now;

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { dias, horas, minutos };
};

export const Contrato = mongoose.model("Contrato", contratoSchema);
