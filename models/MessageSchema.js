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

