import mongoose from 'mongoose';

const generarCodigoUnico = async () => {
  let codigo;
  let existe = true;
  
  while (existe) {
    codigo = 'BNP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const beneficiarioExistente = await mongoose.model('Beneficiario').findOne({
      $or: [
        { llave_unica: codigo },
        { 'codigo.value': codigo }
      ]
    });
    
    if (!beneficiarioExistente) {
      existe = false;
    }
  }
  
  return codigo;
};

const beneficiarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  apellido: {
    type: String,
    required: true
  },
  genero: {
    type: String,
    enum: ['masculino', 'femenino', 'prefiero no decirlo'],
    default: 'prefiero no decirlo'
  },
  estado_civil: {
    type: String,
    enum: ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado'],
    default: 'no especificado'
  },
  telefono: String,
  correo: String,
  nacionalidad: String,
  direccion: String,
  fecha_nacimiento: Date,
  pais: String,
  estado_provincia: String,
  ciudad: String,
  
  pareja: {
    nombre: String,
    apellido: String,
    fecha_nacimiento: Date,
    correo: String,
    telefono: String,
    genero: {
      type: String,
      enum: ['masculino', 'femenino', 'prefiero no decirlo']
    },
    estado_civil: {
      type: String,
      enum: ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado']
    },
    nacionalidad: String,
    documento_identidad: {
      tipo: String,
      numero: String
    }
  },

  membresia: {
    fecha_compra: Date,
    socio_desde: Date,
    costo_total: {
      valor: Number,
      moneda: {
        type: String,
        enum: ['USD', 'BRL', 'reales', 'dolares'],
        default: 'USD'
      }
    },
    costo_contrato_cierre: {
      valor: Number,
      moneda: {
        type: String,
        enum: ['USD', 'BRL', 'reales', 'dolares'],
        default: 'USD'
      }
    },
    liquidada: { type: Boolean, default: false },
    estado_liquidacion: { 
      type: String, 
      enum: ['pendiente', 'liquidada', 'liquidada_parcial', 'en_proceso', 'cancelada', 'refinanciada'],
      default: 'pendiente'
    },
    tipo_membresia: String,
    tamano_habitacion: String,
    mantenimiento_pagar: {
      valor: Number,
      moneda: {
        type: String,
        enum: ['USD', 'BRL', 'reales', 'dolares'],
        default: 'USD'
      }
    },
    periodicidad_mantenimiento: {
      type: String,
      enum: ['mensual', 'anual', 'bienal']
    },
    temporada_uso: String,
    vigencia_anos: {
      type: Number,
      min: 1,
      max: 99,
      default: 1
    }
  },
  
  foto_identificacion_beneficiario: {
    nombre: String,
    ruta: String,
    tipo: String,
    tamaño: Number,
    fecha_subida: Date,
    public_id: String
  },
  foto_identificacion_pareja: {
    nombre: String,
    ruta: String,
    tipo: String,
    tamaño: Number,
    fecha_subida: Date,
    public_id: String
  },
  foto: String,
  portada: String,
  descripcion: String,

  llave_unica: {
    type: String,
    unique: true,
    sparse: true
  },
  codigo: {
    value: {
      type: String,
      unique: true,
      sparse: true
    },
    fecha_creacion: {
      type: Date,
      default: Date.now
    },
    fecha_activacion: Date,
    fecha_expiracion: Date,
    monto: {
      valor: {
        type: Number,
        default: 0
      },
      moneda: {
        type: String,
        enum: ['USD', 'BRL', 'reales', 'dolares'],
        default: 'USD'
      }
    },
    estado_activacion: {
      type: String,
      enum: ['PENDIENTE', 'ACTIVO', 'EXPIRADO', 'SUSPENDIDO'],
      default: 'PENDIENTE'
    },
    primaPagada: {
      type: Number,
      default: 0
    },
    activo: {
      type: Boolean,
      default: false
    }
  },

  idioma_preferencia: {
    type: String,
    enum: ['esp', 'por', 'ing'],
    default: 'esp'
  },
  director: String,
  gerente: String,
  cerrador: String,
  colaborador_bnp: String,
  departamento: String,
  fecha_registro: Date,
  monto_venta: {
    type: Number,
    default: 0
  },
  
  vigencia_membresia_anos: {
    type: Number,
    min: 1,
    max: 99,
    default: 1
  },

  estado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estado'
  },
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aliado'
  },
  sucursal: String,
  aliado_sucursal: String,
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  verificado: {
    type: Boolean,
    default: false
  },
  
  fecha_activacion: {
    type: Date
  },
  
  contratos_activos: [{
    contrato_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContratoBeneficiario'
    },
    numero_contrato: String,
    tipo_contrato: String,
    fecha_firma: Date,
    estado: String
  }],
  
  hotel_aliado: String,
  
  enganche_pagado: {
    valor: {
      type: Number,
      default: 0
    },
    moneda: {
      type: String,
      enum: ['reales', 'dolares', 'USD', 'BRL'],
      default: 'USD'
    }
  },
  
  servicios: [{
    type: String
  }],
  
  historialEstados: [{
    estado_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estado'
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    motivo: String
  }],

  documentos_viaje: [{
    tipo: {
      type: String,
      enum: ['Pasaporte', 'DNI', 'Visa', 'Otro'],
      required: true
    },
    numero: String,
    nombre: String,
    fecha_emision: {
      type: Date,
      required: true
    },
    fecha_vencimiento: {
      type: Date,
      required: true
    },
    pais: {
      type: String,
      required: true
    },
    fecha_creacion: {
      type: Date,
      default: Date.now
    }
  }],

  financiamientos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Financiamiento'
  }]
}, {
  timestamps: true
});

beneficiarioSchema.index({ llave_unica: 1 }, { unique: true, sparse: true });
beneficiarioSchema.index({ 'codigo.value': 1 }, { unique: true, sparse: true });
beneficiarioSchema.index({ correo: 1 }, { sparse: true });
beneficiarioSchema.index({ pais: 1 }, { sparse: true });
beneficiarioSchema.index({ 'pareja.correo': 1 }, { sparse: true });
beneficiarioSchema.index({ idioma_preferencia: 1 }, { sparse: true });
beneficiarioSchema.index({ 'membresia.fecha_compra': 1 }, { sparse: true });
beneficiarioSchema.index({ 'membresia.socio_desde': 1 }, { sparse: true });
beneficiarioSchema.index({ 'membresia.tipo_membresia': 1 }, { sparse: true });
beneficiarioSchema.index({ vigencia_membresia_anos: 1 }, { sparse: true });

beneficiarioSchema.pre('save', async function(next) {
  try {
    if ((!this.llave_unica || this.llave_unica === null) && 
        (!this.codigo || !this.codigo.value || this.codigo.value === null)) {
      const nuevoCodigo = await generarCodigoUnico();
      this.llave_unica = nuevoCodigo;
      
      this.codigo = {
        value: nuevoCodigo,
        fecha_creacion: new Date(),
        fecha_activacion: null, 
        monto: {
          valor: 0,
          moneda: 'USD'
        },
        estado_activacion: 'PENDIENTE',
        primaPagada: 0,
        activo: false
      };
    }

    if (this.vigencia_membresia_anos && this.membresia) {
      this.membresia.vigencia_anos = this.vigencia_membresia_anos;
    } else if (this.membresia && this.membresia.vigencia_anos) {
      this.vigencia_membresia_anos = this.membresia.vigencia_anos;
    }

    next();
  } catch (error) {
    next(error);
  }
});

beneficiarioSchema.methods.calcularEdad = function() {
  if (!this.fecha_nacimiento) {
    return null;
  }
  
  const hoy = new Date();
  const fechaNacimiento = new Date(this.fecha_nacimiento);
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const m = hoy.getMonth() - fechaNacimiento.getMonth();
  
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  
  return edad;
};

beneficiarioSchema.methods.tieneMembresiaIncompleta = function() {
  const membresia = this.membresia;
  if (!membresia) return true;
  
  return !(
    membresia.fecha_compra &&
    membresia.costo_total?.valor &&
    membresia.tipo_membresia &&
    membresia.tamano_habitacion
  );
};

beneficiarioSchema.methods.valorTotalPendiente = function() {
  const membresia = this.membresia;
  if (!membresia) return 0;
  
  const costoTotal = membresia.costo_total?.valor || 0;
  const enganchePagado = this.enganche_pagado?.valor || 0;
  
  return Math.max(0, costoTotal - enganchePagado);
};

beneficiarioSchema.methods.proximoMantenimiento = function() {
  const membresia = this.membresia;
  if (!membresia || !membresia.periodicidad_mantenimiento || !membresia.socio_desde) return null;
  
  const socioDesde = new Date(membresia.socio_desde);
  const hoy = new Date();
  
  let proximaFecha = new Date(socioDesde);
  
  switch (membresia.periodicidad_mantenimiento) {
    case 'mensual':
      while (proximaFecha <= hoy) {
        proximaFecha.setMonth(proximaFecha.getMonth() + 1);
      }
      break;
    case 'anual':
      while (proximaFecha <= hoy) {
        proximaFecha.setFullYear(proximaFecha.getFullYear() + 1);
      }
      break;
    case 'bienal':
      while (proximaFecha <= hoy) {
        proximaFecha.setFullYear(proximaFecha.getFullYear() + 2);
      }
      break;
    default:
      return null;
  }
  
  return proximaFecha;
};

beneficiarioSchema.methods.calcularFechaVencimientoMembresia = function() {
  const membresia = this.membresia;
  const vigenciaAnos = this.vigencia_membresia_anos || 1;
  
  if (!membresia || !membresia.socio_desde) return null;
  
  const fechaInicio = new Date(membresia.socio_desde);
  const fechaVencimiento = new Date(fechaInicio);
  fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + vigenciaAnos);
  
  return fechaVencimiento;
};

beneficiarioSchema.methods.esMembresiaVigente = function() {
  const fechaVencimiento = this.calcularFechaVencimientoMembresia();
  if (!fechaVencimiento) return false;
  
  return new Date() <= fechaVencimiento;
};

beneficiarioSchema.virtual('fondo', {
  ref: 'Fondo',
  localField: '_id',
  foreignField: 'beneficiarioId',
  justOne: true
});

beneficiarioSchema.methods.tieneFondoActivo = async function() {
  const { Fondo } = await import('./Fondo.js');
  const fondo = await Fondo.findOne({ 
    beneficiarioId: this._id,
    estado: { $in: ['activo', 'bloqueado'] }
  });
  return !!fondo;
};

beneficiarioSchema.statics.sincronizarCodigosLlaves = async function() {
  const beneficiarios = await this.find({
    $or: [
      { llave_unica: { $exists: false } },
      { llave_unica: null },
      { 'codigo.value': { $exists: false } },
      { 'codigo.value': null }
    ]
  });

  for (const beneficiario of beneficiarios) {
    if (!beneficiario.llave_unica && !beneficiario.codigo?.value) {
      const nuevoCodigo = await generarCodigoUnico();
      beneficiario.llave_unica = nuevoCodigo;
      
      if (!beneficiario.codigo) {
        beneficiario.codigo = {};
      }
      beneficiario.codigo.value = nuevoCodigo;
      
      await beneficiario.save();
    }
  }
};

beneficiarioSchema.statics.sincronizarCorreos = async function() {
  const { Usuario } = await import('./Usuario.js');
  
  const beneficiarios = await this.find({ 
    $or: [
      { correo: { $exists: false } },
      { correo: null },
      { correo: '' }
    ]
  }).populate('usuario_id');

  for (const beneficiario of beneficiarios) {
    if (beneficiario.usuario_id && beneficiario.usuario_id.correo) {
      beneficiario.correo = beneficiario.usuario_id.correo;
      await beneficiario.save();
    }
  }
};

export const Beneficiario = mongoose.model('Beneficiario', beneficiarioSchema);