import express from 'express';
import { ChatSession } from '../models/ChatSession.js';
import { AgentStatus } from '../models/AgentStatus.js';
import { ChatMetrics } from '../models/ChatMetrics.js';
import { ChatQueue } from '../models/ChatQueue.js';

const router = express.Router();

// =================== SESIONES DE CHAT CON SOPORTE MULTIIDIOMA ===================

// 1. Obtener todas las sesiones activas con filtro de idioma
router.get('/sessions/active', async (req, res) => {
  try {
    const { language } = req.query;
    
    let filter = {};
    if (language && language !== 'all') {
      filter['clientInfo.language'] = language;
    }
    
    const sessions = await ChatSession.find({
      status: { $in: ['waiting', 'active'] },
      ...filter
    }).sort({ startTime: -1 });
    
    res.json({
      success: true,
      sessions,
      count: sessions.length,
      language: language || 'all'
    });
  } catch (error) {
    console.error('Error al obtener sesiones activas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. Obtener estadísticas por idioma
router.get('/sessions/stats/language', async (req, res) => {
  try {
    const languageStats = await ChatSession.aggregate([
      {
        $match: {
          status: { $in: ['waiting', 'active'] }
        }
      },
      {
        $group: {
          _id: '$clientInfo.language',
          count: { $sum: 1 },
          waiting: {
            $sum: {
              $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0]
            }
          },
          active: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          language: { $ifNull: ['$_id', 'es'] },
          count: 1,
          waiting: 1,
          active: 1
        }
      }
    ]);
    
    // Asegurar que tenemos stats para todos los idiomas
    const defaultStats = {
      es: { language: 'es', count: 0, waiting: 0, active: 0 },
      en: { language: 'en', count: 0, waiting: 0, active: 0 },
      pt: { language: 'pt', count: 0, waiting: 0, active: 0 }
    };
    
    languageStats.forEach(stat => {
      if (defaultStats[stat.language]) {
        defaultStats[stat.language] = {
          language: stat.language,
          count: stat.count,
          waiting: stat.waiting,
          active: stat.active
        };
      }
    });
    
    res.json({
      success: true,
      stats: Object.values(defaultStats),
      total: languageStats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    console.error('Error al obtener estadísticas por idioma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. Crear nueva sesión de chat con idioma
router.post('/sessions', async (req, res) => {
  try {
    const { clientId, clientType, sessionId, chatRoomId, clientInfo, language } = req.body;
    
    // Verificar si ya existe una sesión activa para este cliente
    const existingSession = await ChatSession.findOne({
      clientId,
      status: { $in: ['waiting', 'active'] }
    });
    
    if (existingSession) {
      return res.json({
        success: true,
        session: existingSession,
        message: 'Sesión existente encontrada'
      });
    }
    
    const newSession = new ChatSession({
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientId,
      clientType,
      chatRoomId: chatRoomId || sessionId,
      status: 'waiting',
      clientInfo: {
        userType: clientType,
        connectionTime: new Date(),
        language: language || 'es', // ✅ INCLUIR IDIOMA
        ...clientInfo
      }
    });
    
    await newSession.save();
    
    // Agregar a cola de espera con información de idioma
    const queueEntry = new ChatQueue({
      clientId,
      sessionId: newSession.sessionId,
      clientType,
      priority: clientType === 'aliado' ? 2 : 1,
      clientInfo: {
        socketId: clientId,
        language: language || 'es' // ✅ INCLUIR IDIOMA EN COLA
      }
    });
    
    await queueEntry.save();
    
    // Emitir a agentes disponibles con información de idioma
    if (req.io) {
      console.log('🔔 Emitiendo nueva sesión a agentes...');
      req.io.to('agents_room').emit('new_chat_session', {
        session: newSession,
        queueEntry,
        message: `Nueva solicitud de chat de ${clientType} (${(language || 'es').toUpperCase()})`,
        priority: queueEntry.priority,
        language: language || 'es'
      });
    }
    
    // Actualizar métricas con idioma
    const metrics = await ChatMetrics.getOrCreateTodayMetrics();
    metrics.addChat(clientType, language);
    await metrics.save();
    
    res.json({
      success: true,
      session: newSession,
      queuePosition: await getQueuePosition(newSession.sessionId),
      language: language || 'es'
    });
    
  } catch (error) {
    console.error('Error al crear sesión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. Asignar agente a sesión con soporte de idioma
router.put('/sessions/:sessionId/assign', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId, agentName, chatRoomId, language } = req.body;
    
    console.log(`🎯 Asignando agente ${agentName} a sesión ${sessionId} (${language})`);
    
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    // Asignar agente a la sesión
    await session.assignAgent(agentId, agentName, chatRoomId);
    
    // Actualizar estado del agente
    const agent = await AgentStatus.findOneAndUpdate(
      { agentId },
      { lastActivity: new Date() },
      { upsert: true, new: true }
    );
    
    await agent.addChat(sessionId);
    
    // Remover de cola con información de idioma
    await ChatQueue.findOneAndUpdate(
      { sessionId },
      { 
        status: 'assigned',
        assignedAgent: {
          agentId,
          agentName,
          assignedAt: new Date()
        }
      }
    );
    
    // Emitir eventos con información de idioma
    if (req.io) {
      // Al cliente
      req.io.to(`client_${session.clientId}`).emit('agent_assigned', {
        agentName,
        sessionId,
        chatRoomId,
        message: `Agente ${agentName} se ha conectado al chat`,
        language: session.clientInfo?.language || 'es'
      });
      
      // Al agente
      req.io.to(`agent_${agentId}`).emit('client_assigned', {
        session: session.toObject(),
        message: `Cliente ${session.clientType} asignado (${(session.clientInfo?.language || 'es').toUpperCase()})`,
        chatRoomId,
        language: session.clientInfo?.language || 'es'
      });
    }
    
    res.json({
      success: true,
      session,
      agent: {
        id: agentId,
        name: agentName
      },
      language: session.clientInfo?.language || 'es'
    });
    
  } catch (error) {
    console.error('Error al asignar agente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. Agregar mensaje a sesión con idioma
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, sender, senderName, isAgent, chatRoomId, language } = req.body;
    
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    const messageData = {
      id: Date.now().toString(),
      message,
      sender: sender || (isAgent ? 'agent' : 'client'),
      senderName,
      timestamp: new Date(),
      isAgent: isAgent || false,
      chatRoomId,
      language: language || session.clientInfo?.language || 'es' // ✅ INCLUIR IDIOMA
    };
    
    await session.addMessage(messageData);
    
    // Actualizar actividad del agente si es mensaje del agente
    if (isAgent && session.agentId) {
      const agent = await AgentStatus.findOne({ agentId: session.agentId });
      if (agent) {
        await agent.addMessage();
      }
    }
    
    // Emitir mensaje en tiempo real con idioma
    if (req.io && chatRoomId) {
      req.io.to(chatRoomId).emit('new_message', {
        ...messageData,
        sessionId
      });
    }
    
    res.json({
      success: true,
      message: messageData,
      sessionId,
      language: messageData.language
    });
    
  } catch (error) {
    console.error('Error al agregar mensaje:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. Finalizar sesión con información de idioma
router.put('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, feedback, tags, chatRoomId, reason, language } = req.body;
    
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    // Calcular duración
    const duration = session.startTime ? 
      Math.floor((new Date() - session.startTime) / 1000) : 0;
    
    // Finalizar sesión
    await session.endSession(rating, feedback, tags, reason);
    
    // Actualizar agente
    if (session.agentId) {
      const agent = await AgentStatus.findOne({ agentId: session.agentId });
      if (agent) {
        await agent.completeChat(sessionId, rating);
      }
    }
    
    // Actualizar métricas con información de idioma
    const metrics = await ChatMetrics.getOrCreateTodayMetrics();
    const sessionLanguage = language || session.clientInfo?.language || 'es';
    metrics.completeChat(session.clientType, duration, rating, sessionLanguage);
    await metrics.save();
    
    // Limpiar cola
    await ChatQueue.findOneAndDelete({ sessionId });
    
    // Emitir finalización con idioma
    if (req.io && chatRoomId) {
      req.io.to(chatRoomId).emit('chat_ended', {
        sessionId,
        message: 'El chat ha sido finalizado',
        duration,
        rating,
        language: sessionLanguage
      });
    }
    
    res.json({
      success: true,
      session,
      duration,
      rating,
      language: sessionLanguage
    });
    
  } catch (error) {
    console.error('Error al finalizar sesión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =================== GESTIÓN DE AGENTES ===================

// 7. Obtener estado de agentes (sin cambios)
router.get('/agents/status', async (req, res) => {
  try {
    const agents = await AgentStatus.find().sort({ lastActivity: -1 });
    
    const summary = {
      total: agents.length,
      online: agents.filter(a => a.isOnline).length,
      available: agents.filter(a => a.isOnline && a.isAvailable).length,
      busy: agents.filter(a => a.isOnline && !a.isAvailable).length
    };
    
    res.json({
      success: true,
      agents,
      summary
    });
  } catch (error) {
    console.error('Error al obtener estado de agentes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 8. Actualizar estado de agente (sin cambios)
router.put('/agents/:agentId/status', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { isOnline, isAvailable, socketId } = req.body;
    
    let agent = await AgentStatus.findOne({ agentId });
    
    if (!agent) {
      agent = new AgentStatus({
        agentId,
        agentName: 'Soporte BNP', // ✅ NOMBRE FIJO
        isOnline: isOnline !== undefined ? isOnline : true,
        isAvailable: isAvailable !== undefined ? isAvailable : true
      });
    }
    
    if (isOnline !== undefined) {
      if (isOnline) {
        await agent.setOnline(socketId);
      } else {
        await agent.setOffline();
      }
    }
    
    if (isAvailable !== undefined) {
      await agent.setAvailable(isAvailable);
    }
    
    if (req.io) {
      req.io.to('agents_room').emit('agent_status_update', {
        agentId,
        isOnline: agent.isOnline,
        isAvailable: agent.isAvailable,
        agentName: agent.agentName,
        activeChats: agent.activeChats.length
      });
    }
    
    res.json({
      success: true,
      agent
    });
    
  } catch (error) {
    console.error('Error al actualizar estado de agente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =================== COLA DE ESPERA CON IDIOMAS ===================

// 9. Obtener estado de la cola con filtro de idioma
router.get('/queue', async (req, res) => {
  try {
    const { language } = req.query;
    
    let filter = {};
    if (language && language !== 'all') {
      filter['clientInfo.language'] = language;
    }
    
    const queue = await ChatQueue.find({
      status: 'waiting',
      ...filter
    }).sort({ priority: -1, joinTime: 1 });
    
    const stats = await ChatQueue.aggregate([
      { $match: { status: 'waiting' } },
      {
        $group: {
          _id: '$clientInfo.language',
          count: { $sum: 1 },
          avgWaitTime: { $avg: '$estimatedWaitTime' }
        }
      }
    ]);
    
    res.json({
      success: true,
      queue,
      length: queue.length,
      stats,
      language: language || 'all'
    });
  } catch (error) {
    console.error('Error al obtener cola:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =================== MÉTRICAS CON IDIOMAS ===================

// 10. Obtener métricas generales con desglose por idioma
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await ChatMetrics.getTodayMetrics();
    const agentStats = await AgentStatus.getDailyStats();
    
    // Métricas por idioma
    const languageMetrics = await ChatSession.aggregate([
      {
        $match: {
          startTime: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      },
      {
        $group: {
          _id: '$clientInfo.language',
          totalChats: { $sum: 1 },
          completedChats: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          avgDuration: {
            $avg: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000
              ]
            }
          },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);
    
    res.json({
      success: true,
      daily: metrics,
      agents: agentStats[0] || {},
      languages: languageMetrics
    });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 11. Obtener métricas por idioma específico
router.get('/metrics/language/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    
    const metrics = await ChatSession.aggregate([
      {
        $match: {
          'clientInfo.language': language,
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          completedChats: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          abandonedChats: {
            $sum: {
              $cond: [{ $eq: ['$endReason', 'abandoned'] }, 1, 0]
            }
          },
          avgDuration: {
            $avg: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000
              ]
            }
          },
          avgRating: { $avg: '$rating' },
          totalMessages: { $sum: { $size: '$messages' } }
        }
      }
    ]);
    
    res.json({
      success: true,
      language,
      period: { start, end },
      metrics: metrics[0] || {
        totalChats: 0,
        completedChats: 0,
        abandonedChats: 0,
        avgDuration: 0,
        avgRating: 0,
        totalMessages: 0
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas por idioma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =================== FUNCIONES AUXILIARES ===================

async function getQueuePosition(sessionId) {
  try {
    const result = await ChatQueue.getQueuePosition(sessionId);
    return result.length > 0 ? result[0].position : null;
  } catch (error) {
    console.error('Error al obtener posición en cola:', error);
    return null;
  }
}

// =================== RUTAS ESPECÍFICAS PARA CHAT ABANDONADO ===================

// 12. Marcar chat como abandonado
router.put('/sessions/:sessionId/abandon', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason, chatRoomId } = req.body;
    
    const session = await ChatSession.findOneAndUpdate(
      { sessionId },
      { 
        status: 'abandoned',
        endTime: new Date(),
        endReason: reason || 'client_left'
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    // Limpiar de cola
    await ChatQueue.findOneAndDelete({ sessionId });
    
    // Emitir evento de abandono
    if (req.io && chatRoomId) {
      req.io.to(chatRoomId).emit('chat_abandoned', {
        sessionId,
        message: 'El chat ha sido marcado como abandonado',
        language: session.clientInfo?.language || 'es'
      });
    }
    
    res.json({
      success: true,
      session,
      message: 'Chat marcado como abandonado'
    });
    
  } catch (error) {
    console.error('Error al marcar chat como abandonado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 13. Eliminar chat abandonado permanentemente
router.delete('/sessions/:sessionId/force', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await ChatSession.findOneAndUpdate(
      { sessionId },
      { 
        status: 'force_deleted',
        endTime: new Date(),
        endReason: 'force_deleted_by_agent'
      },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    // Limpiar completamente
    await ChatQueue.findOneAndDelete({ sessionId });
    
    // Emitir evento
    if (req.io) {
      req.io.emit('chat_force_deleted', {
        sessionId,
        message: 'Chat eliminado permanentemente'
      });
    }
    
    res.json({
      success: true,
      message: 'Chat eliminado permanentemente',
      sessionId
    });
    
  } catch (error) {
    console.error('Error al eliminar chat forzadamente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;