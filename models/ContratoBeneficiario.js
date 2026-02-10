import mongoose from "mongoose";
const versionDocumentoSchema = new mongoose.Schema({
  version_numero: {
    type: Number,
    required: true,
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
  },
  archivo: {
    nombre: String,
    url: String,
    ruta: String,
    tamano: Number,
    hash_sha256: String,
  },
  validez_legal_brasil: {
    hash_archivo: String,
    timestamp_upload: Date,
    ip_origen: String,
    usuario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
    },
    pais_jurisdiccion: {
      type: String,
      default: "BR",
    },
    cumple_lgpd: {
      type: Boolean,
      default: true,
    },
    certificado_integridad: {
      type: Boolean,
      default: true,
    },
    hash_version_anterior: String,
  },
  metadata: {
    tipo_operacion: {
      type: String,
      enum: ["CREACION_INICIAL", "ACTUALIZACION"],
      required: true,
    },
    motivo: String,
    usuario_modificador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
    },
    version_anterior: Number,
  },
});


const contratoBeneficiarioSchema = new mongoose.Schema(
  {
    // Referencia al aliado
    aliado_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aliado",
      required: true,
    },
    // Referencia al beneficiario
    beneficiario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beneficiario",
      required: true,
    },
    // Número de contrato
    numero_contrato: {
      type: String,
      unique: true,
    },
    // ✅ NUEVO: Tipo de contrato
    tipo_contrato: {
      type: String,
      enum: ["contrato_entradaflex", "contrato_flyback", "contrato_refund360"],
      required: true,
    },
    // ✅ NUEVO: Configuración del tipo de contrato
    tipo_contrato_config: {
      nombre: String,
      descripcion: String,
      emoji: String,
      color: String,
    },
    // ✅ NUEVO: PDF de términos predefinido
    pdf_terminos: {
      nombre: String,
      url: String,
      ruta: String,
    },
    // ✅ NUEVO: Template de EmailJS
    template_emailjs: String,
    // Datos del contrato
    monto: {
      valor: {
        type: Number,
        required: true,
      },
      moneda: {
        type: String,
        enum: ["USD", "BRL", "EUR", "PEN"],
        default: "USD",
      },
    },
    metodo_pago: {
      tipo: {
        type: String,
        enum: ["Efectivo", "Tarjeta", "Transferencia", "Cheque"],
        default: "Efectivo",
      },
      detalles: String,
    },
    fecha_inicio: {
      type: Date,
      required: true,
    },
    fecha_fin: {
      type: Date,
      required: true,
    },
    // Estado del contrato
    estado: {
   type: String,
    enum: ["borrador", "enviado", "firmado", "rechazado", "cancelado", "expirado"],
    default: "borrador",
  },
   fecha_rechazo: {
    type: Date,
  },
    // ❌ ELIMINADO: terminos_condiciones en texto
    // Solo usamos PDFs predefinidos
    observaciones: String,
    // Información de firma
    fecha_envio: Date,
    fecha_firma: Date,
    token_firma: String,
    // Archivo del contrato firmado
    contrato_firmado: {
      nombre: String,
      url: String,
      ruta: String,
      hash: String,
      tamano: Number,
      fecha_subida: Date,
    },
    // Validez legal
    validez_legal: {
    hash_documento: String,
    timestamp: Date,
    ip_firma: String,
    user_agent: String,
    verificado: {
      type: Boolean,
      default: false,
    },
    es_contrato_manual: {
      type: Boolean,
      default: false,
    },
    version_actual: {
      type: Number,
      default: 1,
    },
  },
    // Historial de cambios
    historial: [
      {
        accion: {
          type: String,
          enum: [
            "CREACION",
            "MODIFICACION",
            "ENVIO",
             "RECHAZO",
            "FIRMA",
            "EMAIL_ENVIADO",
            "CANCELACION",
            "VENCIMIENTO",
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
    // Información de rechazo
    motivo_rechazo: String,
    fecha_rechazo: Date,
    // Email enviado
    email_enviado: {
      type: Boolean,
      default: false,
    },
    // Usuario creador
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

// Middleware para generar número único
contratoBeneficiarioSchema.pre("save", async function (next) {
  if (this.isNew && !this.numero_contrato) {
    let numeroUnico = false;
    let intentos = 0;
    const maxIntentos = 10;

    while (!numeroUnico && intentos < maxIntentos) {
      try {
        const year = new Date().getFullYear();
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const numeroSecuencial = `${timestamp}${random}`.slice(-6);
        const numeroContrato = `CB-${year}-${numeroSecuencial.padStart(6, "0")}`;

        const existe = await mongoose.model("ContratoBeneficiario").findOne({
          numero_contrato: numeroContrato,
        });

        if (!existe) {
          this.numero_contrato = numeroContrato;
          numeroUnico = true;
        }

        intentos++;
      } catch (error) {
        console.error(`Error en intento ${intentos + 1}:`, error);
        intentos++;
      }
    }

    if (!numeroUnico) {
      const year = new Date().getFullYear();
      const timestampFallback = Date.now();
      const randomFallback = Math.floor(Math.random() * 100000);
      this.numero_contrato = `CB-${year}-${timestampFallback}${randomFallback}`;
    }
  }
  next();
});

// Índices
contratoBeneficiarioSchema.index({ aliado_id: 1 });
contratoBeneficiarioSchema.index({ beneficiario_id: 1 });
contratoBeneficiarioSchema.index({ estado: 1 });
contratoBeneficiarioSchema.index({ numero_contrato: 1 });
contratoBeneficiarioSchema.index({ token_firma: 1 });
contratoBeneficiarioSchema.index({ tipo_contrato: 1 });

// Métodos
contratoBeneficiarioSchema.methods.puedeSerModificado = function () {
  return ["borrador", "enviado"].includes(this.estado);
};

contratoBeneficiarioSchema.methods.puedeSerFirmado = function () {
  return this.estado === "enviado" && this.token_firma;
};

contratoBeneficiarioSchema.methods.estaVencido = function () {
  return (
    this.fecha_fin && new Date() > this.fecha_fin && this.estado !== "firmado"
  );
};

export const ContratoBeneficiario = mongoose.model(
  "ContratoBeneficiario",
  contratoBeneficiarioSchema
);