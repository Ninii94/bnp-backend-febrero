import mongoose from 'mongoose';

const mensajePagoSchema = new mongoose.Schema({
  remitente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  destinatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  asunto: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  mensaje: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  leido: {
    type: Boolean,
    default: false
  },
  fecha_envio: {
    type: Date,
    default: Date.now
  },
  fecha_lectura: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});


mensajePagoSchema.index({ destinatario: 1, fecha_envio: -1 });
mensajePagoSchema.index({ remitente: 1, fecha_envio: -1 });
mensajePagoSchema.index({ leido: 1, destinatario: 1 });

export const MensajePago = mongoose.model('MensajePago', mensajePagoSchema);