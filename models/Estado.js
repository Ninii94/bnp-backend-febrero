// models/Estado.js
import mongoose from 'mongoose';

const estadoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['BENEFICIARIO', 'ALIADO', 'SUCURSAL', 'SERVICIO', 'CERTIFICADO_VUELO'],
    required: true
  },
  codigo: {
    type: String,
    required: true,
    unique: true
  }
});

export const Estado = mongoose.model('Estado', estadoSchema);