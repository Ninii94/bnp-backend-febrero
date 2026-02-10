
import mongoose from 'mongoose';

const metodoPagoSchema = new mongoose.Schema({
  beneficiarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: [true, 'El ID del beneficiario es requerido']
  },
  
  nombre: {
    type: String,
    required: [true, 'El nombre del método es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  
  tipo_cuenta: {
    type: String,
    required: [true, 'El tipo de cuenta es requerido'],
    enum: {
      values: [
        'cuenta_bancaria',
        'paypal', 
        'transferencia_internacional',
        'zelle',
        'wise',
        'otro'  
      ],
      message: 'Tipo de cuenta no válido. Valores permitidos: cuenta_bancaria, paypal, transferencia_internacional, zelle, wise, otro'
    }
  },
  
  informacion_bancaria: {
    nombre_titular: {
      type: String,
      required: [true, 'El nombre del titular es requerido'],
      trim: true
    },
    apellido_titular: {
      type: String, 
      required: [true, 'El apellido del titular es requerido'],
      trim: true
    },
    documento_titular: {
      tipo: {
        type: String,
        required: [true, 'El tipo de documento es requerido'],
        enum: ['cedula', 'pasaporte', 'dni', 'rut', 'cc']
      },
      numero: {
        type: String,
        required: [true, 'El número de documento es requerido'],
        trim: true
      }
    },
    direccion_titular: {
      type: String,
      required: [true, 'La dirección del titular es requerida'],
      trim: true
    },
    ciudad_titular: {
      type: String,
      required: [true, 'La ciudad del titular es requerida'],
      trim: true
    },
    estado_provincia_titular: {
      type: String,
      trim: true
    },
    pais_titular: {
      type: String,
      required: [true, 'El país del titular es requerido'],
      trim: true
    },
    codigo_postal_titular: {
      type: String,
      trim: true
    },
    telefono_titular: {
      type: String,
      required: [true, 'El teléfono del titular es requerido'],
      trim: true
    },
    
  
    nombre_banco: {
      type: String,
      trim: true
    },
    numero_cuenta: {
      type: String,
      trim: true
    },
    tipo_cuenta_bancaria: {
      type: String,
      enum: ['ahorro', 'corriente'],
      default: 'ahorro'
    },
    

    codigo_swift: {
      type: String,
      trim: true,
      uppercase: true
    },
    numero_routing: {
      type: String,
      trim: true
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true
    },
    direccion_banco: {
      type: String,
      trim: true
    },
    

    email_paypal: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email de PayPal no válido'
      }
    },
    

    telefono_zelle: {
      type: String,
      trim: true
    },
    email_zelle: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email de Zelle no válido'
      }
    },
    
    // Wise
    email_wise: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email de Wise no válido'
      }
    },
    
    //"otro"
    nombre_metodo_otro: {
      type: String,
      trim: true
    },
    detalles_metodo_otro: {
      type: String,
      trim: true
    }
  },
  
  activo: {
    type: Boolean,
    default: true
  },
  
  veces_utilizado: {
    type: Number,
    default: 0,
    min: 0
  },
  
  ultimo_uso: {
    type: Date
  },
  
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_actualizacion: {
    type: Date
  },
  
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID del usuario que crea el método es requerido']
  },
  
  actualizado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  
  notas: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  }
}, {
  timestamps: true,
  collection: 'metodos_pago'
});



metodoPagoSchema.pre('validate', function(next) {
  const errors = [];
  
  switch (this.tipo_cuenta) {
    case 'cuenta_bancaria':
      if (!this.informacion_bancaria.nombre_banco) {
        errors.push('El nombre del banco es requerido para cuenta bancaria');
      }
      if (!this.informacion_bancaria.numero_cuenta) {
        errors.push('El número de cuenta es requerido para cuenta bancaria');
      }
      break;
      
    case 'paypal':
      if (!this.informacion_bancaria.email_paypal) {
        errors.push('El email de PayPal es requerido');
      }
      break;
      
    case 'transferencia_internacional':
      if (!this.informacion_bancaria.codigo_swift) {
        errors.push('El código SWIFT es requerido para transferencia internacional');
      }
      if (!this.informacion_bancaria.direccion_banco) {
        errors.push('La dirección del banco es requerida para transferencia internacional');
      }
      break;
      
    case 'zelle':
      if (!this.informacion_bancaria.telefono_zelle && !this.informacion_bancaria.email_zelle) {
        errors.push('Se requiere teléfono o email para Zelle');
      }
      break;
      
    case 'wise':
      if (!this.informacion_bancaria.email_wise) {
        errors.push('El email de Wise es requerido');
      }
      break;
      
    case 'otro':
      if (!this.informacion_bancaria.nombre_metodo_otro) {
        errors.push('El nombre del método personalizado es requerido');
      }
      if (!this.informacion_bancaria.detalles_metodo_otro) {
        errors.push('Los detalles del método personalizado son requeridos');
      }
      break;
  }
  
  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.name = 'ValidationError';
    return next(error);
  }
  
  next();
});


metodoPagoSchema.methods.registrarUso = function() {
  this.veces_utilizado += 1;
  this.ultimo_uso = new Date();
  return this.save();
};

metodoPagoSchema.methods.getResumen = function() {
  let detalles = '';
  
  switch (this.tipo_cuenta) {
    case 'cuenta_bancaria':
      detalles = `${this.informacion_bancaria.nombre_banco} - •••${this.informacion_bancaria.numero_cuenta?.slice(-4)}`;
      break;
    case 'paypal':
      detalles = this.informacion_bancaria.email_paypal;
      break;
    case 'zelle':
      detalles = this.informacion_bancaria.telefono_zelle || this.informacion_bancaria.email_zelle;
      break;
    case 'wise':
      detalles = this.informacion_bancaria.email_wise;
      break;
    case 'transferencia_internacional':
      detalles = `SWIFT: ${this.informacion_bancaria.codigo_swift}`;
      break;
    case 'otro':
      detalles = this.informacion_bancaria.nombre_metodo_otro;
      break;
    default:
      detalles = 'Método de pago';
  }
  
  return {
    id: this._id,
    nombre: this.nombre,
    tipo: this.tipo_cuenta,
    detalles,
    titular: `${this.informacion_bancaria.nombre_titular} ${this.informacion_bancaria.apellido_titular}`,
    activo: this.activo,
    fecha_creacion: this.fecha_creacion
  };
};


metodoPagoSchema.index({ beneficiarioId: 1, activo: 1 });
metodoPagoSchema.index({ beneficiarioId: 1, fecha_creacion: -1 });

export const MetodoPago = mongoose.model('MetodoPago', metodoPagoSchema);

