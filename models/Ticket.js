import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    categoria: {
      type: String,
      required: true,
      enum: [
        "Técnico",
        "Promoción",
        "Servicio al Cliente",
        "Financiero",
        "Legal",
        "Otro",
      ],
    },
    subcategoria: {
      type: String,
      required: true,
    },
    aliado_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    equipo_creador_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    beneficiario_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    estado: {
      type: String,
      required: true,
      enum: [
        "Nuevo",
        "Esperando Respuesta",
        "En Proceso",
        "Resuelto",
        "No Resuelto",
        "Cerrado",
      ],
      default: "Esperando Respuesta",
    },
    prioridad: {
      type: String,
      required: true,
      enum: ["Baja", "Media", "Alta", "Crítica"],
      default: "Media",
    },
    fecha_creacion: {
      type: Date,
      default: Date.now,
    },
    ultima_actualizacion: {
      type: Date,
      default: Date.now,
    },
    // CORREGIDO: Solo una definición de correo_contacto, y como campo opcional
    correo_contacto: {
      type: String,
      required: false,
      validate: {
        validator: function (email) {
          // Solo validar si el email existe y no está vacío
          if (!email || email.trim() === "") return true;
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: (props) => `${props.value} no es un correo electrónico válido`,
      },
    },
    satisfaccion: {
      calificacion: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      comentario: {
        type: String,
        default: null,
      },
      fecha_calificacion: {
        type: Date,
        default: null,
      },
    },

    tiempos_respuesta: {
      inicio: {
        type: Date,
        default: Date.now,
      },
      resolucion: {
        type: Date,
        default: null,
      },
    },

    metricas: {
      tiempo_resolucion: {
        minutos: {
          type: Number,
          default: 0,
        },
        horas: {
          type: Number,
          default: 0,
        },
        dias: {
          type: Number,
          default: 0,
        },
        semanas: {
          type: Number,
          default: 0,
        },
      },
      numero_interacciones: {
        type: Number,
        default: 0,
      },
      reabierto: {
        type: Boolean,
        default: false,
      },
      veces_reabierto: {
        type: Number,
        default: 0,
      },
    },

    encuesta: {
      enviada: {
        type: Boolean,
        default: false,
      },
      fecha_envio: {
        type: Date,
        default: null,
      },
    },

    seguimiento: [
      {
        mensaje: String,
        fecha: {
          type: Date,
          default: Date.now,
        },
        estado_anterior: String,
        estado_nuevo: String,
        interno: Boolean,
      },
    ],
  },
  {
    timestamps: true,
  }
);

ticketSchema.pre("save", function (next) {
  console.log("Pre-save hook ejecutado para ticket:", this._id);
  console.log("Estado actual antes de procesar:", this.estado);

  // Inicializar metricas si no existen
  if (!this.metricas) {
    this.metricas = {
      tiempo_resolucion: {
        minutos: 0,
        horas: 0,
        dias: 0,
        semanas: 0,
      },
      numero_interacciones: 0,
      reabierto: false,
      veces_reabierto: 0,
    };
  }

  // Inicializar seguimiento si no existe
  if (!this.seguimiento) {
    this.seguimiento = [];
  }

  // Inicializar tiempos_respuesta si no existen
  if (!this.tiempos_respuesta) {
    this.tiempos_respuesta = {
      inicio: new Date(),
      resolucion: null,
    };
  }

  if (this.isNew) {
    // Solo establecer valores por defecto si no se han proporcionado
    if (!this.estado) {
      this.estado = "Esperando Respuesta";
    }
    if (!this.tiempos_respuesta.inicio) {
      this.tiempos_respuesta.inicio = new Date();
    }
    console.log("Nuevo ticket creado con estado:", this.estado);
  }

  // Si el estado cambió
  if (this.isModified("estado")) {
    const estadosFinales = ["Resuelto", "No Resuelto", "Cerrado"];
    const ahora = new Date();

    console.log("Estado modificado a:", this.estado);

    // Actualizar última actualización
    this.ultima_actualizacion = ahora;

    // Si cambió a un estado final
    if (estadosFinales.includes(this.estado)) {
      // Guardar tiempo de resolución si no existe
      if (!this.tiempos_respuesta.resolucion) {
        this.tiempos_respuesta.resolucion = ahora;
      }

      // Calcular tiempos solo si tenemos ambas fechas
      if (this.tiempos_respuesta.inicio && this.tiempos_respuesta.resolucion) {
        const tiempoTotal =
          this.tiempos_respuesta.resolucion.getTime() -
          this.tiempos_respuesta.inicio.getTime();

        const minutos = Math.floor(tiempoTotal / (1000 * 60));
        const horas = Math.floor(tiempoTotal / (1000 * 60 * 60));
        const dias = Math.floor(tiempoTotal / (1000 * 60 * 60 * 24));
        const semanas = Math.floor(tiempoTotal / (1000 * 60 * 60 * 24 * 7));

        // Actualizar métricas de tiempo
        this.metricas.tiempo_resolucion = {
          minutos: minutos > 0 ? minutos : 0,
          horas: horas > 0 ? horas : 0,
          dias: dias > 0 ? dias : 0,
          semanas: semanas > 0 ? semanas : 0,
        };

        console.log("Tiempo de respuesta calculado:", {
          inicio: this.tiempos_respuesta.inicio,
          resolucion: this.tiempos_respuesta.resolucion,
          tiempoTotal,
          minutos,
          horas,
          dias,
          semanas,
        });
      }
    }

    // Manejar reaperturas
    if (
      this._previousState &&
      estadosFinales.includes(this._previousState) &&
      !estadosFinales.includes(this.estado)
    ) {
      this.metricas.reabierto = true;
      this.metricas.veces_reabierto += 1;
      this.estado = "No Resuelto"; // Forzar estado a No Resuelto cuando se reabre
      this.tiempos_respuesta.resolucion = null; // Resetear tiempo de resolución
      console.log(
        "Ticket reabierto, veces reabierto:",
        this.metricas.veces_reabierto
      );
    }

    // Guardar en el seguimiento
    this.seguimiento.push({
      mensaje: `Estado cambiado de ${this._previousState || "nuevo"} a ${
        this.estado
      }`,
      fecha: ahora,
      estado_anterior: this._previousState,
      estado_nuevo: this.estado,
      interno: true,
    });

    // Guardar estado anterior para la próxima vez
    this._previousState = this.estado;
  }

  // Actualizar número de interacciones
  if (this.seguimiento && this.seguimiento.length > 0) {
    this.metricas.numero_interacciones = this.seguimiento.length;
  }

  console.log("Pre-save hook completado, continuando...");
  next();
});

// CORREGIDO: Agregar manejo de errores en el pre-save
ticketSchema.pre("save", function (next) {
  try {
    // Aquí puedes agregar validaciones adicionales si es necesario
    next();
  } catch (error) {
    console.error("Error en pre-save hook:", error);
    next(error);
  }
});

export const Ticket = mongoose.model("Ticket", ticketSchema);
