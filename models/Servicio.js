// models/Servicio.js - Updated model
import mongoose from 'mongoose';

const servicioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  tipoUsuario: {
    type: String,
    enum: ['beneficiario', 'aliado', 'ambos'],
    default: 'ambos'
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo', 'pendiente_activacion'],
    default: 'pendiente_activacion'
  },
  // Configuración específica para cada tipo de beneficio
  configuracion: {
    // Para Vouchers Flyback
    voucher_config: {
      valor_individual: { type: Number, default: 500 }, // USD
      limite_renovaciones: { type: Number, default: 10 },
      renovacion_anual: { type: Boolean, default: true }
    },
    
    // Para Reembolso de Costos
    reembolso_config: {
      anos_reembolso: { type: Number, default: 25 },
      porcentaje_prima: { type: Number, default: 5.75 }
    },
    
    // Para Financiamiento de seña
    financiamiento_config: {
      tasa_interes: { type: Number, default: 7 }, // Porcentaje
      max_mensualidades: { type: Number, default: 6 }
    }
  },
  
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  actualizado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  }
}, {
  timestamps: true
});

export const Servicio = mongoose.model('Servicio', servicioSchema);