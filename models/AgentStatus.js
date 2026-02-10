import mongoose from 'mongoose';

const agentStatusSchema = new mongoose.Schema({
  agentId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  agentName: { 
    type: String, 
    required: true 
  },
  email: {
    type: String
  },
  socketId: {
    type: String
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  isAvailable: { 
    type: Boolean, 
    default: false 
  },
  activeChats: [{ 
    type: String 
  }],
  maxConcurrentChats: { 
    type: Number, 
    default: 3 
  },
  lastActivity: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: {
    type: Date
  },
  lastLogout: {
    type: Date
  },
  // Estadísticas diarias
  dailyStats: {
    date: { type: Date, default: () => new Date().setHours(0,0,0,0) },
    totalChats: { type: Number, default: 0 },
    completedChats: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }, // en segundos
    totalOnlineTime: { type: Number, default: 0 }, // en minutos
    totalMessages: { type: Number, default: 0 },
    customerRatings: {
      total: { type: Number, default: 0 },
      sum: { type: Number, default: 0 },
      average: { type: Number, default: 0 }
    }
  },
  // Estadísticas semanales
  weeklyStats: {
    weekStart: { type: Date },
    totalChats: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  },
  // Estadísticas generales
  stats: {
    totalChats: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  // Configuración del agente
  settings: {
    autoAcceptChats: { type: Boolean, default: true },
    maxChatTime: { type: Number, default: 30 }, 
    notifications: {
      email: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '18:00' },
      timezone: { type: String, default: 'America/Sao_Paulo' }
    }
  },
  // Estado de la sesión de trabajo
  currentSession: {
    startTime: Date,
    endTime: Date,
    chatsHandled: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ['active', 'break', 'lunch', 'meeting', 'offline'],
      default: 'offline'
    }
  }
}, {
  timestamps: true
});

// Índices
agentStatusSchema.index({ agentId: 1 });
agentStatusSchema.index({ isOnline: 1, isAvailable: 1 });
agentStatusSchema.index({ lastActivity: -1 });
agentStatusSchema.index({ 'dailyStats.date': 1 });

// Middleware para actualizar estadísticas
agentStatusSchema.pre('save', function(next) {
  const today = new Date().setHours(0,0,0,0);
  
  if (!this.dailyStats.date || this.dailyStats.date.getTime() !== today) {
    this.dailyStats = {
      date: new Date(today),
      totalChats: 0,
      completedChats: 0,
      averageResponseTime: 0,
      totalOnlineTime: 0,
      totalMessages: 0,
      customerRatings: {
        total: 0,
        sum: 0,
        average: 0
      }
    };
  }
  
  // Calcular promedio de calificaciones
  if (this.dailyStats.customerRatings.total > 0) {
    this.dailyStats.customerRatings.average = 
      this.dailyStats.customerRatings.sum / this.dailyStats.customerRatings.total;
  }
  
  next();
});

// Métodos del modelo
agentStatusSchema.methods.setOnline = function(socketId = null) {
  this.isOnline = true;
  this.lastActivity = new Date();
  this.lastLogin = new Date();
  
  if (socketId) {
    this.socketId = socketId;
  }
  
  if (!this.currentSession.startTime) {
    this.currentSession.startTime = new Date();
    this.currentSession.status = 'active';
  }
  
  return this.save();
};

agentStatusSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.isAvailable = false;
  this.lastLogout = new Date();
  this.socketId = null;
  
  // Calcular tiempo de sesión
  if (this.currentSession.startTime) {
    this.currentSession.endTime = new Date();
    const sessionDuration = Math.floor(
      (this.currentSession.endTime - this.currentSession.startTime) / (1000 * 60)
    );
    this.dailyStats.totalOnlineTime += sessionDuration;
    this.stats.totalHours += sessionDuration / 60;
  }
  
  this.currentSession = {
    chatsHandled: 0,
    status: 'offline'
  };
  
  return this.save();
};

agentStatusSchema.methods.setAvailable = function(available = true) {
  this.isAvailable = available;
  this.lastActivity = new Date();
  
  if (available) {
    this.currentSession.status = 'active';
  }
  
  return this.save();
};

agentStatusSchema.methods.addChat = function(sessionId) {
  if (!this.activeChats.includes(sessionId)) {
    this.activeChats.push(sessionId);
    this.dailyStats.totalChats += 1;
    this.stats.totalChats += 1;
    this.currentSession.chatsHandled += 1;
    this.lastActivity = new Date();
  }
  
  return this.save();
};

agentStatusSchema.methods.removeChat = function(sessionId) {
  this.activeChats = this.activeChats.filter(id => id !== sessionId);
  this.lastActivity = new Date();
  
  return this.save();
};

agentStatusSchema.methods.completeChat = function(sessionId, rating = null) {
  this.removeChat(sessionId);
  this.dailyStats.completedChats += 1;
  
  if (rating && rating >= 1 && rating <= 5) {
    this.dailyStats.customerRatings.total += 1;
    this.dailyStats.customerRatings.sum += rating;
    this.dailyStats.customerRatings.average = 
      this.dailyStats.customerRatings.sum / this.dailyStats.customerRatings.total;
      
    // Actualizar estadísticas generales
    this.stats.averageRating = this.dailyStats.customerRatings.average;
  }
  
  // Calcular tasa de finalización
  if (this.stats.totalChats > 0) {
    this.stats.completionRate = 
      (this.dailyStats.completedChats / this.stats.totalChats) * 100;
  }
  
  return this.save();
};

agentStatusSchema.methods.addMessage = function() {
  this.dailyStats.totalMessages += 1;
  this.stats.totalMessages += 1;
  this.lastActivity = new Date();
  
  return this.save();
};

agentStatusSchema.methods.canAcceptNewChat = function() {
  return this.isOnline && 
         this.isAvailable && 
         this.activeChats.length < this.maxConcurrentChats;
};

// estaticos
agentStatusSchema.statics.findAvailableAgents = function() {
  return this.find({
    isOnline: true,
    isAvailable: true,
    $expr: { $lt: [{ $size: '$activeChats' }, '$maxConcurrentChats'] }
  }).sort({ 'activeChats': 1, lastActivity: 1 });
};

agentStatusSchema.statics.getOnlineAgents = function() {
  return this.find({ isOnline: true }).sort({ lastActivity: -1 });
};

agentStatusSchema.statics.getDailyStats = function(date = new Date()) {
  const dayStart = new Date(date.setHours(0,0,0,0));
  
  return this.aggregate([
    {
      $match: {
        'dailyStats.date': dayStart
      }
    },
    {
      $group: {
        _id: null,
        totalAgents: { $sum: 1 },
        onlineAgents: {
          $sum: { $cond: ['$isOnline', 1, 0] }
        },
        availableAgents: {
          $sum: { $cond: ['$isAvailable', 1, 0] }
        },
        totalChats: { $sum: '$dailyStats.totalChats' },
        totalMessages: { $sum: '$dailyStats.totalMessages' },
        averageRating: { $avg: '$dailyStats.customerRatings.average' },
        totalOnlineTime: { $sum: '$dailyStats.totalOnlineTime' }
      }
    }
  ]);
};

agentStatusSchema.statics.resetDailyStats = function() {
  const today = new Date().setHours(0,0,0,0);
  
  return this.updateMany(
    {
      $or: [
        { 'dailyStats.date': { $lt: new Date(today) } },
        { 'dailyStats.date': { $exists: false } }
      ]
    },
    {
      $set: {
        'dailyStats.date': new Date(today),
        'dailyStats.totalChats': 0,
        'dailyStats.completedChats': 0,
        'dailyStats.averageResponseTime': 0,
        'dailyStats.totalOnlineTime': 0,
        'dailyStats.totalMessages': 0,
        'dailyStats.customerRatings.total': 0,
        'dailyStats.customerRatings.sum': 0,
        'dailyStats.customerRatings.average': 0
      }
    }
  );
};

const AgentStatus = mongoose.model('AgentStatus', agentStatusSchema);

export { AgentStatus };