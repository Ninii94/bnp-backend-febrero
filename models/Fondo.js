import mongoose from 'mongoose';

const fondoSchema = new mongoose.Schema({
  beneficiarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true,
    unique: true
  },
  
  monto_inicial: {
    valor: {
      type: Number,
      default: 500
    },
    moneda: {
      type: String,
      enum: ['USD'],
      default: 'USD'
    }
  },
  
  saldo_actual: {
    valor: {
      type: Number,
      default: 500
    },
    moneda: {
      type: String,
      enum: ['USD'],
      default: 'USD'
    }
  },
  
  estado: {
    type: String,
    enum: ['activo', 'bloqueado', 'vencido', 'bloqueado_vencido', 'desactivado'],
    default: 'activo'
  },
  
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_vencimiento: {
    type: Date,
    required: true
  },
  
  auto_renovacion: {
    habilitada: {
      type: Boolean,
      default: true
    },
    ultima_renovacion: Date,
    proxima_renovacion: Date,
    contador_renovaciones: {
      type: Number,
      default: 0
    },
    limite_renovaciones: {
      type: Number,
      default: 10
    }
  },
  
  bloqueo: {
    bloqueado: {
      type: Boolean,
      default: false
    },
    fecha_bloqueo: Date,
    razon_bloqueo: {
      type: String,
      enum: [
        'mal_uso_certificados',
        'documentos_fraudulentos', 
        'incumplimiento_terminos',
        'actividad_sospechosa',
        'otros'
      ]
    },
    razon_personalizada: String,
    monto_reactivacion: {
      valor: {
        type: Number,
        default: 250
      },
      moneda: {
        type: String,
        enum: ['USD'],
        default: 'USD'
      }
    },
    bloqueado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    desbloqueado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    fecha_desbloqueo: Date
  },

  desactivacion: {
    desactivado: {
      type: Boolean,
      default: false
    },
    fecha_desactivacion: Date,
    razon_desactivacion: {
      type: String,
      enum: [
        'solicitud_beneficiario',
        'inactividad_prolongada',
        'cambio_programa',
        'finalizacion_contrato',
        'decision_administrativa',
        'otros'
      ]
    },
    razon_personalizada: String,
    desactivado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    reactivado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    fecha_reactivacion: Date,
    preservar_saldo: {
      type: Boolean,
      default: true
    }
  },
  
  historial_movimientos: [{
    tipo: {
      type: String,
      enum: ['creacion', 'renovacion', 'bloqueo', 'desbloqueo', 'uso_fondo', 'ajuste_manual', 'desactivacion', 'reactivacion'],
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    monto_anterior: Number,
    monto_nuevo: Number,
    descripcion: String,
    realizado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    solicitud_reembolso_relacionada: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SolicitudReembolso'
    },
    detalles_adicionales: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
  configuracion: {
    dias_periodo: {
      type: Number,
      default: 365
    },
    periodo_gracia_dias: {
      type: Number,
      default: 30
    }
  },
  
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
  }
});

fondoSchema.index({ beneficiarioId: 1 }, { unique: true });
fondoSchema.index({ estado: 1 });
fondoSchema.index({ fecha_vencimiento: 1 });

fondoSchema.pre('save', function(next) {
  this.fecha_actualizacion = new Date();
  next();
});

fondoSchema.methods.calcularDiasRestantes = function() {
  const ahora = new Date();
  const vencimiento = new Date(this.fecha_vencimiento);
  
  ahora.setHours(0, 0, 0, 0);
  vencimiento.setHours(0, 0, 0, 0);
  
  const diferenciaMilisegundos = vencimiento.getTime() - ahora.getTime();
  const diasRestantes = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
  
  return diasRestantes;
};

fondoSchema.methods.estaVencido = function() {
  const ahora = new Date();
  const vencimiento = new Date(this.fecha_vencimiento);
  
  ahora.setHours(23, 59, 59, 999);
  vencimiento.setHours(23, 59, 59, 999);
  
  const vencido = ahora > vencimiento;
  
  return vencido;
};

fondoSchema.methods.puedeRenovar = function() {
  const estadosRenovables = ['activo', 'vencido', 'bloqueado_vencido'];
  const contadorActual = this.auto_renovacion?.contador_renovaciones || 0;
  const limiteRenovaciones = this.auto_renovacion?.limite_renovaciones || 10;
  
  return estadosRenovables.includes(this.estado) && contadorActual < limiteRenovaciones;
};

fondoSchema.methods.puedeDesbloquear = function() {
  return this.estado === 'bloqueado' || this.estado === 'bloqueado_vencido';
};

fondoSchema.methods.puedeDesactivar = function() {
  return ['activo', 'vencido', 'bloqueado', 'bloqueado_vencido'].includes(this.estado);
};

fondoSchema.methods.puedeReactivar = function() {
  return this.estado === 'desactivado';
};

fondoSchema.methods.renovar = function(usuarioId) {
  console.log('🔄 === INICIANDO RENOVACIÓN DE FONDO ===');
  console.log('🔄 Fondo ID:', this._id);
  console.log('🔄 Estado actual:', this.estado);
  console.log('🔄 Renovaciones actuales:', this.auto_renovacion?.contador_renovaciones || 0);

  if (!this.puedeRenovar()) {
    const contadorActual = this.auto_renovacion?.contador_renovaciones || 0;
    const limiteRenovaciones = this.auto_renovacion?.limite_renovaciones || 10;
    
    if (contadorActual >= limiteRenovaciones) {
      throw new Error(`Este fondo ha alcanzado el límite máximo de ${limiteRenovaciones} renovaciones`);
    }
    throw new Error(`El fondo no puede ser renovado en su estado actual: ${this.estado}`);
  }

  const fechaActual = new Date();
  const nuevaFechaVencimiento = new Date(fechaActual);
  nuevaFechaVencimiento.setFullYear(fechaActual.getFullYear() + 1);
  
  const fechaAnterior = this.fecha_vencimiento;
  const saldoAnterior = this.saldo_actual.valor;
  
  this.fecha_vencimiento = nuevaFechaVencimiento;
  this.saldo_actual.valor = this.monto_inicial.valor;
  
  if (!this.auto_renovacion) {
    this.auto_renovacion = {};
  }
  
  this.auto_renovacion.contador_renovaciones = (this.auto_renovacion.contador_renovaciones || 0) + 1;
  this.auto_renovacion.ultima_renovacion = new Date();
  this.auto_renovacion.proxima_renovacion = nuevaFechaVencimiento;
  this.actualizado_por = usuarioId;
  
  if (this.estado === 'vencido') {
    this.estado = 'activo';
    console.log('🔄 Estado cambiado de "vencido" a "activo"');
  } else if (this.estado === 'bloqueado_vencido') {
    this.estado = 'bloqueado';
    console.log('🔄 Estado cambiado de "bloqueado_vencido" a "bloqueado"');
  }
  
  const diasAgregados = Math.ceil((nuevaFechaVencimiento.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24));
  
  this.historial_movimientos.push({
    tipo: 'renovacion',
    monto_anterior: saldoAnterior,
    monto_nuevo: this.monto_inicial.valor,
    descripcion: `Renovación #${this.auto_renovacion.contador_renovaciones}. Vencimiento anterior: ${fechaAnterior.toISOString().split('T')[0]}, Nuevo vencimiento: ${nuevaFechaVencimiento.toISOString().split('T')[0]}. Saldo restablecido a ${this.monto_inicial.valor}`,
    realizado_por: usuarioId,
    fecha: new Date(),
    detalles_adicionales: {
      fecha_vencimiento_anterior: fechaAnterior,
      fecha_vencimiento_nueva: nuevaFechaVencimiento,
      dias_agregados: diasAgregados,
      tipo_renovacion: 'manual',
      estado_anterior: this.estado === 'activo' ? (fechaAnterior < fechaActual ? 'vencido' : 'activo') : this.estado,
      estado_nuevo: this.estado,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: this.monto_inicial.valor,
      numero_renovacion: this.auto_renovacion.contador_renovaciones,
      renovaciones_restantes: (this.auto_renovacion.limite_renovaciones || 10) - this.auto_renovacion.contador_renovaciones
    }
  });
  
  console.log('✅ Renovación #', this.auto_renovacion.contador_renovaciones);
  console.log('✅ Renovaciones restantes:', (this.auto_renovacion.limite_renovaciones || 10) - this.auto_renovacion.contador_renovaciones);
  
  return this.save();
};

fondoSchema.methods.bloquear = function(razon, razonPersonalizada, montoReactivacion, usuarioId) {
  if (!this.bloqueo) {
    this.bloqueo = {};
  }
  
  this.bloqueo.bloqueado = true;
  this.bloqueo.fecha_bloqueo = new Date();
  this.bloqueo.razon_bloqueo = razon;
  this.bloqueo.razon_personalizada = razonPersonalizada;
  
  if (!this.bloqueo.monto_reactivacion) {
    this.bloqueo.monto_reactivacion = {};
  }
  this.bloqueo.monto_reactivacion.valor = montoReactivacion || 250;
  this.bloqueo.monto_reactivacion.moneda = 'USD';
  
  this.bloqueo.bloqueado_por = usuarioId;
  this.actualizado_por = usuarioId;
  
  if (this.estaVencido()) {
    this.estado = 'bloqueado_vencido';
  } else {
    this.estado = 'bloqueado';
  }
  
  this.historial_movimientos.push({
    tipo: 'bloqueo',
    monto_anterior: this.saldo_actual.valor,
    monto_nuevo: this.saldo_actual.valor,
    descripcion: `Fondo bloqueado por: ${razon}${razonPersonalizada ? ` - ${razonPersonalizada}` : ''}`,
    realizado_por: usuarioId
  });
  
  return this.save();
};

fondoSchema.methods.desbloquear = function(usuarioId) {
  if (!this.bloqueo || !this.bloqueo.bloqueado) {
    throw new Error('El fondo no está bloqueado');
  }
  
  const saldoARecuperar = this.saldo_actual?.valor || 0;
  
  if (!this.bloqueo) {
    this.bloqueo = {};
  }
  
  this.bloqueo.bloqueado = false;
  this.bloqueo.fecha_desbloqueo = new Date();
  this.bloqueo.desbloqueado_por = usuarioId;
  
  this.actualizado_por = usuarioId;
  
  if (this.estaVencido()) {
    this.estado = 'vencido';
  } else {
    this.estado = 'activo';
  }
  
  this.historial_movimientos.push({
    tipo: 'desbloqueo',
    monto_anterior: saldoARecuperar,
    monto_nuevo: saldoARecuperar,
    descripcion: `Fondo desbloqueado. Saldo recuperado: $${saldoARecuperar}`,
    realizado_por: usuarioId,
    fecha: new Date()
  });
  
  return this.save();
};

fondoSchema.methods.desactivar = function(razon, razonPersonalizada, preservarSaldo, usuarioId) {
  if (!this.puedeDesactivar()) {
    throw new Error(`No se puede desactivar un fondo con estado: ${this.estado}`);
  }
  
  const saldoAnterior = this.saldo_actual?.valor || 0;
  
  if (!this.desactivacion) {
    this.desactivacion = {};
  }
  
  this.desactivacion.desactivado = true;
  this.desactivacion.fecha_desactivacion = new Date();
  this.desactivacion.razon_desactivacion = razon;
  this.desactivacion.razon_personalizada = razonPersonalizada;
  this.desactivacion.preservar_saldo = preservarSaldo !== false;
  this.desactivacion.desactivado_por = usuarioId;
  
  this.actualizado_por = usuarioId;
  this.estado = 'desactivado';
  
  let nuevoSaldo = saldoAnterior;
  if (!preservarSaldo) {
    this.saldo_actual.valor = 0;
    nuevoSaldo = 0;
  }
  
  this.historial_movimientos.push({
    tipo: 'desactivacion',
    monto_anterior: saldoAnterior,
    monto_nuevo: nuevoSaldo,
    descripcion: `Fondo desactivado por: ${razon}${razonPersonalizada ? ` - ${razonPersonalizada}` : ''}. Saldo ${preservarSaldo ? 'preservado' : 'eliminado'}`,
    realizado_por: usuarioId,
    fecha: new Date()
  });
  
  return this.save();
};

fondoSchema.methods.reactivar = function(nuevaFechaVencimiento, usuarioId) {
  if (!this.puedeReactivar()) {
    throw new Error(`No se puede reactivar un fondo con estado: ${this.estado}`);
  }
  
  const saldoAnterior = this.saldo_actual?.valor || 0;
  
  if (!this.desactivacion) {
    this.desactivacion = {};
  }
  
  this.desactivacion.reactivado_por = usuarioId;
  this.desactivacion.fecha_reactivacion = new Date();
  
  this.actualizado_por = usuarioId;
  this.estado = 'activo';
  
  if (nuevaFechaVencimiento) {
    this.fecha_vencimiento = new Date(nuevaFechaVencimiento);
  } else {
    const nuevaFecha = new Date();
    nuevaFecha.setDate(nuevaFecha.getDate() + this.configuracion.dias_periodo);
    this.fecha_vencimiento = nuevaFecha;
  }
  
  this.historial_movimientos.push({
    tipo: 'reactivacion',
    monto_anterior: saldoAnterior,
    monto_nuevo: saldoAnterior,
    descripcion: `Fondo reactivado. Nuevo vencimiento: ${this.fecha_vencimiento.toLocaleDateString()}`,
    realizado_por: usuarioId,
    fecha: new Date()
  });
  
  return this.save();
};

fondoSchema.methods.usarFondo = function(monto, descripcion, solicitudId, usuarioId) {
  if (this.saldo_actual.valor < monto) {
    throw new Error('Saldo insuficiente');
  }
  
  const montoAnterior = this.saldo_actual.valor;
  this.saldo_actual.valor -= monto;
  this.actualizado_por = usuarioId;
  
  this.historial_movimientos.push({
    tipo: 'uso_fondo',
    monto_anterior: montoAnterior,
    monto_nuevo: this.saldo_actual.valor,
    descripcion: descripcion || `Uso de fondo: $${monto}`,
    realizado_por: usuarioId,
    solicitud_reembolso_relacionada: solicitudId
  });
  
  return this.save();
};

fondoSchema.statics.verificarVencimientos = async function() {
  const fondosVencidos = await this.find({
    fecha_vencimiento: { $lt: new Date() },
    estado: { $in: ['activo', 'bloqueado'] }
  });
  
  for (const fondo of fondosVencidos) {
    if (fondo.estado === 'activo') {
      fondo.estado = 'vencido';
    } else if (fondo.estado === 'bloqueado') {
      fondo.estado = 'bloqueado_vencido';
    }
    await fondo.save();
  }
  
  return fondosVencidos.length;
};

fondoSchema.statics.obtenerEstadisticas = async function() {
  const estadisticas = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        activos: { $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] } },
        bloqueados: { $sum: { $cond: [{ $in: ['$estado', ['bloqueado', 'bloqueado_vencido']] }, 1, 0] } },
        vencidos: { $sum: { $cond: [{ $eq: ['$estado', 'vencido'] }, 1, 0] } },
        desactivados: { $sum: { $cond: [{ $eq: ['$estado', 'desactivado'] }, 1, 0] } },
        saldo_total_activo: { 
          $sum: { 
            $cond: [
              { $eq: ['$estado', 'activo'] }, 
              '$saldo_actual.valor', 
              0
            ] 
          } 
        },
        saldo_total_general: { $sum: '$saldo_actual.valor' }
      }
    }
  ]);
  
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + 30);
  
  const vencenPronto = await this.countDocuments({
    estado: 'activo',
    fecha_vencimiento: { $lte: fechaLimite, $gte: new Date() }
  });
  
  const resultado = estadisticas[0] || {
    total: 0,
    activos: 0,
    bloqueados: 0,
    vencidos: 0,
    desactivados: 0,
    saldo_total_activo: 0,
    saldo_total_general: 0
  };
  
  resultado.vencen_pronto = vencenPronto;
  
  return resultado;
};

export const Fondo = mongoose.model('Fondo', fondoSchema);