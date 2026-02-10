import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const usuarioSchema = new mongoose.Schema({
  nombre_usuario: {
    type: String,
    required: true,
    unique: true
  },
  servicios: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  contrasena: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true,
    unique: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['equipo_bnp', 'aliado', 'beneficiario']
  },
  activo: {
    type: Boolean,
    default: true
  },
  reset_token: {
    type: String,
    default: undefined
  },
  reset_token_expiry: {
    type: Date,
    default: undefined
  },
  // ✅ Contador de inicios de sesión
  inicios_sesion: {
    type: Number,
    default: 0
  },
  // ✅ Fecha del primer inicio de sesión
  primer_inicio_sesion: {
    type: Date,
    default: undefined
  },
  // ✅ NO marcamos bienvenida como completada al crear
  bienvenida_completada: {
    type: Boolean,
    default: false  // ⭐ SIEMPRE EMPIEZA EN false
  },
  opciones_bienvenida: {
    opcion_seleccionada: {
      type: String,
      enum: ['conocer_mas', 'estoy_bien', 'menu_preguntas', 'activar_beneficios'],
      default: undefined
    },
    fecha_completada: {
      type: Date,
      default: undefined
    }
  }
}, {
  timestamps: true
});

// ✅ SOLO hash de contraseña - SIN marcar bienvenida
usuarioSchema.pre('save', async function(next) {
  try {
    // Hash de contraseña solo si fue modificada
    if (this.isModified('contrasena')) {
      const salt = await bcrypt.genSalt(10);
      this.contrasena = await bcrypt.hash(this.contrasena, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
usuarioSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.contrasena);
};

// ✅ Método para registrar inicio de sesión
usuarioSchema.methods.registrarInicioSesion = async function() {
  this.inicios_sesion = (this.inicios_sesion || 0) + 1;
  
  // Si es el primer inicio, guardar la fecha
  if (this.inicios_sesion === 1) {
    this.primer_inicio_sesion = new Date();
  }
  
  return this.save();
};

// ✅ Método para verificar si debe mostrar bienvenida
usuarioSchema.methods.deberMostrarBienvenida = function() {
  return (
    this.tipo === 'beneficiario' && 
    this.inicios_sesion === 1 && 
    !this.bienvenida_completada
  );
};

// Método para marcar bienvenida como completada
usuarioSchema.methods.completarBienvenida = async function(opcionSeleccionada) {
  this.bienvenida_completada = true;
  this.opciones_bienvenida = {
    opcion_seleccionada: opcionSeleccionada || 'estoy_bien',
    fecha_completada: new Date()
  };
  return this.save();
};

// Método para obtener datos públicos del usuario (sin contraseña)
usuarioSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.contrasena;
  delete obj.reset_token;
  delete obj.reset_token_expiry;
  return obj;
};

// Índices para optimizar búsquedas
usuarioSchema.index({ correo: 1 });
usuarioSchema.index({ nombre_usuario: 1 });
usuarioSchema.index({ tipo: 1 });
usuarioSchema.index({ activo: 1 });
usuarioSchema.index({ bienvenida_completada: 1, tipo: 1 });
usuarioSchema.index({ inicios_sesion: 1, tipo: 1 });

export const Usuario = mongoose.model('Usuario', usuarioSchema);