import mongoose from 'mongoose';

const solicitudReembolsoSchema = new mongoose.Schema({
  // Relaciones
  beneficiarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  
  fondoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fondo',
    required: true
  },
  
  // Datos de la solicitud
  numero_solicitud: {
    type: String,
    unique: true
    // Removido required: true para que se genere automáticamente
  },
  
  tipo_reembolso: {
    type: String,
    enum: ['parcial', 'completo'],
    required: true
  },
  
  // Información del vuelo/gasto
  informacion_vuelo: {
    costo_boleto: {
      valor: {
        type: Number,
        required: true
      },
      moneda: {
        type: String,
        enum: ['USD', 'EUR', 'BRL', 'ARS', 'COP', 'MXN'],
        default: 'USD'
      }
    },
    aerolinea: String,
    numero_vuelo: String,
    fecha_vuelo: Date,
    origen: String,
    destino: String,
    clase_vuelo: {
      type: String,
      enum: ['economica', 'premium', 'ejecutiva', 'primera']
    },
    descripcion: String
  },
  
  // Monto solicitado - MEJORADO
  monto_solicitado: {
    valor: {
      type: Number,
      required: true,
      min: [1, 'El monto debe ser mayor a 0']
    },
    moneda: {
      type: String,
      enum: ['USD'],
      default: 'USD'
    }
  },
  
  // INFORMACIÓN BANCARIA MEJORADA - INCLUYE "OTRO"
  informacion_bancaria: {
    tipo_cuenta: {
      type: String,
      enum: ['cuenta_bancaria', 'paypal', 'transferencia_internacional', 'zelle', 'wise', 'otro'],
      required: true
    },
    
    // Para guardar método para futuro
    metodo_guardado_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MetodoPago'
    },
    
    // === PARA CUENTAS BANCARIAS LOCALES ===
    nombre_banco: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'cuenta_bancaria';
      }
    },
    numero_cuenta: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'cuenta_bancaria';
      }
    },
    tipo_cuenta_bancaria: {
      type: String,
      enum: ['ahorro', 'corriente'],
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'cuenta_bancaria';
      }
    },
    
    // === PARA TRANSFERENCIAS INTERNACIONALES ===
    codigo_swift: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'transferencia_internacional';
      }
    },
    numero_routing: String,
    iban: String,
    direccion_banco: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'transferencia_internacional';
      }
    },
    
    // === PARA PAYPAL ===
    email_paypal: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'paypal';
      },
      validate: {
        validator: function(email) {
          if (this.informacion_bancaria?.tipo_cuenta === 'paypal') {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          }
          return true;
        },
        message: 'Email de PayPal inválido'
      }
    },
    
    // === PARA ZELLE ===
    telefono_zelle: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'zelle' && !this.informacion_bancaria?.email_zelle;
      }
    },
    email_zelle: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'zelle' && !this.informacion_bancaria?.telefono_zelle;
      }
    },
    
    // === PARA WISE ===
    email_wise: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'wise';
      }
    },
    
    // === PARA OTROS MÉTODOS ===
    nombre_metodo_otro: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'otro';
      }
    },
    detalles_metodo_otro: {
      type: String,
      required: function() {
        return this.informacion_bancaria?.tipo_cuenta === 'otro';
      }
    },
    
    // === INFORMACIÓN DEL TITULAR (OBLIGATORIA PARA TODOS) ===
    nombre_titular: {
      type: String,
      required: true,
      trim: true
    },
    apellido_titular: {
      type: String,
      required: true,
      trim: true
    },
    documento_titular: {
      numero: {
        type: String,
        required: true
      },
      tipo: {
        type: String,
        enum: ['cedula', 'pasaporte', 'dni', 'rut', 'cc'],
        required: true
      }
    },
    direccion_titular: {
      type: String,
      required: true
    },
    ciudad_titular: {
      type: String,
      required: true
    },
    estado_provincia_titular: String,
    pais_titular: {
      type: String,
      required: true
    },
    codigo_postal_titular: String,
    telefono_titular: {
      type: String,
      required: true
    },
    
    // === VALIDACIÓN ADICIONAL ===
    verificado: {
      type: Boolean,
      default: false
    },
    fecha_verificacion: Date,
    verificado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    notas_verificacion: String
  },
  
  // Documentos adjuntos - MEJORADO
  documentos: [{
    tipo: {
      type: String,
      enum: [
        'boleto_aereo', 
        'comprobante_pago', 
        'identificacion', 
        'comprobante_bancario',
        'estado_cuenta',
        'captura_paypal',
        'verificacion_cuenta'
      ],
      required: true
    },
    nombre_archivo: {
      type: String,
      required: true
    },
    url_archivo: {
      type: String,
      required: true
    },
    tamaño_archivo: Number,
    tipo_mime: String,
    fecha_subida: {
      type: Date,
      default: Date.now
    },
    obligatorio: {
      type: Boolean,
      default: false
    }
  }],
  
  // Estado de la solicitud
  estado: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'pagada', 'en_proceso_pago'],
    default: 'pendiente'
  },
  
  // Procesamiento por el equipo - MEJORADO
  procesamiento: {
    revisado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    fecha_revision: Date,
    comentarios_equipo: String,
    razon_rechazo: String,
    
    // Monto aprobado (puede ser diferente al solicitado)
    monto_aprobado: {
      valor: Number,
      moneda: {
        type: String,
        enum: ['USD'],
        default: 'USD'
      }
    },
    fecha_aprobacion: Date,
    
    // Información de pago
    fecha_pago: Date,
    referencia_pago: String,
    metodo_pago_usado: String,
    comprobante_pago: {
      url: String,
      fecha_subida: Date
    },
    
    // Comisiones (si aplican)
    comisiones: {
      valor: {
        type: Number,
        default: 0
      },
      descripcion: String
    },
    
    // Tasa de cambio (si aplica)
    tasa_cambio: {
      valor: Number,
      fecha: Date,
      moneda_origen: String,
      moneda_destino: String
    }
  },
  
  // Fechas importantes
  fecha_solicitud: {
    type: Date,
    default: Date.now
  },
  
  fecha_limite_respuesta: {
    type: Date,
    default: function() {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 15); // 15 días para responder
      return fecha;
    }
  },
  
  // Comunicación mejorada
  mensajes: [{
    autor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    tipo_autor: {
      type: String,
      enum: ['beneficiario', 'equipo_bnp'],
      required: true
    },
    mensaje: {
      type: String,
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    adjuntos: [{
      nombre: String,
      url: String,
      tipo: String
    }],
    leido: {
      type: Boolean,
      default: false
    },
    fecha_lectura: Date
  }],
  
  // Auditoría
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  actualizado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  
  fecha_actualizacion: {
    type: Date,
    default: Date.now
  },
  
  // Información adicional
  prioridad: {
    type: String,
    enum: ['baja', 'normal', 'alta', 'urgente'],
    default: 'normal'
  },
  
  etiquetas: [String],
  
  notas_internas: String
});

// Índices mejorados
solicitudReembolsoSchema.index({ numero_solicitud: 1 }, { unique: true, sparse: true });
solicitudReembolsoSchema.index({ beneficiarioId: 1 });
solicitudReembolsoSchema.index({ estado: 1 });
solicitudReembolsoSchema.index({ fecha_solicitud: -1 });
solicitudReembolsoSchema.index({ 'informacion_bancaria.tipo_cuenta': 1 });
solicitudReembolsoSchema.index({ prioridad: 1 });

// MIDDLEWARE CORREGIDO PARA GENERAR NÚMERO DE SOLICITUD
solicitudReembolsoSchema.pre('save', async function(next) {
  try {
    // Generar número de solicitud solo si es un documento nuevo y no tiene número
    if (this.isNew && !this.numero_solicitud) {
      console.log('📋 Generando número de solicitud...');
      
      // Obtener el contador actual de documentos
      const count = await this.constructor.countDocuments();
      const year = new Date().getFullYear();
      const numeroSolicitud = `REM-${year}-${String(count + 1).padStart(6, '0')}`;
      
      console.log('📋 Número generado:', numeroSolicitud);
      this.numero_solicitud = numeroSolicitud;
    }
    
    // Actualizar fecha de actualización
    this.fecha_actualizacion = new Date();
    
    console.log('📋 Pre-save exitoso para solicitud:', this.numero_solicitud);
    next();
  } catch (error) {
    console.error('❌ Error en pre-save:', error);
    next(error);
  }
});

// Validación personalizada para información bancaria CORREGIDA
// REEMPLAZAR COMPLETAMENTE el middleware pre('validate') en models/SolicitudReembolso.js

solicitudReembolsoSchema.pre('validate', function(next) {
  console.log('📋 Validando información bancaria...');
  console.log('📋 Tipo de cuenta:', this.informacion_bancaria?.tipo_cuenta);
  console.log('📋 Es método guardado:', !!this.informacion_bancaria?.metodo_guardado_id);
  
  // NUEVO: Si es un método guardado, SALTEAR TODAS LAS VALIDACIONES
  if (this.informacion_bancaria?.metodo_guardado_id) {
    console.log('✅ Método guardado detectado - SALTANDO TODAS LAS VALIDACIONES');
    return next();
  }
  
  // Solo validar si hay información bancaria
  if (!this.informacion_bancaria || !this.informacion_bancaria.tipo_cuenta) {
    return next(new Error('Información bancaria es requerida'));
  }

  const tipoCuenta = this.informacion_bancaria.tipo_cuenta;
  const info = this.informacion_bancaria;

  console.log('📋 Validando método nuevo tipo:', tipoCuenta);

  // Validaciones específicas SOLO para métodos nuevos
  switch (tipoCuenta) {
    case 'cuenta_bancaria':
      if (!info.nombre_banco || !info.numero_cuenta) {
        return next(new Error('Nombre del banco y número de cuenta son obligatorios para cuenta bancaria'));
      }
      break;
      
    case 'paypal':
      if (!info.email_paypal) {
        return next(new Error('Email de PayPal es obligatorio'));
      }
      break;
      
    case 'transferencia_internacional':
      if (!info.codigo_swift || !info.direccion_banco) {
        return next(new Error('Código SWIFT y dirección del banco son obligatorios para transferencias internacionales'));
      }
      break;
      
    case 'zelle':
      if (!info.telefono_zelle && !info.email_zelle) {
        return next(new Error('Teléfono o email de Zelle es obligatorio'));
      }
      break;
      
    case 'wise':
      if (!info.email_wise) {
        return next(new Error('Email de Wise es obligatorio'));
      }
      break;
      
    case 'otro':
      if (!info.nombre_metodo_otro || !info.detalles_metodo_otro) {
        return next(new Error('Nombre y detalles del método personalizado son obligatorios'));
      }
      break;
      
    default:
      return next(new Error(`Tipo de cuenta no válido: ${tipoCuenta}`));
  }

  // Validar información del titular SOLO para métodos nuevos
  if (!info.nombre_titular || !info.apellido_titular) {
    return next(new Error('Nombre y apellido del titular son obligatorios'));
  }

  if (!info.documento_titular || !info.documento_titular.numero) {
    return next(new Error('Documento del titular es obligatorio'));
  }

  if (!info.direccion_titular || !info.ciudad_titular || !info.pais_titular || !info.telefono_titular) {
    return next(new Error('Dirección completa y teléfono del titular son obligatorios'));
  }

  console.log('✅ Validación de método nuevo exitosa');
  next();
});
// Métodos del esquema mejorados
solicitudReembolsoSchema.methods.puedeEditar = function() {
  return this.estado === 'pendiente';
};

solicitudReembolsoSchema.methods.puedeAprobar = function() {
  return this.estado === 'pendiente' || this.estado === 'en_revision';
};

solicitudReembolsoSchema.methods.aprobar = function(montoAprobado, comentarios, usuarioId) {
  this.estado = 'aprobada';
  this.procesamiento.revisado_por = usuarioId;
  this.procesamiento.fecha_revision = new Date();
  this.procesamiento.fecha_aprobacion = new Date();
  this.procesamiento.monto_aprobado = {
    valor: montoAprobado,
    moneda: 'USD'
  };
  this.procesamiento.comentarios_equipo = comentarios;
  this.actualizado_por = usuarioId;
  
  return this.save();
};

solicitudReembolsoSchema.methods.rechazar = function(razonRechazo, comentarios, usuarioId) {
  this.estado = 'rechazada';
  this.procesamiento.revisado_por = usuarioId;
  this.procesamiento.fecha_revision = new Date();
  this.procesamiento.razon_rechazo = razonRechazo;
  this.procesamiento.comentarios_equipo = comentarios;
  this.actualizado_por = usuarioId;
  
  return this.save();
};

solicitudReembolsoSchema.methods.marcarComoPagada = function(referenciaPago, metodoPago, usuarioId, comprobantePago = null) {
  this.estado = 'pagada';
  this.procesamiento.fecha_pago = new Date();
  this.procesamiento.referencia_pago = referenciaPago;
  this.procesamiento.metodo_pago_usado = metodoPago;
  
  if (comprobantePago) {
    this.procesamiento.comprobante_pago = {
      url: comprobantePago.url,
      fecha_subida: new Date()
    };
  }
  
  this.actualizado_por = usuarioId;
  
  return this.save();
};

solicitudReembolsoSchema.methods.marcarEnProcesoPago = function(usuarioId, comentarios = '') {
  this.estado = 'en_proceso_pago';
  this.procesamiento.revisado_por = usuarioId;
  this.procesamiento.fecha_revision = new Date();
  if (comentarios) {
    this.procesamiento.comentarios_equipo = comentarios;
  }
  this.actualizado_por = usuarioId;
  
  return this.save();
};

solicitudReembolsoSchema.methods.agregarMensaje = function(autor, tipoAutor, mensaje, adjuntos = []) {
  this.mensajes.push({
    autor,
    tipo_autor: tipoAutor,
    mensaje,
    adjuntos
  });
  
  return this.save();
};

solicitudReembolsoSchema.methods.verificarInformacionBancaria = function(usuarioId, notas = '') {
  this.informacion_bancaria.verificado = true;
  this.informacion_bancaria.fecha_verificacion = new Date();
  this.informacion_bancaria.verificado_por = usuarioId;
  this.informacion_bancaria.notas_verificacion = notas;
  
  return this.save();
};

// Método para obtener información de pago formateada
solicitudReembolsoSchema.methods.getInformacionPagoFormateada = function() {
  const info = this.informacion_bancaria;
  if (!info) return null;
  
  switch (info.tipo_cuenta) {
    case 'cuenta_bancaria':
      return {
        tipo: 'Cuenta Bancaria',
        detalles: [
          `Banco: ${info.nombre_banco}`,
          `Cuenta: ${info.numero_cuenta}`,
          `Tipo: ${info.tipo_cuenta_bancaria}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `Documento: ${info.documento_titular.tipo} ${info.documento_titular.numero}`,
          `País: ${info.pais_titular}`
        ]
      };
      
    case 'paypal':
      return {
        tipo: 'PayPal',
        detalles: [
          `Email: ${info.email_paypal}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `Documento: ${info.documento_titular.tipo} ${info.documento_titular.numero}`,
          `País: ${info.pais_titular}`
        ]
      };
      
    case 'transferencia_internacional':
      return {
        tipo: 'Transferencia Internacional',
        detalles: [
          `Banco: ${info.nombre_banco}`,
          `SWIFT: ${info.codigo_swift}`,
          `Cuenta: ${info.numero_cuenta || 'N/A'}`,
          `IBAN: ${info.iban || 'N/A'}`,
          `Routing: ${info.numero_routing || 'N/A'}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `Dirección Banco: ${info.direccion_banco}`,
          `País: ${info.pais_titular}`
        ]
      };
      
    case 'zelle':
      return {
        tipo: 'Zelle',
        detalles: [
          `Teléfono: ${info.telefono_zelle || 'N/A'}`,
          `Email: ${info.email_zelle || 'N/A'}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `Documento: ${info.documento_titular.tipo} ${info.documento_titular.numero}`
        ]
      };
      
    case 'wise':
      return {
        tipo: 'Wise',
        detalles: [
          `Email: ${info.email_wise}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `Documento: ${info.documento_titular.tipo} ${info.documento_titular.numero}`,
          `País: ${info.pais_titular}`
        ]
      };
      
    case 'otro':
      return {
        tipo: info.nombre_metodo_otro || 'Otro Método',
        detalles: [
          `Método: ${info.nombre_metodo_otro}`,
          `Detalles: ${info.detalles_metodo_otro}`,
          `Titular: ${info.nombre_titular} ${info.apellido_titular}`,
          `País: ${info.pais_titular}`
        ]
      };
      
    default:
      return {
        tipo: 'Desconocido',
        detalles: []
      };
  }
};

// Statics mejorados
solicitudReembolsoSchema.statics.obtenerEstadisticas = async function(fechaInicio, fechaFin) {
  const matchStage = {};
  if (fechaInicio || fechaFin) {
    matchStage.fecha_solicitud = {};
    if (fechaInicio) matchStage.fecha_solicitud.$gte = new Date(fechaInicio);
    if (fechaFin) matchStage.fecha_solicitud.$lte = new Date(fechaFin);
  }
  
  const estadisticas = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total_solicitudes: { $sum: 1 },
        pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } },
        en_revision: { $sum: { $cond: [{ $eq: ['$estado', 'en_revision'] }, 1, 0] } },
        aprobadas: { $sum: { $cond: [{ $eq: ['$estado', 'aprobada'] }, 1, 0] } },
        rechazadas: { $sum: { $cond: [{ $eq: ['$estado', 'rechazada'] }, 1, 0] } },
        pagadas: { $sum: { $cond: [{ $eq: ['$estado', 'pagada'] }, 1, 0] } },
        en_proceso_pago: { $sum: { $cond: [{ $eq: ['$estado', 'en_proceso_pago'] }, 1, 0] } },
        monto_total_solicitado: { $sum: '$monto_solicitado.valor' },
        monto_total_aprobado: { 
          $sum: { 
            $cond: [
              { $in: ['$estado', ['aprobada', 'pagada', 'en_proceso_pago']] },
              '$procesamiento.monto_aprobado.valor',
              0
            ]
          }
        }
      }
    }
  ]);
  
  return estadisticas[0] || {
    total_solicitudes: 0,
    pendientes: 0,
    en_revision: 0,
    aprobadas: 0,
    rechazadas: 0,
    pagadas: 0,
    en_proceso_pago: 0,
    monto_total_solicitado: 0,
    monto_total_aprobado: 0
  };
};

export const SolicitudReembolso = mongoose.model('SolicitudReembolso', solicitudReembolsoSchema);