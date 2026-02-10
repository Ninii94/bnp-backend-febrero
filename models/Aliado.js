import mongoose from 'mongoose';

const aliadoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  telefono: String,
  nacionalidad: String,
  direccion: String,
  correo: String,
  info_contacto: String,
  estado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estado'
  },
  inicio_contrato: Date,
  fin_contrato: Date,
  cantidad_ventas: {
    type: Number,
    default: 0
  },
  metricas_rendimiento: {
    type: Number,
    default: 0
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  departamento: String,
  colaborador_bnp: String,
  ruc: String,
  razon_social: String,
  tipo_servicio: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Servicio'
  }], // Cambiado para referenciar servicios
  sucursal: String,
  foto: String,
  portada: String,
  descripcion: String,
  sucursales: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sucursal'
  }],
  servicios: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Servicio'
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
  }]
});

export const Aliado = mongoose.model('Aliado', aliadoSchema);