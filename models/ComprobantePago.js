import mongoose from 'mongoose';

const comprobantePagoSchema = new mongoose.Schema({
  beneficiario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  titulo: {
    type: String,
    default: function() {
      const fecha = new Date();
      const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      return `Comprobante de pago ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
    }
  },
  archivo: {
    url: { type: String, required: true },
    public_id: String,
    nombre_original: String,
    tipo: String, 
    tamano: Number
  },
  estado: {
    type: String,
    enum: ['recibido', 'pago_rechazado', 'pago_confirmado'],
    default: 'recibido'
  },
  observaciones: String, 
  fecha_subida: {
    type: Date,
    default: Date.now
  },
  fecha_revision: Date,
  revisado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const ComprobantePago = mongoose.model('ComprobantePago', comprobantePagoSchema);