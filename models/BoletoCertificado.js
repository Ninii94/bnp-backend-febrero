
import mongoose from 'mongoose';

const boletoCertificadoSchema = new mongoose.Schema({
  beneficiario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  numero_ticket: {
    type: String,
    unique: true,

  },
  tipo_reintegro: {
    type: String,
    enum: ['100%', 'parcial'],
    required: true
  },
  monto_solicitado: {
    type: Number,
    required: true,
    min: 0
  },
  monto_original: {
    type: Number,
    required: true
  },
  descripcion: {
    type: String,
    maxlength: 500
  },
  documento_pdf: {
    nombre_archivo: String,
    ruta_archivo: String,
    tamaño_archivo: Number,
    tipo_mime: String,
    fecha_subida: {
      type: Date,
      default: Date.now
    }
  },
  medio_pago_seleccionado: {
    id: String,
    tipo: String,
    nombre: String,
    detalles: String
  },
  estado: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobado', 'devuelto', 'rechazado'],
    default: 'pendiente'
  },
  fecha_solicitud: {
    type: Date,
    default: Date.now
  },
  fecha_revision: Date,
  fecha_procesamiento: Date,
  revisado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  notas_revision: {
    type: String,
    maxlength: 1000
  },
  historial_estados: [{
    estado_anterior: String,
    estado_nuevo: String,
    fecha_cambio: {
      type: Date,
      default: Date.now
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    motivo: String,
    notas: String
  }]
}, {
  timestamps: true
});

// Generar número de ticket automáticamente ANTES de validar
boletoCertificadoSchema.pre('validate', async function(next) {
  try {
    if (!this.numero_ticket) {
      console.log('🎫 Generando número de ticket...');
      
      const fecha = new Date();
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      
      // Buscar el último ticket del día
      const ultimoTicket = await this.constructor.findOne({
        numero_ticket: new RegExp(`^CERT-${año}${mes}${dia}-`)
      }).sort({ numero_ticket: -1 });
      
      let secuencial = 1;
      if (ultimoTicket) {
        const ultimoNumero = ultimoTicket.numero_ticket.split('-')[2];
        secuencial = parseInt(ultimoNumero) + 1;
      }
      
      this.numero_ticket = `CERT-${año}${mes}${dia}-${String(secuencial).padStart(4, '0')}`;
      console.log('✅ Número de ticket generado:', this.numero_ticket);
    }
    next();
  } catch (error) {
    console.error('❌ Error generando número de ticket:', error);
    next(error);
  }
});

// Middleware adicional para registrar cambios de estado
boletoCertificadoSchema.pre('save', function(next) {
  if (this.isModified('estado') && !this.isNew) {
    const estadoAnterior = this._original ? this._original.estado : 'pendiente';
    this.historial_estados.push({
      estado_anterior: estadoAnterior,
      estado_nuevo: this.estado,
      usuario: this.revisado_por,
      motivo: `Cambio de estado de ${estadoAnterior} a ${this.estado}`
    });
  }
  next();
});

export const BoletoCertificado = mongoose.model('BoletoCertificado', boletoCertificadoSchema);