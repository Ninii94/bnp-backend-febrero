import mongoose from 'mongoose';

const estadisticaAliadoSchema = new mongoose.Schema({
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aliado',
    required: true
  },
  sucursal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: false  
  },

  fecha_creacion: {
    type: Date,
    default: Date.now,
    required: true
  },
  mes: {
    type: Number,
    required: true
  },
  año: {
    type: Number,
    required: true
  },
  ventas_totales: {
    type: Number,
    required: true,
    default: 0
  },
  metas_cumplidas: {
    type: Boolean,
    default: false
  },
  notas: [{
    texto: String,
    fecha: {
      type: Date,
      default: Date.now
    }
  }]
});

// búsquedas por fecha
estadisticaAliadoSchema.index({ fecha_creacion: 1, aliado_id: 1 });


estadisticaAliadoSchema.index({ aliado_id: 1, sucursal_id: 1, fecha_creacion: 1 });


//  limpiar estadísticas al final del mes
estadisticaAliadoSchema.statics.limpiarEstadisticasAnteriores = async function() {
  const fechaActual = new Date();
  const primerDiaMesActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  
  try {
    await this.deleteMany({
      fecha_creacion: { $lt: primerDiaMesActual }
    });
    console.log('Estadísticas anteriores eliminadas correctamente');
  } catch (error) {
    console.error('Error al limpiar estadísticas:', error);
  }
};

export const EstadisticaAliado = mongoose.model('EstadisticaAliado', estadisticaAliadoSchema);