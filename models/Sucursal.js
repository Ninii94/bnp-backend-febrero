// server/models/Sucursal.js
import mongoose from 'mongoose';

const sucursalSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    required: true
  },
  telefono: String,
  correo: String,
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aliado'
  },
  activo: {
    type: Boolean,
    default: true
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'sucursals' 
});
export const Sucursal = mongoose.model('Sucursal', sucursalSchema);