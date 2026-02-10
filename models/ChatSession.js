import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  sender: { 
    type: String, 
    enum: ['client', 'agent', 'system'], 
    required: true 
  },
  senderName: { 
    type: String 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  isAgent: { 
    type: Boolean, 
    default: false 
  },
  isSystem: { 
    type: Boolean, 
    default: false 
  },
  chatRoomId: {
    type: String
  }
});

const chatSessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  clientId: { 
    type: String, 
    required: true 
  },
  clientType: { 
    type: String, 
    enum: ['beneficiario', 'aliado'], 
    required: true 
  },
  agentId: { 
    type: String,
    default: null
  },
  agentName: { 
    type: String,
    default: null
  },
  chatRoomId: {
    type: String
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended', 'disconnected'],
    default: 'waiting'
  },
  startTime: { 
    type: Date, 
    default: Date.now 
  },
  endTime: { 
    type: Date 
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messages: [messageSchema],
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  feedback: { 
    type: String 
  },
  tags: [{ 
    type: String 
  }],

   
  clientInfo: {
    name: String,
    displayName: String, // ✅ IMPORTANTE
    email: String,
    phone: String,
    issue: String,
    userType: String,
    source: String,
    fromLIA: Boolean,    // ✅ IMPORTANTE
    originalName: String,
    timestamp: Date,
    requestTime: Date,
    // Otros campos que puedan ser necesarios
    connectionTime: Date,
    userAgent: String,
    ip: String
  },
  metrics: {
    totalMessages: { type: Number, default: 0 },
    agentResponseTime: { type: Number, default: 0 }, // en segundos
    clientResponseTime: { type: Number, default: 0 }, // en segundos
    waitTime: { type: Number, default: 0 }, // tiempo en cola
    duration: { type: Number, default: 0 } // duración total
  }
}, {
  timestamps: true
});

chatSessionSchema.index({ clientId: 1, status: 1 });
chatSessionSchema.index({ agentId: 1, status: 1 });
chatSessionSchema.index({ startTime: -1 });
chatSessionSchema.index({ sessionId: 1 });
chatSessionSchema.index({ status: 1, startTime: -1 });

chatSessionSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.metrics.totalMessages = this.messages.length;
    this.lastActivity = new Date();
  }
  
  if (this.endTime && this.startTime) {
    this.metrics.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  next();
});


chatSessionSchema.methods.addMessage = function(messageData) {
  const message = {
    id: messageData.id || Date.now().toString(),
    message: messageData.message,
    sender: messageData.sender,
    senderName: messageData.senderName,
    timestamp: messageData.timestamp || new Date(),
    isAgent: messageData.isAgent || false,
    isSystem: messageData.isSystem || false,
    chatRoomId: messageData.chatRoomId
  };
  
  this.messages.push(message);
  this.lastActivity = new Date();
  this.metrics.totalMessages = this.messages.length;
  
  return this.save();
};

chatSessionSchema.methods.assignAgent = function(agentId, agentName, chatRoomId) {
  this.agentId = agentId;
  this.agentName = agentName;
  this.chatRoomId = chatRoomId;
  this.status = 'active';
  this.lastActivity = new Date();
  
  return this.save();
};

chatSessionSchema.methods.endSession = function(rating = null, feedback = null, tags = []) {
  this.status = 'ended';
  this.endTime = new Date();
  this.rating = rating;
  this.feedback = feedback;
  this.tags = tags;
  
  if (this.startTime) {
    this.metrics.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  return this.save();
};

// Métodos estáticos
chatSessionSchema.statics.findActiveSessions = function() {
  return this.find({
    status: { $in: ['waiting', 'active'] }
  }).sort({ startTime: -1 });
};

chatSessionSchema.statics.findByAgent = function(agentId) {
  return this.find({
    agentId: agentId,
    status: { $in: ['active', 'waiting'] }
  }).sort({ startTime: -1 });
};

chatSessionSchema.statics.findWaitingSessions = function() {
  return this.find({
    status: 'waiting'
  }).sort({ startTime: 1 }); // FIFO
};

chatSessionSchema.statics.getSessionMetrics = function(dateFrom, dateTo) {
  const match = {
    startTime: {
      $gte: dateFrom,
      $lte: dateTo
    }
  };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        activeSessions: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        },
        endedSessions: {
          $sum: {
            $cond: [{ $eq: ['$status', 'ended'] }, 1, 0]
          }
        },
        avgDuration: { $avg: '$metrics.duration' },
        avgRating: { $avg: '$rating' },
        totalMessages: { $sum: '$metrics.totalMessages' }
      }
    }
  ]);
};

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export { ChatSession };