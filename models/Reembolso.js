import mongoose from 'mongoose';

// Definición del esquema para el historial de reembolsos
const historialReembolsoSchema = new mongoose.Schema({
  accion: {
    type: String,
    enum: ['CREACION', 'ACTIVACION', 'DESACTIVACION', 'USO', 'MODIFICACION'],
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  detalles: String
});

// Definición del esquema principal de reembolso
const reembolsoSchema = new mongoose.Schema({
  // Referencia al usuario
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario',
    required: true,
    index: true
  },
  
  // Código único de reembolso
  codigo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Monto del reembolso
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Moneda del monto
  moneda: {
    type: String,
    enum: ['USD', 'EUR', 'MXN'],
    default: 'USD'
  },
  
  // Servicios a los que aplica el reembolso
  servicios_aplicables: [{
    type: String,
    enum: ['vuelo', 'hospedaje', 'transporte', 'paquete', 'reembolso'],
    default: 'vuelo'
  }],
  
  // Estado del código (activo/inactivo)
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Indica si el código ya expiró
  expirado: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Fechas relevantes
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  fecha_expiracion: {
    type: Date,
    required: true,
    index: true
  },
  
  // Usuario que creó el reembolso
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  
  // Observaciones o notas adicionales
  observaciones: {
    type: String,
    default: ''
  },
  
  // Historial de acciones
  historial: [historialReembolsoSchema]
}, {
  timestamps: true,
  collection: 'reembolsos'
});
reembolsoSchema.index({ 'usuario_id': 1 });
reembolsoSchema.index({ 'codigo': 1 }, { unique: true });
reembolsoSchema.index({ 'historial.usuario': 1 });
// Middleware pre-save para actualizar el estado de expiración
reembolsoSchema.pre('save', function(next) {
  // Verificar si ha expirado
  this.expirado = new Date() > this.fecha_expiracion;
  next();
});

// Middleware pre-find para actualizar expirados automáticamente
reembolsoSchema.pre('find', function() {
  // Este middleware modifica la consulta para actualizar el estado 'expirado'
  // si la fecha de expiración ya pasó
  this.updateMany(
    { 
      expirado: false, 
      fecha_expiracion: { $lt: new Date() } 
    },
    { 
      $set: { expirado: true } 
    }
  );
});

// Modelo exportado
export const Reembolso = mongoose.model('Reembolso', reembolsoSchema);