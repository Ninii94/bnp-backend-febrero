import { Server } from 'socket.io';
import { ChatSession } from '../models/ChatSession.js';
import { AgentStatus } from '../models/AgentStatus.js';
import { ChatMetrics } from '../models/ChatMetrics.js';
import { ChatQueue } from '../models/ChatQueue.js';

const activeSessions = new Map(); 
let mainAgent = null;

const initializeSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["https://www.beneficiosbnp.com.br", "https://junio-bnp-production.up.railway.app"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // REGISTRO DE USUARIOS
    socket.on('register_user', async (userData) => {
      try {
        const { userType, userId, nombre, isMainAgent, clientInfo } = userData;
        console.log('Registrando usuario:', { userType, userId, nombre, isMainAgent });
        
        if (userType === 'equipo_bnp') {
          console.log('Registrando agente único: Soporte BNP');
          
          if (mainAgent && mainAgent.socketId !== socket.id) {
            console.log('Ya existe un agente principal, desconectando anterior');
            const oldSocket = io.sockets.sockets.get(mainAgent.socketId);
            if (oldSocket) {
              oldSocket.emit('agent_replaced', { 
                message: 'Otro agente se ha conectado como principal' 
              });
            }
          }
          
          // ✅ AGENTE FIJO SIN PERSONALIZACIÓN
          const agent = await AgentStatus.findOneAndUpdate(
            { agentId: 'soporte_bnp_main' },
            {
              agentId: 'soporte_bnp_main',
              agentName: 'Soporte BNP', // ✅ NOMBRE FIJO
              socketId: socket.id,
              isOnline: true,
              isAvailable: true,
              lastActivity: new Date()
            },
            { upsert: true, new: true }
          );
          
          await agent.setOnline(socket.id);
          
          mainAgent = {
            socketId: socket.id,
            userId: 'soporte_bnp_main',
            nombre: 'Soporte BNP', // ✅ NOMBRE FIJO
            isAvailable: true,
            activeChats: []
          };
          
          socket.join('agents_room');
          console.log('Agente único "Soporte BNP" registrado');
          
        } else {
          console.log('Registrando cliente:', userType, 'Idioma:', clientInfo?.language);
          
          // ✅ INCLUIR INFORMACIÓN DE IDIOMA
          const completeClientInfo = {
            name: clientInfo?.name || nombre || 'Cliente sin nombre',
            displayName: clientInfo?.name || nombre,
            email: clientInfo?.email || 'Sin email',
            phone: clientInfo?.phone || '',
            issue: clientInfo?.issue || 'Sin descripción',
            userType: userType,
            source: clientInfo?.source || userData.source || 'web',
            timestamp: new Date(),
            fromLIA: clientInfo?.source === 'LIA' || userData.source === 'LIA',
            language: clientInfo?.language || 'es', // ✅ IDIOMA DEL CLIENTE
            originalName: nombre
          };
          
          activeSessions.set(socket.id, {
            socketId: socket.id,
            userId: userId,
            userType: userType,
            status: 'waiting',
            assignedAgent: null,
            chatHistory: [],
            clientInfo: completeClientInfo
          });
          
          console.log('Cliente registrado con idioma:', completeClientInfo.language);
        }
        
        socket.emit('registration_success', { message: 'Registrado exitosamente' });
        
      } catch (error) {
        console.error('Error al registrar usuario:', error);
        socket.emit('registration_error', { message: 'Error en el registro' });
      }
    });

    // ✅ NUEVO: CLIENTE ABANDONÓ EL CHAT - MEJORADO
    socket.on('client_left_chat', async (data) => {
      try {
        const { chatRoomId, sessionId, message } = data;
        console.log('🚪 Cliente abandonó chat:', sessionId?.slice(-8));
        
        // ✅ ENCONTRAR LA SESIÓN PARA OBTENER EL AGENTE CORRECTO
        const chatSession = await ChatSession.findOne({ sessionId });
        
        if (chatRoomId && chatSession) {
          const systemMessage = {
            id: `abandon_${sessionId}_${Date.now()}`,
            message: message || 'El cliente ha abandonado el chat',
            timestamp: new Date().toISOString(),
            sender: 'system',
            isSystem: true,
            chatRoomId: chatRoomId,
            sessionId: sessionId
          };
          
          // ✅ EMITIR A TODA LA SALA (INCLUYENDO AGENTE)
          console.log('📢 Emitiendo abandono a sala:', chatRoomId?.slice(-8));
          io.to(chatRoomId).emit('client_left_chat', {
            sessionId: sessionId,
            message: message || 'El cliente ha abandonado el chat'
          });
          
          // ✅ EMITIR MENSAJE DE SISTEMA A LA SALA
          io.to(chatRoomId).emit('new_message', systemMessage);
          
          // ✅ NOTIFICAR ESPECÍFICAMENTE AL AGENTE PRINCIPAL
          if (mainAgent) {
            const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
            if (agentSocket) {
              agentSocket.emit('client_left_chat', {
                sessionId: sessionId,
                message: message || 'El cliente ha abandonado el chat',
                chatRoomId: chatRoomId
              });
              console.log('✅ Notificación de abandono enviada al agente principal');
            }
          }
          
          // ✅ GUARDAR EN BD
          if (chatSession) {
            await chatSession.addMessage(systemMessage);
            console.log('✅ Mensaje de abandono guardado en BD');
          }
        }
        
      } catch (error) {
        console.error('❌ Error al procesar abandono:', error);
      }
    });

    // GET ALL CHATS
    socket.on('get_all_chats', async () => {
      console.log('Solicitando todos los chats...');
      await sendAllChatsToAgent(socket, io);
    });

    // ✅ NUEVO: PROCESAR COLA CUANDO AGENTE SE ACTIVE
    socket.on('process_queue_for_agent', async () => {
      console.log('🔄 Procesando cola por solicitud del agente...');
      if (mainAgent && mainAgent.isAvailable) {
        await processQueueForMainAgent(io);
      }
    });

    // SOLICITUD DE CHAT CON IDIOMA
    socket.on('request_agent_chat', async (data) => {
      try {
        console.log('🎯 SOLICITUD DE CHAT');
        
        const session = activeSessions.get(socket.id);
        if (!session) {
          socket.emit('chat_error', { message: 'Sesión no válida' });
          return;
        }

        if (session.status === 'connected' || session.status === 'active') {
          console.log('⚠️ Cliente ya tiene chat activo');
          return;
        }

        // ✅ PRESERVAR IDIOMA EN TODA LA INFORMACIÓN
        const completeClientInfo = {
          ...session.clientInfo,
          ...data.clientInfo,
          name: data.clientName || data.clientInfo?.name || session.clientInfo?.name || 'Cliente sin nombre',
          displayName: data.clientName || data.clientInfo?.name || session.clientInfo?.name,
          email: data.clientEmail || data.clientInfo?.email || session.clientInfo?.email || 'Sin email',
          issue: data.message || data.clientInfo?.issue || session.clientInfo?.issue || 'Sin descripción',
          userType: session.userType,
          source: data.source || session.clientInfo?.source || 'web',
          requestTime: new Date(),
          fromLIA: data.source === 'LIA' || session.clientInfo?.source === 'LIA',
          language: data.language || data.clientInfo?.language || session.clientInfo?.language || 'es' // ✅ PRESERVAR IDIOMA
        };

        session.status = 'processing';
        activeSessions.set(socket.id, session);

        const chatSession = await createOrUpdateChatSession({
          clientId: socket.id,
          clientType: session.userType,
          status: 'waiting',
          clientInfo: completeClientInfo
        });

        session.clientInfo = completeClientInfo;
        session.sessionId = chatSession.sessionId;
        activeSessions.set(socket.id, session);

        console.log('📋 Cliente registrado en idioma:', completeClientInfo.language);

        if (mainAgent && mainAgent.isAvailable) {
          console.log('✅ Agente disponible, asignando...');
          
          const chatRoomId = `chat_${socket.id}_${mainAgent.socketId}`;
          
          session.assignedAgent = mainAgent.socketId;
          session.status = 'connected';
          session.chatRoomId = chatRoomId;
          activeSessions.set(socket.id, session);
          
          await chatSession.assignAgent(
            'soporte_bnp_main', 
            'Soporte BNP', // ✅ NOMBRE FIJO
            chatRoomId
          );
          
          socket.join(chatRoomId);
          const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
          if (agentSocket) {
            agentSocket.join(chatRoomId);
            
            setTimeout(async () => {
              const roomMembers = await io.in(chatRoomId).fetchSockets();
              
              if (roomMembers.length >= 2) {
                socket.emit('agent_assigned', {
                  agentName: 'Soporte BNP', // ✅ NOMBRE FIJO
                  chatRoomId: chatRoomId,
                  sessionId: chatSession.sessionId,
                  message: 'Conectado con Soporte BNP',
                  clientId: socket.id,
                  userType: session.userType
                });

                agentSocket.emit('client_assigned', {
                  clientId: socket.id,
                  userType: session.userType,
                  chatRoomId: chatRoomId,
                  sessionId: chatSession.sessionId,
                  clientInfo: completeClientInfo
                });

                agentSocket.emit('new_chat_request', {
                  session: {
                    ...chatSession.toObject(),
                    clientInfo: completeClientInfo
                  },
                  clientType: session.userType,
                  chatRoomId: chatRoomId,
                  sessionId: chatSession.sessionId,
                  message: `Nueva solicitud de ${completeClientInfo.displayName || completeClientInfo.name} (${completeClientInfo.language?.toUpperCase()})`,
                  autoAssigned: true,
                  clientInfo: completeClientInfo,
                  language: completeClientInfo.language // ✅ INCLUIR IDIOMA
                });
                
                // ✅ LIMPIAR DE COLA INMEDIATAMENTE CUANDO SE ASIGNA AUTOMÁTICAMENTE
                await ChatQueue.findOneAndDelete({ sessionId: chatSession.sessionId });
                console.log('✅ Chat removido de cola tras asignación automática');
                
              }
            }, 500);
            
          }
          
        } else {
          console.log('❌ Agente no disponible, agregando a cola...');
          session.status = 'waiting';
          activeSessions.set(socket.id, session);
          
          const queueEntry = new ChatQueue({
            clientId: socket.id,
            sessionId: chatSession.sessionId,
            clientType: session.userType,
            priority: session.userType === 'aliado' ? 2 : 1,
            clientInfo: { 
              socketId: socket.id,
              language: completeClientInfo.language // ✅ INCLUIR IDIOMA EN COLA
            }
          });
          
          await queueEntry.save();
          const position = await getQueuePosition(chatSession.sessionId);
          
          socket.emit('added_to_queue', {
            position: position,
            sessionId: chatSession.sessionId,
            chatRoomId: null,
            message: `En cola de espera. Posición: ${position}`
          });
          
          if (mainAgent) {
            const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
            if (agentSocket) {
              agentSocket.emit('new_chat_request', {
                session: chatSession,
                clientType: session.userType,
                chatRoomId: chatSession.sessionId,
                message: `Chat en cola: ${session.userType} (${completeClientInfo.language?.toUpperCase()})`,
                queued: true,
                position: position,
                language: completeClientInfo.language // ✅ INCLUIR IDIOMA
              });
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error al solicitar chat:', error);
        socket.emit('chat_error', { message: 'Error al conectar con agente' });
      }
    });

    // ENVÍO DE MENSAJES
    socket.on('send_message', async (data) => {
      try {
        const { message, chatRoomId, isAgent, sessionId, sender, language } = data;
        
        console.log('📨 SERVIDOR: Procesando mensaje:', { 
          sessionId: sessionId?.slice(-8), 
          isAgent, 
          sender, 
          chatRoomId: chatRoomId?.slice(-20),
          language: language
        });
          
        if (!message || !chatRoomId || !sessionId) {
          console.log('❌ SERVIDOR: Datos incompletos del mensaje');
          socket.emit('message_error', { message: 'Datos incompletos' });
          return;
        }

        const uniqueMessageId = `msg_${sessionId?.slice(-8)}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const messageData = {
          id: uniqueMessageId,
          message: message.trim(),
          timestamp: new Date().toISOString(),
          sender: isAgent ? 'agent' : 'client',
          senderName: isAgent ? 'Soporte BNP' : 'Cliente', // ✅ NOMBRES FIJOS
          chatRoomId: chatRoomId,
          sessionId: sessionId,
          isAgent: Boolean(isAgent),
          isSystem: false,
          language: language || 'es' // ✅ INCLUIR IDIOMA DEL MENSAJE
        };

        // Guardar en BD
        try {
          const chatSession = await ChatSession.findOne({ sessionId });
          if (chatSession) {
            await chatSession.addMessage(messageData);
          }
        } catch (dbError) {
          console.error('❌ Error al guardar en BD:', dbError);
        }

        io.to(chatRoomId).emit('new_message', messageData);
        
      } catch (error) {
        console.error('❌ Error al procesar mensaje:', error);
        socket.emit('message_error', { message: 'Error al enviar mensaje' });
      }
    });

    // ACEPTAR CHAT
    socket.on('accept_chat', async (data) => {
      try {
        const { sessionId, clientId, agentId, language } = data;
        console.log('🎯 Agente acepta chat:', { sessionId, agentId, language });
        
        const chatSession = await ChatSession.findOne({ sessionId });
        if (!chatSession) {
          socket.emit('chat_error', { message: 'Sesión no válida' });
          return;
        }
        
        if (chatSession.status === 'active' && chatSession.agentId) {
          console.log('⚠️ Chat ya asignado');
          return;
        }
        
        const clientSession = activeSessions.get(clientId);
        let completeClientInfo = chatSession.clientInfo || {};
        
        if (clientSession && clientSession.clientInfo) {
          completeClientInfo = { ...completeClientInfo, ...clientSession.clientInfo };
        }
        
        const chatRoomId = `chat_${clientId}_${socket.id}`;

        await chatSession.assignAgent('soporte_bnp_main', 'Soporte BNP', chatRoomId); // ✅ NOMBRE FIJO
        
        // ✅ LIMPIAR DE COLA INMEDIATAMENTE AL ACEPTAR
        await ChatQueue.findOneAndDelete({ sessionId });
        console.log('✅ Chat removido de cola al aceptar:', sessionId?.slice(-8));
        
        socket.join(chatRoomId);
        const clientSocket = io.sockets.sockets.get(clientId);
        if (clientSocket) {
          clientSocket.join(chatRoomId);
          
          if (clientSession) {
            clientSession.chatRoomId = chatRoomId;
            clientSession.sessionId = sessionId;
            clientSession.assignedAgent = socket.id;
            clientSession.status = 'active'; // ✅ MARCAR COMO ACTIVO INMEDIATAMENTE
            clientSession.clientInfo = completeClientInfo;
            activeSessions.set(clientId, clientSession);
            console.log('✅ Sesión del cliente actualizada a activa');
          }
        }
        
        setTimeout(async () => {
          const roomMembers = await io.in(chatRoomId).fetchSockets();
          
          if (roomMembers.length >= 2 && clientSocket) {
            clientSocket.emit('agent_assigned', {
              agentName: 'Soporte BNP', // ✅ NOMBRE FIJO
              chatRoomId: chatRoomId,
              sessionId: sessionId,
              message: 'Soporte BNP se ha conectado al chat',
              clientId: clientId,
              userType: chatSession.clientType
            });
            
            socket.emit('chat_accepted', {
              sessionId: sessionId,
              chatRoomId: chatRoomId,
              clientId: clientId,
              message: 'Chat aceptado exitosamente'
            });
            
            // ✅ MENSAJE INICIAL SIMPLIFICADO SEGÚN IDIOMA
            setTimeout(() => {
              const clientLanguage = completeClientInfo.language || 'es';
              let initialMessage = '';
              
              switch (clientLanguage) {
                case 'en':
                  initialMessage = "Hello, I'm analyzing your case, I'll respond shortly.";
                  break;
                case 'pt':
                  initialMessage = "Olá, estou analisando seu caso, já respondo.";
                  break;
                case 'es':
                default:
                  initialMessage = "Hola, estoy analizando tu caso, ya te respondo.";
                  break;
              }
              
              const initialMessageData = {
                id: `initial_${sessionId}_${Date.now()}`,
                message: initialMessage,
                timestamp: new Date().toISOString(),
                sender: 'agent',
                senderName: 'Soporte BNP', // ✅ NOMBRE FIJO
                chatRoomId: chatRoomId,
                sessionId: sessionId,
                isAgent: true,
                isSystem: false,
                language: clientLanguage
              };
              
              chatSession.save().then(() => chatSession.addMessage(initialMessageData));
              io.to(chatRoomId).emit('new_message', initialMessageData);
              
              console.log('✅ Mensaje inicial enviado en', clientLanguage);
            }, 800);
          }
        }, 300);
        
      } catch (error) {
        console.error('❌ Error al aceptar chat:', error);
        socket.emit('chat_error', { message: 'Error al aceptar chat' });
      }
    });

    // ✅ NUEVO: FORZAR FINALIZACIÓN DE CHAT ABANDONADO
    socket.on('force_end_abandoned_chat', async (data) => {
      try {
        const { sessionId, chatRoomId, reason } = data;
        console.log('🗑️ Forzando finalización de chat abandonado:', sessionId?.slice(-8));
        
        if (sessionId) {
          await ChatSession.findOneAndUpdate(
            { sessionId },
            { 
              status: 'completed',
              endTime: new Date(),
              endReason: reason || 'abandoned'
            },
            { new: true }
          );
          
          await ChatQueue.findOneAndDelete({ sessionId });
        }
        
        if (chatRoomId) {
          io.to(chatRoomId).emit('chat_ended', {
            message: 'Chat abandonado eliminado',
            sessionId: sessionId
          });
        }
        
        cleanupChatSession(socket.id);
        console.log('✅ Chat abandonado eliminado');
        
      } catch (error) {
        console.error('❌ Error al eliminar chat abandonado:', error);
      }
    });

    // FINALIZAR CHAT CON INFORMACIÓN DE IDIOMA
    socket.on('end_chat', async (data) => {
      try {
        const { chatRoomId, sessionId, rating, feedback, reason, language } = data;
        console.log('🔚 Finalizando chat:', { sessionId, reason, language });
        
        if (sessionId) {
          const chatSession = await ChatSession.findOneAndUpdate(
            { sessionId },
            { 
              status: 'completed',
              endTime: new Date(),
              rating: rating || null,
              feedback: feedback || null,
              endReason: reason || 'normal'
            },
            { new: true }
          );
          
          if (chatSession && mainAgent) {
            try {
              await AgentStatus.findOneAndUpdate(
                { agentId: 'soporte_bnp_main' },
                { 
                  $inc: { 
                    'dailyStats.chatsCompleted': 1,
                    'dailyStats.totalMessages': chatSession.messages?.length || 0 
                  },
                  lastActivity: new Date()
                },
                { new: true }
              );
            } catch (agentError) {
              console.error('❌ Error al actualizar agente:', agentError);
            }
          }
          
          // ✅ ACTUALIZAR MÉTRICAS CON INFORMACIÓN DE IDIOMA
          try {
            const metrics = await ChatMetrics.getOrCreateTodayMetrics();
            const duration = chatSession.startTime ? 
              Math.floor((new Date() - chatSession.startTime) / 1000) : 0;
            
            if (metrics.completeChat) {
              metrics.completeChat(chatSession.clientType, duration, rating, language);
              await metrics.save();
            }
          } catch (metricsError) {
            console.error('❌ Error al actualizar métricas:', metricsError);
          }
          
          await ChatQueue.findOneAndDelete({ sessionId });
        }
        
        if (chatRoomId) {
          io.to(chatRoomId).emit('chat_ended', {
            message: 'El chat ha sido finalizado',
            sessionId: sessionId
          });
        }
        
        cleanupChatSession(socket.id);
        
      } catch (error) {
        console.error('❌ Error al finalizar chat:', error);
        socket.emit('chat_error', { message: 'Error al finalizar chat' });
      }
    });

    // CAMBIO DE ESTADO DE AGENTE
    socket.on('change_agent_status', async (data) => {
      try {
        const { isAvailable, isMainAgent } = data;
        console.log('Cambiando estado de agente:', { isAvailable, isMainAgent });
        
        if (isMainAgent && mainAgent && mainAgent.socketId === socket.id) {
          const agent = await AgentStatus.findOneAndUpdate(
            { agentId: 'soporte_bnp_main' },
            { 
              isAvailable: isAvailable,
              lastActivity: new Date()
            },
            { new: true }
          );
          
          if (agent) {
            mainAgent.isAvailable = isAvailable;
            
            // ✅ PROCESAR COLA INMEDIATAMENTE SI SE ACTIVA
            if (isAvailable) {
              console.log('🔄 Agente activado, procesando cola...');
              await processQueueForMainAgent(io);
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error al cambiar estado:', error);
      }
    });

    // OBTENER ESTADÍSTICAS
    socket.on('get_stats', async () => {
      try {
        if (mainAgent && mainAgent.socketId === socket.id) {
          const activeChats = await ChatSession.countDocuments({ 
            agentId: 'soporte_bnp_main', 
            status: 'active' 
          });
          const queueLength = await ChatQueue.countDocuments({ status: 'waiting' });
          
          socket.emit('stats_update', {
            activeChats,
            queueLength
          });
        }
      } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error);
      }
    });

    // DESCONEXIÓN
    socket.on('disconnect', async () => {
      console.log('Usuario desconectado:', socket.id);
      
      try {
        if (mainAgent && mainAgent.socketId === socket.id) {
          console.log('Agente único desconectado');
          
          await AgentStatus.findOneAndUpdate(
            { agentId: 'soporte_bnp_main' },
            { 
              isOnline: false,
              lastActivity: new Date()
            },
            { new: true }
          );
          
          mainAgent = null;
        }
        
        await cleanupChatSession(socket.id);
        await ChatQueue.deleteMany({ clientId: socket.id });
        
      } catch (error) {
        console.error('❌ Error en desconexión:', error);
      }
    });
  });

  // FUNCIONES AUXILIARES

  async function createOrUpdateChatSession(sessionData) {
    try {
      let session = await ChatSession.findOne({
        clientId: sessionData.clientId,
        status: { $in: ['waiting', 'active'] }
      });
      
      if (!session) {
        session = new ChatSession({
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...sessionData
        });
        await session.save();
        console.log('✅ Nueva sesión creada con idioma:', session.clientInfo?.language);
      } else {
        if (sessionData.clientInfo) {
          session.clientInfo = {
            ...session.clientInfo,
            ...sessionData.clientInfo
          };
          await session.save();
          console.log('✅ Sesión actualizada con idioma:', session.clientInfo?.language);
        }
      }
      
      return session;
    } catch (error) {
      console.error('❌ Error al crear/actualizar sesión:', error);
      throw error;
    }
  }

  async function sendAllChatsToAgent(socket, io) {
    try {
      console.log('Enviando todos los chats al agente...');
      
      const waitingSessions = await ChatSession.find({ 
        status: 'waiting' 
      }).sort({ startTime: 1 });
      
      const activeSessions = await ChatSession.find({ 
        agentId: 'soporte_bnp_main',
        status: 'active' 
      }).sort({ startTime: 1 });
      
      const allChats = [...waitingSessions, ...activeSessions];
      
      if (allChats.length > 0) {
        socket.emit('all_chats_update', {
          chats: allChats,
          message: `${allChats.length} chats disponibles`
        });

        for (const session of allChats) {
          socket.emit('new_chat_request', {
            session,
            clientType: session.clientType,
            chatRoomId: session.chatRoomId || session.sessionId,
            message: `Chat ${session.status} de ${session.clientType} (${session.clientInfo?.language?.toUpperCase() || 'ES'})`,
            existing: true,
            language: session.clientInfo?.language || 'es' // ✅ INCLUIR IDIOMA
          });
        }
      }
      
      console.log(`✅ ${allChats.length} chats enviados`);
      
    } catch (error) {
      console.error('❌ Error al enviar chats:', error);
    }
  }

  // ✅ PROCESAMIENTO DE COLA MEJORADO CON IDIOMAS
  async function processQueueForMainAgent(io) {
    try {
      if (!mainAgent || !mainAgent.isAvailable) {
        console.log('⚠️ Agente no disponible para procesar cola');
        return;
      }
      
      console.log('🔄 Procesando cola para agente...');
      
      const queueEntries = await ChatQueue.find({ status: 'waiting' })
        .sort({ priority: -1, joinTime: 1 })
        .limit(5);
      
      for (const entry of queueEntries) {
        const session = await ChatSession.findOne({ sessionId: entry.sessionId });
        if (!session) continue;
        
        const chatRoomId = `chat_${entry.clientId}_${mainAgent.socketId}`;
        
        await session.assignAgent(
          'soporte_bnp_main',
          'Soporte BNP', // ✅ NOMBRE FIJO
          chatRoomId
        );
        
        await AgentStatus.findOneAndUpdate(
          { agentId: 'soporte_bnp_main' },
          { 
            $inc: { 'dailyStats.chatsAssigned': 1 },
            lastActivity: new Date()
          },
          { new: true }
        );
        
        await entry.assignToAgent('soporte_bnp_main', 'Soporte BNP'); // ✅ NOMBRE FIJO
        
        // ✅ ELIMINAR DE COLA TRAS PROCESAMIENTO
        await ChatQueue.findOneAndDelete({ sessionId: entry.sessionId });
        console.log('✅ Entrada de cola eliminada tras procesamiento:', entry.sessionId?.slice(-8));
        
        // Notificar al cliente
        const clientSocket = io.sockets.sockets.get(entry.clientId);
        if (clientSocket) {
          clientSocket.join(chatRoomId);
          
          const clientSession = activeSessions.get(entry.clientId);
          if (clientSession) {
            clientSession.chatRoomId = chatRoomId;
            clientSession.sessionId = entry.sessionId;
            clientSession.assignedAgent = mainAgent.socketId;
            clientSession.status = 'active';
            activeSessions.set(entry.clientId, clientSession);
          }
          
          clientSocket.emit('agent_assigned', {
            agentName: 'Soporte BNP', // ✅ NOMBRE FIJO
            chatRoomId,
            sessionId: entry.sessionId,
            message: 'Soporte BNP disponible',
            clientId: entry.clientId,
            userType: session.clientType
          });
        }
        
        // Notificar al agente
        const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
        if (agentSocket) {
          agentSocket.join(chatRoomId);
          agentSocket.emit('client_assigned', {
            clientId: entry.clientId,
            userType: session.clientType,
            chatRoomId,
            sessionId: entry.sessionId,
            clientInfo: session.clientInfo
          });
          
          // ✅ ENVIAR COMO NUEVA SOLICITUD CON IDIOMA
          agentSocket.emit('new_chat_request', {
            session: {
              ...session.toObject(),
              chatRoomId: chatRoomId,
              status: 'active'
            },
            clientType: session.clientType,
            chatRoomId: chatRoomId,
            sessionId: entry.sessionId,
            message: `Chat de cola: ${session.clientType} (${session.clientInfo?.language?.toUpperCase() || 'ES'})`,
            fromQueue: true,
            clientInfo: session.clientInfo,
            language: session.clientInfo?.language || 'es' // ✅ INCLUIR IDIOMA
          });
        }
        
        console.log(`✅ Cola procesada: ${entry.sessionId} (${session.clientInfo?.language}) asignado`);
      }
      
    } catch (error) {
      console.error('❌ Error al procesar cola:', error);
    }
  }

  async function getQueuePosition(sessionId) {
    try {
      const result = await ChatQueue.getQueuePosition(sessionId);
      return result.length > 0 ? result[0].position : null;
    } catch (error) {
      console.error('❌ Error al obtener posición en cola:', error);
      return null;
    }
  }

  async function cleanupChatSession(socketId) {
    try {
      if (activeSessions.has(socketId)) {
        const session = activeSessions.get(socketId);
        
        if (session.assignedAgent && mainAgent) {
          const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
          if (agentSocket) {
            agentSocket.emit('client_disconnected', {
              clientId: socketId,
              message: 'El cliente se ha desconectado'
            });
          }
        }
        
        activeSessions.delete(socketId);
      }
      
      if (mainAgent && mainAgent.socketId === socketId) {
        console.log('🧹 Limpiando sesión de agente...');
        
        const activeChatSessions = await ChatSession.find({
          agentId: 'soporte_bnp_main',
          status: 'active'
        });
        
        for (const chatSession of activeChatSessions) {
          await ChatSession.findOneAndUpdate(
            { _id: chatSession._id },
            { 
              status: 'disconnected',
              endTime: new Date()
            },
            { new: true }
          );
          
          const queueEntry = new ChatQueue({
            clientId: chatSession.clientId,
            sessionId: chatSession.sessionId,
            clientType: chatSession.clientType,
            priority: chatSession.clientType === 'aliado' ? 2 : 1,
            retryCount: 1
          });
          await queueEntry.save();
          
          const clientSocket = io.sockets.sockets.get(chatSession.clientId);
          if (clientSocket) {
            clientSocket.emit('agent_disconnected', {
              message: 'El agente se ha desconectado. Serás redirigido a la cola.'
            });
          }
        }
        
        mainAgent = null;
      }
      
      const sessionsToUpdate = await ChatSession.find({
        $or: [
          { clientId: socketId },
          { agentId: 'soporte_bnp_main', agentSocketId: socketId }
        ],
        status: 'active'
      });
      
      for (const session of sessionsToUpdate) {
        await ChatSession.findOneAndUpdate(
          { _id: session._id },
          { 
            status: 'disconnected',
            endTime: new Date()
          },
          { new: true }
        );
      }
      
    } catch (error) {
      console.error('❌ Error en cleanup:', error);
    }
  }

  // TAREAS PROGRAMADAS
  
  setInterval(async () => {
    try {
      await ChatQueue.updateAllPositions();
      
      const waitingClients = await ChatQueue.find({ status: 'waiting' })
        .sort({ priority: -1, joinTime: 1 });
      
      waitingClients.forEach((entry, index) => {
        const clientSocket = io.sockets.sockets.get(entry.clientId);
        if (clientSocket) {
          // ✅ VERIFICAR QUE EL CLIENTE NO TENGA UN CHAT ACTIVO
          const clientSession = activeSessions.get(entry.clientId);
          if (clientSession && (clientSession.status === 'active' || clientSession.status === 'connected')) {
            console.log('⚠️ Cliente ya tiene chat activo, no enviar actualización de cola:', entry.clientId);
            return; // No enviar actualización de cola si ya está en chat activo
          }
          
          clientSocket.emit('queue_position_update', {
            position: index + 1,
            estimatedWaitTime: entry.estimatedWaitTime,
            message: `Tu posición en cola: ${index + 1}`
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error actualizando posiciones:', error);
    }
  }, 30000);

  setInterval(async () => {
    try {
      console.log('🧹 Ejecutando limpieza programada...');
      
      await ChatQueue.cleanupExpiredEntries(24);
      
      if (mainAgent) {
        const agent = await AgentStatus.findOne({ agentId: 'soporte_bnp_main' });
        if (agent) {
          const cutoffTime = new Date();
          cutoffTime.setMinutes(cutoffTime.getMinutes() - 10);
          
          if (agent.lastActivity < cutoffTime) {
            console.log('⚠️ Agente inactivo, marcando offline');
            await AgentStatus.findOneAndUpdate(
              { agentId: 'soporte_bnp_main' },
              { 
                isOnline: false,
                isAvailable: false,
                lastActivity: new Date()
              },
              { new: true }
            );
            mainAgent = null;
          }
        }
      }
      
      console.log('✅ Limpieza completada');
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
    }
  }, 60000 * 60);

  setInterval(async () => {
    try {
      if (mainAgent) {
        const queueLength = await ChatQueue.countDocuments({ status: 'waiting' });
        const activeChats = await ChatSession.countDocuments({ 
          agentId: 'soporte_bnp_main', 
          status: 'active' 
        });
        
        const globalStats = {
          activeChats: activeChats,
          queueLength,
          timestamp: new Date()
        };
        
        const agentSocket = io.sockets.sockets.get(mainAgent.socketId);
        if (agentSocket) {
          agentSocket.emit('global_stats_update', globalStats);
        }
      }
      
    } catch (error) {
      console.error('❌ Error enviando estadísticas:', error);
    }
  }, 60000 * 5);

  console.log('🚀 Servidor Socket.IO inicializado');
  console.log('🎯 Sistema multiidioma configurado: 🇪🇸 🇺🇸 🇧🇷');
  
  return io;
};

export { initializeSocketServer };