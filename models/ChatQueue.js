import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  clientType: {
    type: String,
    enum: ['beneficiario', 'aliado'],
    required: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  joinTime: {
    type: Date,
    default: Date.now
  },
  estimatedWaitTime: {
    type: Number, // en seg
    default: 0
  },
  status: {
    type: String,
    enum: ['waiting', 'assigned', 'expired', 'cancelled'],
    default: 'waiting'
  },
  assignedAgent: {
    agentId: String,
    agentName: String,
    assignedAt: Date
  },
  clientInfo: {
    socketId: String,
    userAgent: String,
    ip: String,
    location: String,
    previousChats: { type: Number, default: 0 },
    isVIP: { type: Boolean, default: false }
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  notifications: [{
    type: { type: String, enum: ['position_update', 'wait_time_update', 'agent_soon'] },
    sentAt: Date,
    message: String
  }],
  metrics: {
    actualWaitTime: Number, // tiempo real espera en seg
    positionChanges: { type: Number, default: 0 },
    notificationsSent: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// para optimizar consultas
queueEntrySchema.index({ status: 1, priority: -1, joinTime: 1 });
queueEntrySchema.index({ clientId: 1 });
queueEntrySchema.index({ sessionId: 1 });
queueEntrySchema.index({ joinTime: 1 });
queueEntrySchema.index({ status: 1, joinTime: 1 });

// calcular tiempo de espera
queueEntrySchema.pre('save', function(next) {
  if (this.status === 'assigned' && !this.metrics.actualWaitTime) {
    this.metrics.actualWaitTime = Math.floor((new Date() - this.joinTime) / 1000);
  }
  next();
});


queueEntrySchema.methods.updatePosition = function(newPosition) {
  this.metrics.positionChanges += 1;
  
  // Estimar tiempo de espera basado en posición
  const avgChatDuration = 300; 
  const avgAgentsAvailable = 2;
  
  this.estimatedWaitTime = Math.ceil((newPosition * avgChatDuration) / avgAgentsAvailable);
  
  return this.save();
};

queueEntrySchema.methods.assignToAgent = function(agentId, agentName) {
  this.status = 'assigned';
  this.assignedAgent = {
    agentId,
    agentName,
    assignedAt: new Date()
  };
  this.metrics.actualWaitTime = Math.floor((new Date() - this.joinTime) / 1000);
  
  return this.save();
};

queueEntrySchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

queueEntrySchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

queueEntrySchema.methods.addNotification = function(type, message) {
  this.notifications.push({
    type,
    sentAt: new Date(),
    message
  });
  this.metrics.notificationsSent += 1;
  
  return this.save();
};

queueEntrySchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  
  if (this.retryCount >= this.maxRetries) {
    this.status = 'expired';
  }
  
  return this.save();
};

queueEntrySchema.methods.getWaitTime = function() {
  if (this.status === 'assigned') {
    return this.metrics.actualWaitTime;
  }
  return Math.floor((new Date() - this.joinTime) / 1000);
};

// Métodos estáticos
queueEntrySchema.statics.getActiveQueue = function() {
  return this.find({ 
    status: 'waiting' 
  }).sort({ 
    priority: -1,  // Mayor prioridad primero
    joinTime: 1    // FIFO para misma prioridad
  });
};

queueEntrySchema.statics.getQueuePosition = function(sessionId) {
  return this.aggregate([
    { $match: { status: 'waiting' } },
    { $sort: { priority: -1, joinTime: 1 } },
    { $group: { 
      _id: null, 
      entries: { $push: '$$ROOT' } 
    }},
    { $unwind: { path: '$entries', includeArrayIndex: 'position' } },
    { $match: { 'entries.sessionId': sessionId } },
    { $project: { position: { $add: ['$position', 1] } } }
  ]);
};

queueEntrySchema.statics.updateAllPositions = async function() {
  const queue = await this.getActiveQueue();
  
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    await entry.updatePosition(i + 1);
  }
  
  return queue.length;
};

queueEntrySchema.statics.getNextInQueue = function(excludeAssigned = true) {
  const match = excludeAssigned 
    ? { status: 'waiting' }
    : { status: { $in: ['waiting', 'assigned'] } };
    
  return this.findOne(match)
    .sort({ 
      priority: -1, 
      joinTime: 1 
    });
};

queueEntrySchema.statics.getQueueStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgWaitTime: { $avg: '$metrics.actualWaitTime' },
        maxWaitTime: { $max: '$metrics.actualWaitTime' },
        minWaitTime: { $min: '$metrics.actualWaitTime' }
      }
    }
  ]);
};

queueEntrySchema.statics.getQueueMetrics = function(hours = 24) {
  const timeLimit = new Date();
  timeLimit.setHours(timeLimit.getHours() - hours);
  
  return this.aggregate([
    {
      $match: {
        joinTime: { $gte: timeLimit }
      }
    },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        expired: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
        },
        avgWaitTime: { 
          $avg: {
            $cond: [
              { $eq: ['$status', 'assigned'] },
              '$metrics.actualWaitTime',
              null
            ]
          }
        },
        maxWaitTime: { 
          $max: {
            $cond: [
              { $eq: ['$status', 'assigned'] },
              '$metrics.actualWaitTime',
              null
            ]
          }
        },
        avgRetries: { $avg: '$retryCount' },
        byClientType: {
          $push: {
            clientType: '$clientType',
            status: '$status'
          }
        }
      }
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$totalEntries', 0] },
            { $multiply: [{ $divide: ['$completed', '$totalEntries'] }, 100] },
            0
          ]
        },
        abandonmentRate: {
          $cond: [
            { $gt: ['$totalEntries', 0] },
            { $multiply: [{ $divide: [{ $add: ['$cancelled', '$expired'] }, '$totalEntries'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

queueEntrySchema.statics.cleanupExpiredEntries = function(maxAgeHours = 24) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
  
  return this.deleteMany({
    $or: [
      { status: 'expired' },
      { status: 'cancelled' },
      { 
        status: 'assigned',
        'assignedAgent.assignedAt': { $lt: cutoffTime }
      }
    ]
  });
};

queueEntrySchema.statics.getQueueHistory = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        joinTime: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$joinTime' },
          month: { $month: '$joinTime' },
          day: { $dayOfMonth: '$joinTime' },
          hour: { $hour: '$joinTime' }
        },
        totalEntries: { $sum: 1 },
        avgWaitTime: { $avg: '$metrics.actualWaitTime' },
        maxQueueLength: { $sum: 1 }, 
        beneficiarios: {
          $sum: { $cond: [{ $eq: ['$clientType', 'beneficiario'] }, 1, 0] }
        },
        aliados: {
          $sum: { $cond: [{ $eq: ['$clientType', 'aliado'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

const ChatQueue = mongoose.model('ChatQueue', queueEntrySchema);

export { ChatQueue };