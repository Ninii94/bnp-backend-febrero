
import mongoose from 'mongoose';

const chatMetricsSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true 
  },
  // Métricas basicas
  totalChats: { 
    type: Number, 
    default: 0 
  },
  activeChats: { 
    type: Number, 
    default: 0 
  },
  waitingChats: { 
    type: Number, 
    default: 0 
  },
  completedChats: { 
    type: Number, 
    default: 0 
  },
  abandonedChats: { 
    type: Number, 
    default: 0 
  },
  
  // tiempo
  averageWaitTime: { 
    type: Number, 
    default: 0 
  }, // seg
  averageChatDuration: { 
    type: Number, 
    default: 0 
  }, // seg
  averageResponseTime: { 
    type: Number, 
    default: 0 
  }, // tiempo de respuesta
  
  // satisfaccion
  customerSatisfaction: { 
    type: Number, 
    default: 0 
  }, // prom de ratings
  totalRatings: {
    type: Number,
    default: 0
  },
  ratingsSum: {
    type: Number,
    default: 0
  },
  
  // agentes
  agentsOnline: { 
    type: Number, 
    default: 0 
  },
  agentsAvailable: { 
    type: Number, 
    default: 0 
  },
  totalAgents: {
    type: Number,
    default: 0
  },
  
  // Distribución por horas pico
  peakHours: [{
    hour: { type: Number }, 
    chatCount: { type: Number },
    averageWaitTime: { type: Number },
    agentsOnline: { type: Number }
  }],
  
  //  tipo de cliente
  chatsByType: {
    beneficiario: { 
      type: Number, 
      default: 0 
    },
    aliado: { 
      type: Number, 
      default: 0 
    }
  },
  
  // detalladas por tipo
  typeMetrics: {
    beneficiario: {
      totalChats: { type: Number, default: 0 },
      averageWaitTime: { type: Number, default: 0 },
      averageDuration: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 }
    },
    aliado: {
      totalChats: { type: Number, default: 0 },
      averageWaitTime: { type: Number, default: 0 },
      averageDuration: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 }
    }
  },
  
  // Métricas de mensajes
  totalMessages: {
    type: Number,
    default: 0
  },
  messagesPerChat: {
    type: Number,
    default: 0
  },
  
  // Métricas de calidad
  firstContactResolution: {
    type: Number,
    default: 0
  }, // porcentaje
  escalationRate: {
    type: Number,
    default: 0
  }, // porcentaje
  
  // Métricas de rendimiento
  maxConcurrentChats: {
    type: Number,
    default: 0
  },
  chatVolumeByHour: [{
    hour: Number,
    volume: Number
  }],
  
  // Datos adicionales para análisis
  systemLoad: {
    cpuUsage: { type: Number, default: 0 },
    memoryUsage: { type: Number, default: 0 },
    activeSockets: { type: Number, default: 0 }
  },
  
  // Métricas de conversión (si aplicable)
  conversion: {
    leadsGenerated: { type: Number, default: 0 },
    salesCompleted: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Índice único por fecha
chatMetricsSchema.index({ date: 1 }, { unique: true });
chatMetricsSchema.index({ date: -1 });

// Middleware para calcular promedios antes de guardar
chatMetricsSchema.pre('save', function(next) {
  // Calcular promedio de satisfacción del cliente
  if (this.totalRatings > 0) {
    this.customerSatisfaction = this.ratingsSum / this.totalRatings;
  }
  
  // Calcular mensajes por chat
  if (this.completedChats > 0) {
    this.messagesPerChat = this.totalMessages / this.completedChats;
  }
  
  // Calcular métricas por tipo
  const totalTypeChats = this.chatsByType.beneficiario + this.chatsByType.aliado;
  if (totalTypeChats > 0) {
    // Los cálculos específicos por tipo se harían con datos adicionales
    // que se pasarían al guardar las métricas
  }
  
  next();
});

// Métodos del modelo
chatMetricsSchema.methods.addChat = function(clientType) {
  this.totalChats += 1;
  this.chatsByType[clientType] += 1;
  this.typeMetrics[clientType].totalChats += 1;
  
  return this;
};

chatMetricsSchema.methods.completeChat = function(clientType, duration, rating = null) {
  this.completedChats += 1;
  this.averageChatDuration = this.calculateNewAverage(
    this.averageChatDuration, 
    this.completedChats - 1, 
    duration
  );
  
  // Actualizar métricas por tipo
  this.typeMetrics[clientType].averageDuration = this.calculateNewAverage(
    this.typeMetrics[clientType].averageDuration,
    this.typeMetrics[clientType].totalChats - 1,
    duration
  );
  
  if (rating) {
    this.addRating(rating, clientType);
  }
  
  return this;
};

chatMetricsSchema.methods.addRating = function(rating, clientType) {
  this.totalRatings += 1;
  this.ratingsSum += rating;
  this.customerSatisfaction = this.ratingsSum / this.totalRatings;
  
  // Actualizar por tipo
  const typeMetric = this.typeMetrics[clientType];
  if (typeMetric.totalChats > 0) {
    typeMetric.averageRating = this.calculateNewAverage(
      typeMetric.averageRating,
      this.totalRatings - 1,
      rating
    );
  }
  
  return this;
};

chatMetricsSchema.methods.updateWaitTime = function(waitTime, clientType) {
  this.averageWaitTime = this.calculateNewAverage(
    this.averageWaitTime,
    this.totalChats - 1,
    waitTime
  );
  
  this.typeMetrics[clientType].averageWaitTime = this.calculateNewAverage(
    this.typeMetrics[clientType].averageWaitTime,
    this.typeMetrics[clientType].totalChats - 1,
    waitTime
  );
  
  return this;
};

chatMetricsSchema.methods.updateAgentCounts = function(online, available, total) {
  this.agentsOnline = online;
  this.agentsAvailable = available;
  this.totalAgents = total;
  
  return this;
};

chatMetricsSchema.methods.addPeakHourData = function(hour, chatCount, waitTime, agentsOnline) {
  const existingHour = this.peakHours.find(p => p.hour === hour);
  
  if (existingHour) {
    existingHour.chatCount += chatCount;
    existingHour.averageWaitTime = this.calculateNewAverage(
      existingHour.averageWaitTime,
      existingHour.chatCount - chatCount,
      waitTime
    );
    existingHour.agentsOnline = agentsOnline;
  } else {
    this.peakHours.push({
      hour,
      chatCount,
      averageWaitTime: waitTime,
      agentsOnline
    });
  }
  
  return this;
};

chatMetricsSchema.methods.calculateNewAverage = function(currentAvg, currentCount, newValue) {
  if (currentCount === 0) return newValue;
  return ((currentAvg * currentCount) + newValue) / (currentCount + 1);
};

// Métodos estáticos
chatMetricsSchema.statics.getTodayMetrics = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.findOne({ date: today });
};

chatMetricsSchema.statics.getOrCreateTodayMetrics = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let metrics = await this.findOne({ date: today });
  
  if (!metrics) {
    metrics = new this({ date: today });
    await metrics.save();
  }
  
  return metrics;
};

chatMetricsSchema.statics.getDateRangeMetrics = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

chatMetricsSchema.statics.getWeeklyStats = function(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: weekStart,
          $lte: weekEnd
        }
      }
    },
    {
      $group: {
        _id: null,
        totalChats: { $sum: '$totalChats' },
        completedChats: { $sum: '$completedChats' },
        averageWaitTime: { $avg: '$averageWaitTime' },
        averageDuration: { $avg: '$averageChatDuration' },
        averageRating: { $avg: '$customerSatisfaction' },
        totalBeneficiarios: { $sum: '$chatsByType.beneficiario' },
        totalAliados: { $sum: '$chatsByType.aliado' }
      }
    }
  ]);
};

chatMetricsSchema.statics.getMonthlyStats = function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        totalChats: { $sum: '$totalChats' },
        completedChats: { $sum: '$completedChats' },
        averageWaitTime: { $avg: '$averageWaitTime' },
        averageDuration: { $avg: '$averageChatDuration' },
        averageRating: { $avg: '$customerSatisfaction' },
        agentsOnline: { $avg: '$agentsOnline' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

chatMetricsSchema.statics.getPeakHoursAnalysis = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate }
      }
    },
    { $unwind: '$peakHours' },
    {
      $group: {
        _id: '$peakHours.hour',
        totalChats: { $sum: '$peakHours.chatCount' },
        averageWaitTime: { $avg: '$peakHours.averageWaitTime' },
        averageAgentsOnline: { $avg: '$peakHours.agentsOnline' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

chatMetricsSchema.statics.getPerformanceReport = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        // Totales
        totalChats: { $sum: '$totalChats' },
        completedChats: { $sum: '$completedChats' },
        abandonedChats: { $sum: '$abandonedChats' },
        totalMessages: { $sum: '$totalMessages' },
        
        // Promedios
        avgWaitTime: { $avg: '$averageWaitTime' },
        avgChatDuration: { $avg: '$averageChatDuration' },
        avgResponseTime: { $avg: '$averageResponseTime' },
        avgSatisfaction: { $avg: '$customerSatisfaction' },
        avgMessagesPerChat: { $avg: '$messagesPerChat' },
        
        // Métricas de calidad
        avgFirstContactResolution: { $avg: '$firstContactResolution' },
        avgEscalationRate: { $avg: '$escalationRate' },
        
        // Por tipo de cliente
        totalBeneficiarios: { $sum: '$chatsByType.beneficiario' },
        totalAliados: { $sum: '$chatsByType.aliado' },
        
        // Capacidad
        maxConcurrentChats: { $max: '$maxConcurrentChats' },
        avgAgentsOnline: { $avg: '$agentsOnline' },
        avgAgentsAvailable: { $avg: '$agentsAvailable' }
      }
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$totalChats', 0] },
            { $multiply: [{ $divide: ['$completedChats', '$totalChats'] }, 100] },
            0
          ]
        },
        abandonmentRate: {
          $cond: [
            { $gt: ['$totalChats', 0] },
            { $multiply: [{ $divide: ['$abandonedChats', '$totalChats'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

const ChatMetrics = mongoose.model('ChatMetrics', chatMetricsSchema);

export { ChatMetrics };