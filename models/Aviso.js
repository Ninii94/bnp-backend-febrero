
import mongoose from 'mongoose';

const AvisoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  contenido: {
    type: String,
    required: true,
    trim: true
  },
  imagen: {
    type: String 
  },
  videoUrl: {
    type: String,
    trim: true
  },
  fijado: {
    type: Boolean,
    default: false
  },
  autor: {
    type: String,
    required: true
  },
  autorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Usuario'
  },
  autorTipo: {
    type: String,
    enum: ['equipo_bnp', 'aliado'],
    default: 'equipo_bnp'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const Aviso = mongoose.model('Aviso', AvisoSchema);