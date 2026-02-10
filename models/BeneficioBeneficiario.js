import mongoose from 'mongoose';

const beneficioBeneficiarioSchema = new mongoose.Schema({
  beneficiarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  servicioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Servicio',
    required: true
  },
  servicioNombre: {
    type: String,
    required: true
  },
  
  estado: {
    type: String,
    enum: ['pendiente_activacion', 'activo', 'suspendido', 'inactivo', 'cancelado', 'liquidado'],
    default: 'pendiente_activacion'
  },
  
  fecha_activacion: {
    type: Date,
    default: null
  },
  fecha_suspension: {
    type: Date,
    default: null
  },
  fecha_cancelacion: {
    type: Date,
    default: null
  },
  fecha_desactivacion: {
    type: Date,
    default: null
  },
  fecha_reactivacion: {
    type: Date,
    default: null
  },
  
  // desactivación y recontratación
  motivo_desactivacion: {
    type: String,
    enum: [
      'solicitud_beneficiario',
      'inactividad_prolongada', 
      'cambio_programa',
      'finalizacion_contrato',
      'decision_administrativa',
      'incumplimiento_pagos',
      'otros'
    ]
  },
  razon_personalizada: {
    type: String,
    default: ''
  },
  volveria_contratar: {
    type: Boolean,
    default: null
  },
  
  recontrato: {
    type: Boolean,
    default: false
  },
  fecha_recontratacion: {
    type: Date,
    default: null
  },
  notas_adicionales: {
    type: String,
    default: ''
  },

  puede_reactivar: {
    type: Boolean,
    default: true
  },
  desactivado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  reactivado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  
  // Vouchers Flyback
  voucher_data: {
    saldo_actual: { type: Number, default: 500 },
    vouchers_usados: { type: Number, default: 0 },
    renovaciones_utilizadas: { type: Number, default: 0 },
    ultima_renovacion: { type: Date, default: null },
    proxima_renovacion_disponible: { type: Date, default: null },
    historial_uso: [{
      fecha: { type: Date, default: Date.now },
      monto_usado: { type: Number, required: true },
      descripcion: { type: String },
      numero_voucher: { type: String },
      procesado_por: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
      }
    }]
  },
  
  // Reembolso de Costos
  reembolso_data: {
    monto_a_reembolsar: { type: Number, required: false },
    prima_pagada: { type: Number, required: false },
    fecha_reembolso: { type: Date, required: false },
    estado_prima: {
      type: String,
      enum: ['pendiente', 'pagada', 'vencida'],
      default: 'pendiente'
    },
    fecha_pago_prima: { type: Date, default: null }
  },
  
  // Financiamiento de seña (entradaflex)
  financiamiento_data: {
    monto_financiado: { type: Number, required: false },
    monto_con_intereses: { type: Number, required: false },
    saldo_actual: { type: Number, required: false },
    mensualidades_pagadas: { type: Number, default: 0 },
    valor_mensualidad: { type: Number, required: false },
    proxima_mensualidad: { type: Date, required: false },
    historial_pagos: [{
      numero_pago: { type: Number, required: true },
      fecha_pago: { type: Date, default: Date.now },
      monto_pagado: { type: Number, required: true },
      saldo_restante: { type: Number, required: true },
      procesado_por: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
      }
    }],
    contrato_firmado: {
      fecha: { type: Date, required: false },
      numero_contrato: { type: String, required: false }
    }
  },
  
  // cambios de estado
  historial_estados: [{
    estado_anterior: {
      type: String,
      enum: ['pendiente_activacion', 'activo', 'suspendido', 'inactivo', 'cancelado', 'liquidado'],
      required: false
    },
    estado_nuevo: {
      type: String,
      enum: ['pendiente_activacion', 'activo', 'suspendido', 'inactivo', 'cancelado', 'liquidado'],
      required: true
    },
    fecha_cambio: { type: Date, default: Date.now },
    motivo: { type: String, required: false },
    procesado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    datos_adicionales: { type: mongoose.Schema.Types.Mixed }
  }],
  
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  actualizado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  }
}, {
  timestamps: true
});

// Índices
beneficioBeneficiarioSchema.index({ beneficiarioId: 1, servicioId: 1 }, { unique: true });
beneficioBeneficiarioSchema.index({ estado: 1 });
beneficioBeneficiarioSchema.index({ fecha_activacion: 1 });
beneficioBeneficiarioSchema.index({ volveria_contratar: 1 });
beneficioBeneficiarioSchema.index({ recontrato: 1 });
beneficioBeneficiarioSchema.index({ fecha_recontratacion: 1 });
beneficioBeneficiarioSchema.index({ motivo_desactivacion: 1 });
beneficioBeneficiarioSchema.index({ fecha_desactivacion: 1 });

// MÉTODO ACTIVAR MODIFICADO CON SINCRONIZACIÓN AUTOMÁTICA
beneficioBeneficiarioSchema.methods.activar = async function(usuarioId, datos_activacion = {}) {
  const estadoAnterior = this.estado;
  
  console.log(`[ACTIVAR] === INICIANDO ACTIVACIÓN ===`);
  console.log(`[ACTIVAR] Beneficiario ID: ${this.beneficiarioId}`);
  console.log(`[ACTIVAR] Servicio: ${this.servicioNombre}`);
  console.log(`[ACTIVAR] Estado anterior: ${estadoAnterior}`);
  console.log(`[ACTIVAR] Datos de activación:`, datos_activacion);
  
  // 1. ACTIVAR EL BENEFICIO PRINCIPAL
  this.estado = 'activo';
  this.fecha_activacion = new Date();
  this.actualizado_por = usuarioId;
  
  // Limpiar datos de desactivación si se está reactivando
  if (estadoAnterior === 'inactivo') {
    this.fecha_reactivacion = new Date();
    this.reactivado_por = usuarioId;
    this.motivo_desactivacion = undefined;
    this.razon_personalizada = '';
    this.notas_adicionales = '';
  }
  
  // Agregar al historial
  const historialEntry = {
    estado_nuevo: 'activo',
    motivo: estadoAnterior === 'inactivo' ? 'Reactivación manual desde perfil' : 'Activación manual desde perfil',
    procesado_por: usuarioId,
    datos_adicionales: datos_activacion
  };
  
  if (estadoAnterior && estadoAnterior !== 'pendiente_activacion') {
    historialEntry.estado_anterior = estadoAnterior;
  }
  
  this.historial_estados.push(historialEntry);
  
  // 2. CONFIGURAR DATOS ESPECÍFICOS DEL SERVICIO
  if (this.servicioNombre === 'Vouchers Flyback' || this.servicioNombre === 'Certificado de boletos aéreos') {
    console.log(`[ACTIVAR] Configurando voucher para ${this.servicioNombre}`);
    if (!this.voucher_data) {
      this.voucher_data = {};
    }
    
    if (estadoAnterior === 'pendiente_activacion') {
      this.voucher_data.saldo_actual = 500;
      this.voucher_data.vouchers_usados = 0;
      this.voucher_data.renovaciones_utilizadas = 0;
      this.voucher_data.historial_uso = [];
    }
    
    if (!this.voucher_data.proxima_renovacion_disponible) {
      const proximaRenovacion = new Date();
      proximaRenovacion.setFullYear(proximaRenovacion.getFullYear() + 1);
      this.voucher_data.proxima_renovacion_disponible = proximaRenovacion;
    }
    
  } else if (this.servicioNombre.toLowerCase().includes('reembolso')) {
    console.log(`[ACTIVAR] Configurando servicio de reembolso: ${this.servicioNombre}`);
    
    if (estadoAnterior === 'pendiente_activacion') {
      if (!this.reembolso_data) {
        this.reembolso_data = {};
      }
      
      const montoReembolso = datos_activacion.monto_a_reembolsar || 0;
      
      this.reembolso_data.monto_a_reembolsar = montoReembolso;
      this.reembolso_data.prima_pagada = montoReembolso * 0.0575;
      this.reembolso_data.estado_prima = 'pendiente';
      
      const fechaReembolso = new Date(this.fecha_activacion);
      fechaReembolso.setFullYear(fechaReembolso.getFullYear() + 25);
      this.reembolso_data.fecha_reembolso = fechaReembolso;
      
      console.log(`[ACTIVAR] Datos de reembolso configurados:`, this.reembolso_data);
    }
    
  } else if (this.servicioNombre.toLowerCase().includes('financiamiento')) {
    console.log(`[ACTIVAR] Configurando financiamiento para ${this.servicioNombre}`);
    if (datos_activacion.monto_financiado && estadoAnterior === 'pendiente_activacion') {
      if (!this.financiamiento_data) {
        this.financiamiento_data = {};
      }
      
      this.financiamiento_data.monto_financiado = datos_activacion.monto_financiado;
      this.financiamiento_data.monto_con_intereses = datos_activacion.monto_financiado * 1.07;
      this.financiamiento_data.saldo_actual = this.financiamiento_data.monto_con_intereses;
      this.financiamiento_data.valor_mensualidad = this.financiamiento_data.monto_con_intereses / 6;
      this.financiamiento_data.mensualidades_pagadas = 0;
      this.financiamiento_data.historial_pagos = [];
      
      const proximaMensualidad = new Date(this.fecha_activacion);
      proximaMensualidad.setMonth(proximaMensualidad.getMonth() + 1);
      this.financiamiento_data.proxima_mensualidad = proximaMensualidad;
      
      if (datos_activacion.numero_contrato) {
        this.financiamiento_data.contrato_firmado = {
          fecha: this.fecha_activacion,
          numero_contrato: datos_activacion.numero_contrato
        };
      }
    }
  }
  
  // 3. GUARDAR EL BENEFICIO
  await this.save();
  console.log(`[ACTIVAR] ✅ Beneficio activado y guardado (sin sincronización automática)`);
  
  return this;
};
// MÉTODO DESACTIVAR MODIFICADO CON SINCRONIZACIÓN AUTOMÁTICA Y DEBUG MEJORADO
beneficioBeneficiarioSchema.methods.desactivar = async function(usuarioId, datosDesactivacion = {}) {
  console.log(`[DESACTIVAR] === INICIANDO DESACTIVACIÓN ===`);
  console.log(`[DESACTIVAR] Servicio: ${this.servicioNombre}`);
  console.log(`[DESACTIVAR] Beneficiario ID: ${this.beneficiarioId}`);
  console.log(`[DESACTIVAR] Usuario ID: ${usuarioId}`);
  console.log(`[DESACTIVAR] Datos:`, datosDesactivacion);
  
  // 1. DESACTIVAR EL BENEFICIO PRINCIPAL
  this.estado = 'inactivo';
  this.fecha_desactivacion = new Date();
  this.actualizado_por = usuarioId;
  this.desactivado_por = usuarioId;
  
  this.motivo_desactivacion = datosDesactivacion.motivo;
  this.razon_personalizada = datosDesactivacion.razon_personalizada || '';
 this.volveria_contratar = datosDesactivacion.volveria_contratar;
  this.notas_adicionales = datosDesactivacion.notas_adicionales || '';
  
  const motivosNoReactivables = ['incumplimiento_pagos', 'decision_administrativa', 'finalizacion_contrato'];
  this.puede_reactivar = !motivosNoReactivables.includes(datosDesactivacion.motivo);
  
  this.historial_estados.push({
    estado_anterior: 'activo',
    estado_nuevo: 'inactivo',
    motivo: `Desactivado: ${datosDesactivacion.motivo}`,
    procesado_por: usuarioId,
    datos_adicionales: {
      motivo_desactivacion: datosDesactivacion.motivo,
      razon_personalizada: datosDesactivacion.razon_personalizada,
      volveria_contratar: datosDesactivacion.volveria_contratar,
      notas: datosDesactivacion.notas_adicionales
    }
  });
  
  // 2. GUARDAR EL BENEFICIO
  await this.save();
  console.log(`[DESACTIVAR] ✅ Beneficio desactivado y guardado (sin sincronización automática)`);
  
  return this;
};

// MÉTODO REACTIVAR MODIFICADO CON SINCRONIZACIÓN AUTOMÁTICA
beneficioBeneficiarioSchema.methods.reactivar = async function(usuarioId) {
  console.log(`[REACTIVAR] === INICIANDO REACTIVACIÓN ===`);
  console.log(`[REACTIVAR] Servicio: ${this.servicioNombre}`);
  
  if (!this.puede_reactivar) {
    throw new Error('Este beneficio no puede ser reactivado debido al motivo de desactivación');
  }
  
  if (this.estado !== 'inactivo') {
    throw new Error('Solo se pueden reactivar beneficios inactivos');
  }
  
  // Usar el método activar para mantener consistencia
  await this.activar(usuarioId, { tipo_operacion: 'reactivacion' });
  
  console.log(`[REACTIVAR] ✅ Reactivación completada (sin sincronización automática)`);
  return this;
};

// MÉTODOS DE VOUCHER (sin cambios)
beneficioBeneficiarioSchema.methods.puedeRenovarVoucher = function() {
  if (this.servicioNombre !== 'Vouchers Flyback' && this.servicioNombre !== 'Certificado de boletos aéreos') {
    return false;
  }
  
  if (this.estado !== 'activo') {
    return false;
  }
  
  if (this.voucher_data && this.voucher_data.renovaciones_utilizadas >= 10) {
    return false;
  }
  
  if (!this.voucher_data || !this.voucher_data.proxima_renovacion_disponible) {
    return true;
  }
  
  return new Date() >= this.voucher_data.proxima_renovacion_disponible;
};

beneficioBeneficiarioSchema.methods.renovarVoucher = function(usuarioId) {
  if (!this.puedeRenovarVoucher()) {
    throw new Error('No se puede renovar el voucher en este momento');
  }
  
  if (!this.voucher_data) {
    this.voucher_data = {};
  }
  
  this.voucher_data.saldo_actual = 500;
  this.voucher_data.renovaciones_utilizadas = (this.voucher_data.renovaciones_utilizadas || 0) + 1;
  this.voucher_data.ultima_renovacion = new Date();
  
  const proximaRenovacion = new Date();
  proximaRenovacion.setFullYear(proximaRenovacion.getFullYear() + 1);
  this.voucher_data.proxima_renovacion_disponible = proximaRenovacion;
  
  if (!this.voucher_data.historial_uso) {
    this.voucher_data.historial_uso = [];
  }
  
  this.voucher_data.historial_uso.push({
    fecha: new Date(),
    monto_usado: 0,
    descripcion: `Renovación ${this.voucher_data.renovaciones_utilizadas}/10`,
    procesado_por: usuarioId
  });
  
  this.actualizado_por = usuarioId;
  return this.save();
};

// MÉTODOS ESTÁTICOS (sin cambios)
beneficioBeneficiarioSchema.statics.getBeneficiariosParaPromociones = async function() {
  return this.aggregate([
    {
      $match: {
        estado: 'inactivo',
        volveria_contratar: true,  
        motivo_desactivacion: { $exists: true }
      }
    },
    {
      $lookup: {
        from: 'beneficiarios',
        localField: 'beneficiarioId',
        foreignField: '_id',
        as: 'beneficiarioData'
      }
    },
    {
      $unwind: '$beneficiarioData'
    },
    {
      $project: {
        _id: 1,
        beneficiarioId: 1,
        servicioNombre: 1,
        fecha_desactivacion: 1,
        motivo_desactivacion: 1,
        razon_personalizada: 1,
        notas_adicionales: 1,
        volveria_contratar: 1,
        'beneficiarioData.nombre': 1,
        'beneficiarioData.apellido': 1,
        'beneficiarioData.correo': 1,
        'beneficiarioData.telefono': 1
      }
    },
    {
      $sort: { fecha_desactivacion: -1 }
    }
  ]);
};


beneficioBeneficiarioSchema.statics.getEstadisticasDesactivacion = async function() {
  return this.aggregate([
    {
      $match: { 
        estado: 'inactivo',
        motivo_desactivacion: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$motivo_desactivacion',
        total: { $sum: 1 },
        recontratarian: {
          $sum: { $cond: [{ $eq: ['$volveria_contratar', true] }, 1, 0] }
        },
        no_recontratarian: {
          $sum: { $cond: [{ $eq: ['$volveria_contratar', false] }, 1, 0] }
        },
        sin_respuesta: {
          $sum: { $cond: [{ $eq: ['$volveria_contratar', null] }, 1, 0] }
        }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
};


beneficioBeneficiarioSchema.statics.getBeneficiosReactivables = async function(beneficiarioId) {
  return this.find({
    beneficiarioId: beneficiarioId,
    estado: 'inactivo',
    puede_reactivar: true
  }).populate('servicioId', 'nombre descripcion');
};

export const BeneficioBeneficiario = mongoose.model('BeneficioBeneficiario', beneficioBeneficiarioSchema);