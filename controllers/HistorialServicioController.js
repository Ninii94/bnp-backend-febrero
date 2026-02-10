import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const usuarioSchema = new mongoose.Schema({
  nombre_usuario: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellido: {
    type: String,
    required: true,
    trim: true
  },
  correo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  telefono: {
    type: String,
    default: ""
  },
  tipo: {
    type: String,
    enum: ['admin', 'aliado', 'beneficiario', 'equipo'],
    default: 'beneficiario'
  },
  foto: {
    type: String,
    default: ""
  },
  
  // Campos específicos de Aliado
  inicio_contrato: {
    type: Date,
    default: null
  },
  fin_contrato: {
    type: Date,
    default: null
  },
  departamento: {
    type: String,
    default: ""
  },
  
  // Campos específicos de Beneficiario
  nacionalidad: {
    type: String,
    default: ""
  },
  genero: {
    type: String,
    enum: ['masculino', 'femenino', 'prefiero no decirlo'],
    default: 'prefiero no decirlo'
  },
  estado_civil: {
    type: String,
    enum: ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado'],
    default: 'no especificado'
  },
  direccion: {
    type: String,
    default: ""
  },
  
  // Relaciones
  hotel_aliado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  aliado_sucursal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sucursal',
    default: null
  },
  
  // Servicios
  servicios: {
    type: [mongoose.Schema.Types.Mixed], // Puede ser ObjectId o string (formato antiguo)
    default: []
  },
  
  // Estado de usuario
  estado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estado',
    default: null
  },
  estado: {
    type: String,
    default: "Pendiente de Verificación"
  },
  
  // Enganche pagado
  enganche_pagado: {
    valor: {
      type: Number,
      default: 0
    },
    moneda: {
      type: String,
      default: 'dolares'
    }
  },
  
  // Fechas
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  // Códigos de reembolso
  codigo: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Datos de aliado para beneficiario
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  aliado_nombre: {
    type: String,
    default: ""
  },
  aliado_telefono: {
    type: String,
    default: ""
  },
  
  // Datos de sucursal
  sucursal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sucursal',
    default: null
  },
  sucursal_nombre: {
    type: String,
    default: ""
  }
});

// Método para verificar contraseña
usuarioSchema.methods.verificarPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Middleware para encriptar contraseña antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método virtual para obtener el historial de servicios
usuarioSchema.virtual('historialServicios', {
  ref: 'HistorialServicio',
  localField: '_id',
  foreignField: 'usuarioId',
  options: { sort: { fecha: -1 } }
});

export const Usuario = mongoose.model('Usuario', usuarioSchema);