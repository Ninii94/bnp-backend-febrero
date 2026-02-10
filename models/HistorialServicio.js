// models/HistorialServicio.js
import mongoose from 'mongoose';

const historialServicioSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Usuario'
  },
  servicioId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Servicio'
  },
  servicioNombre: {
    type: String,
    required: true
  },
  // Distinguir entre diferentes tipos de acciones
  accion: {
    type: String,
    enum: [
      'asignado',      // Servicio asignado pero no activo (beneficiarios)
      'activado',      // Servicio activo y funcional
      'desactivado',   // Servicio desactivado
      'suspendido',    // Servicio temporalmente suspendido
      'reactivado',     // Servicio reactivado después de suspensión
     'pendiente_activacion'
    ],
    required: true
  },
  // Fechas separadas para asignación y activación
  fecha_asignacion: {
    type: Date,
    default: Date.now
  },
  fecha_activacion: {
    type: Date,
    default: null // Solo se llena cuando el servicio se activa realmente
  },
  fecha: {
    type: Date,
    default: Date.now // Fecha del registro (para compatibilidad)
  },
  // Estado actual del servicio
  estado_actual: {
    type: String,
    enum: ['asignado', 'activo', 'inactivo', 'suspendido','pendiente_activacion'],
    default: 'asignado'
  },
  // Diferenciación por tipo de usuario
  tipo_usuario: {
    type: String,
    enum: ['beneficiario', 'aliado'],
    required: true
  },
  usuario: {
    type: String,
    default: 'Sistema'
  },
  // Notas adicionales sobre la acción
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
historialServicioSchema.index({ usuarioId: 1, fecha: -1 });
historialServicioSchema.index({ servicioId: 1 });
historialServicioSchema.index({ estado_actual: 1 });
historialServicioSchema.index({ tipo_usuario: 1 });
historialServicioSchema.index({ accion: 1 });

// Método para obtener servicios activos de un usuario
historialServicioSchema.statics.getServiciosActivos = async function(usuarioId) {
  const pipeline = [
    { $match: { usuarioId: new mongoose.Types.ObjectId(usuarioId) } },
    { $sort: { fecha: -1 } },
    { 
      $group: {
        _id: '$servicioId',
        ultimoRegistro: { $first: '$$ROOT' }
      }
    },
    { $match: { 'ultimoRegistro.estado_actual': 'activo' } },
    { $replaceRoot: { newRoot: '$ultimoRegistro' } }
  ];
  
  return this.aggregate(pipeline);
};

// Método para obtener servicios asignados (inactivos) de un usuario
historialServicioSchema.statics.getServiciosAsignados = async function(usuarioId) {
  const pipeline = [
    { $match: { usuarioId: new mongoose.Types.ObjectId(usuarioId) } },
    { $sort: { fecha: -1 } },
    { 
      $group: {
        _id: '$servicioId',
        ultimoRegistro: { $first: '$$ROOT' }
      }
    },
    { $match: { 'ultimoRegistro.estado_actual': 'asignado' } },
    { $replaceRoot: { newRoot: '$ultimoRegistro' } }
  ];
  
  return this.aggregate(pipeline);
};
historialServicioSchema.index({ 
  usuarioId: 1, 
  servicioId: 1, 
  accion: 1, 
  fecha: 1 
}, { 
  unique: false, // No unique para permitir el mismo servicio con diferentes fechas
  background: true,
  name: 'idx_usuario_servicio_accion_fecha'
});
historialServicioSchema.statics.verificarDuplicado = async function(usuarioId, servicioId, accion, fecha) {
  const fechaLimite = new Date(fecha.getTime() - 60000); // 1 minuto antes
  const fechaLimiteSuperior = new Date(fecha.getTime() + 60000); // 1 minuto después
  
  const duplicado = await this.findOne({
    usuarioId: usuarioId,
    servicioId: servicioId,
    accion: accion,
    fecha: {
      $gte: fechaLimite,
      $lte: fechaLimiteSuperior
    }
  });
  
  return !!duplicado;
};
historialServicioSchema.statics.limpiarDuplicados = async function() {
  console.log('[CLEANUP] Iniciando limpieza de duplicados...');
  
  const pipeline = [
    {
      $group: {
        _id: {
          usuarioId: '$usuarioId',
          servicioId: '$servicioId',
          accion: '$accion',
          fecha: {
            $dateToString: {
              format: '%Y-%m-%d %H:%M',
              date: '$fecha'
            }
          }
        },
        registros: { $push: '$$ROOT' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ];
  
  const duplicados = await this.aggregate(pipeline);
  let eliminados = 0;
  
  for (const grupo of duplicados) {
    // Mantener solo el primer registro, eliminar el resto
    const registrosAEliminar = grupo.registros.slice(1);
    
    for (const registro of registrosAEliminar) {
      await this.findByIdAndDelete(registro._id);
      eliminados++;
    }
  }
  
  console.log(`[CLEANUP] Duplicados eliminados: ${eliminados}`);
  return eliminados;
};
// Método para obtener todos los servicios de un usuario con su último estado
historialServicioSchema.statics.getResumenServicios = async function(usuarioId) {
  const pipeline = [
    { $match: { usuarioId: new mongoose.Types.ObjectId(usuarioId) } },
    { $sort: { fecha: -1 } },
    { 
      $group: {
        _id: '$servicioId',
        ultimoRegistro: { $first: '$$ROOT' }
      }
    },
    {
      $lookup: {
        from: 'servicios',
        localField: '_id',
        foreignField: '_id',
        as: 'servicio_info'
      }
    },
    { $unwind: '$servicio_info' },
    {
      $project: {
        servicioId: '$_id',
        servicioNombre: '$ultimoRegistro.servicioNombre',
        estado_actual: '$ultimoRegistro.estado_actual',
        accion: '$ultimoRegistro.accion',
        fecha_asignacion: '$ultimoRegistro.fecha_asignacion',
        fecha_activacion: '$ultimoRegistro.fecha_activacion',
        fecha_ultima_accion: '$ultimoRegistro.fecha',
        servicio_descripcion: '$servicio_info.descripcion',
        tipo_usuario: '$ultimoRegistro.tipo_usuario'
      }
    },
    { $sort: { fecha_asignacion: -1 } }
  ];
  
  return this.aggregate(pipeline);
};

export const HistorialServicio = mongoose.model('HistorialServicio', historialServicioSchema);