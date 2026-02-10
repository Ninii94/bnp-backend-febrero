// ===== CONFIGURACIÓN INICIAL =====
const originalSetTimeout = setTimeout;
setTimeout = function (callback, delay) {
  const safeDelay = Math.min(delay, 2147483647);
  if (delay !== safeDelay) {
    console.log(`Timeout ajustado de ${delay}ms a ${safeDelay}ms para evitar overflow`);
  }
  return originalSetTimeout(callback, safeDelay);
};

process.env.NODE_CRON_SKIP_TIMEOUT_VALIDATION = "true";

process.on("uncaughtException", (err) => {
  if (err.message && err.message.includes("TimeoutOverflowWarning")) {
    console.log("Ignorando TimeoutOverflowWarning");
  } else {
    console.error("Error no capturado:", err);
  }
});
import dotenv from "dotenv";
dotenv.config();
console.log('=== VERIFICACIÓN VARIABLES CLOUDINARY ===');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');  
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');
// ===== IMPORTACIONES =====
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from 'http';
import { initializeSocketServer } from './services/socketServer.js';
import connectDB from './config/db.js';
import { checkAuth, isBeneficiario, isEquipoBNP, isAliado } from './middleware/auth.js';


// Modelos principales
import { ChatSession } from "./models/ChatSession.js";
import { AgentStatus } from "./models/AgentStatus.js";
import { ChatMetrics } from "./models/ChatMetrics.js";
import { ChatQueue } from "./models/ChatQueue.js";

// Rutas principales
import authRoutes from "./routes/auth.js";
import serviciosRoutes from "./routes/serviciosRoutes.js";
import beneficiarioRoutes from "./routes/BeneficiarioRoutes.js";
import equipoBNPRoutes from "./routes/equipoBNP.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import aliadoRoutes from "./routes/aliadoRoutes.js";
import sucursalRoutes from "./routes/sucursalRoutes.js";
import ticketRoutes from "./routes/TicketRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import codigoRoutes from "./routes/codigoRoutes.js";
import historialServiciosRoutes from './routes/historialServiciosRoutes.js'; 
import aliadoManagementRoutes from "./routes/aliadoManagement.js";
import emailRoutes from "./routes/emailRoutes.js";
// Rutas de fondos
import solicitudesReembolsoRoutes from './routes/solicitudes-reembolso.js';
import fondosRoutes from './routes/fondos.js';
import fondosBeneficiarioRoutes from './routes/fondos-beneficiario.js';
import metodosRoutes from './routes/metodos-pago.js';
import comprobantesPagoRoutes from './routes/comprobantesPagoRoutes.js'

// Rutas adicionales
import AvisoRoutes from "./routes/AvisoRoutes.js";
import NotificacionesRoutes from "./routes/NotificacionesRoutes.js";
import NotificacionesAliadosRoutes from "./routes/NotificacionesAliadosRoutes.js";
import contratoRoutes from "./routes/contratoRoutes.js";
import contratoEquipoRoutes from './routes/contratoEquipoRoutes.js';
import contratoBeneficiarioRoutes from './routes/contratobeneficiarioRoutes.js';
import bitacoraRoutes from "./routes/BitacoraRoutes.js";
import chatRoutes from './routes/chatRoutes.js';
import promocionesRoutes from './routes/promocionesRoutes.js'
import financiamientoRoutes from './routes/financiamientos.js';
import { FinanciamientoNotificacionesService } from './services/financiamientoNotificacionesService.js';
import bienvenidaRoutes from './routes/bienvenidaRoutes.js';
import mensajesPagoRoutes from './routes/mensajePago.js';
import perfilRoutes from './routes/perfilRoutes.js';
import estadisticasBeneRoutes from './routes/estadisticasBeneRoutes.js';
import ticketsEstadisticaRoutes from './routes/ticketEstadisticaRoutes.js'
import aliadoBeneficiariosRoutes from './routes/aliadoBeneficiariosRoutes.js'
import { configurarBitacoraCentral } from './middleware/bitacoraCentralMiddleware.js';

// ===== CONFIGURACIÓN =====

connectDB();

const app = express();
const server = http.createServer(app);

// ===== TAREAS PROGRAMADAS DE FINANCIAMIENTOS =====

// cada día a las 9:00 AM hora Brasil
setInterval(async () => {
  const now = new Date();
  const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const hour = brazilTime.getHours();

  if (hour === 9) {
    console.log('[CRON] Ejecutando verificación de vencimientos...');
    await FinanciamientoNotificacionesService.verificarVencimientosProximos();
  }
}, 60000 * 60); 

// Verificar y actualizar cuotas vencidas 
setInterval(async () => {
  console.log('[CRON] Actualizando cuotas vencidas...');
  await FinanciamientoNotificacionesService.verificarCuotasVencidas();
}, 60000 * 60 * 6); 


const corsOptions = {
  origin: [
    'http://localhost:5000',
    'http://localhost:5173',
    'https://beneficiosbnp.com.br',
    'https://www.beneficiosbnp.com.br',
    process.env.FRONTEND_URL,
    /\.railway\.app$/
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept'],
  exposedHeaders: ['Content-Type'] 
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use((req, res, next) => {
  req.io = app.get('io');
  req.chatModels = {
    ChatSession,
    AgentStatus,
    ChatMetrics,
    ChatQueue
  };
  next();
});
configurarBitacoraCentral(app);

app.set('trust proxy', true);

//  IP real del cliente
app.use((req, res, next) => {
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIp = req.headers['x-real-ip'];
  const xClientIp = req.headers['x-client-ip'];
  
  let clientIp = cfConnectingIp;
  
  if (!clientIp && xForwardedFor) {
    clientIp = xForwardedFor.split(',')[0].trim();
  }
  
  if (!clientIp) {
    clientIp = xRealIp || xClientIp || req.ip;
  }
  
  req.clientIp = clientIp;
  req.originalIp = req.ip;
  
  next();
});

// ===== DEBUG=====
app.use((req, res, next) => {
  if (req.originalUrl.includes('/api/servicios') || 
      req.originalUrl.includes('/api/beneficiario') ||
      req.originalUrl.includes('/api/fondos') ||
      req.originalUrl.includes('/api/perfil')) {
    console.log(`${req.method} ${req.originalUrl}`);
    if (req.headers.authorization) {
      console.log('Auth header presente');
    }
  }
  next();
});

// =====  PÚBLICAS =====
app.get('/', (req, res) => {
  res.json({ 
    message: 'Servidor BNP Capital funcionando',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    server: 'express',
    socket: 'socket.io',
    port: process.env.PORT || 5000
  });
});

app.get('/api/business-hours', (req, res) => {
  const now = new Date();
  const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const hour = brazilTime.getHours();
  const day = brazilTime.getDay();
  
  const isOpen = (day >= 1 && day <= 5) && ((hour >= 8 && hour < 13) || (hour >= 17 && hour < 21));
  
  res.json({
    isOpen,
    currentTime: brazilTime.toLocaleString('es-ES', { timeZone: 'America/Sao_Paulo' }),
    schedule: {
      morning: '8:00 - 13:00',
      afternoon: '17:00 - 21:00',
      timezone: 'Horario Brasil (UTC-3)',
      workdays: 'Lunes a Viernes'
    },
    message: isOpen ? 'Horario de atención activo' : 'Fuera del horario de atención'
  });
});

// ===== RUTAS =====

// 1.públicas primero
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/perfil", perfilRoutes); 
app.use("/api/estadisticas", estadisticasBeneRoutes);
app.use("/api/estadisticas/tickets", ticketsEstadisticaRoutes);

// 2. específicas ANTES que las generales (MUY IMPORTANTE)
app.use("/api/servicios", serviciosRoutes);
app.use("/api/beneficiario", beneficiarioRoutes);
app.use('/api/bienvenida', bienvenidaRoutes);
app.use('/api/historial-servicios', historialServiciosRoutes);
app.use('/api/mensajes-pago', mensajesPagoRoutes);
app.use('/api/comprobantes-pago', comprobantesPagoRoutes);
app.use ('/api/aliado-beneficiarios', aliadoBeneficiariosRoutes)
app.use("/api/email", emailRoutes);
// 3. equipo BNP
app.use("/api/equipo", equipoBNPRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/promociones", promocionesRoutes);
// 4. fondos (orden específico)
app.use("/api/fondos", fondosRoutes);
app.use("/api/metodos-pago", metodosRoutes);
app.use ("/api/beneficiario/fondos", fondosBeneficiarioRoutes)
app.use("/api/solicitudes-reembolso", solicitudesReembolsoRoutes);
app.use('/api/financiamientos', financiamientoRoutes);
app.use("/api/aliadomanagement", aliadoManagementRoutes);

// 5. generales
app.use("/api/aliados", aliadoRoutes);
app.use("/api/aliado", aliadoRoutes);
app.use("/api/sucursales", sucursalRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/codigos", codigoRoutes);

// 6. contratos
app.use("/api/contratos", contratoRoutes);
app.use("/api/contratoequipo", contratoEquipoRoutes);
app.use("/api/contrato-beneficiario", contratoBeneficiarioRoutes);

// 7.  finales
app.use("/api/avisos", AvisoRoutes);
app.use("/api/notificaciones", NotificacionesRoutes);
app.use("/api/notificaciones-aliados", NotificacionesAliadosRoutes);
app.use("/api/bitacora", bitacoraRoutes);

// ===== RUTAS DE DEBUG ESENCIALES =====
app.get("/api/debug/status", async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    res.json({
      success: true,
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      routes_loaded: [
        'auth', 'servicios', 'beneficiario', 'equipo', 'usuarios',
        'fondos', 'metodos-pago', 'aliados', 'sucursales', 'perfil'
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/api/debug/chat-status", async (req, res) => {
  try {
    const agents = await AgentStatus.find();
    const onlineAgents = agents.filter(a => a.isOnline);
    const activeSessions = await ChatSession.find({
      status: { $in: ['waiting', 'active'] }
    });
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      agents: {
        total: agents.length,
        online: onlineAgents.length,
        available: agents.filter(a => a.isOnline && a.isAvailable).length
      },
      sessions: {
        total: activeSessions.length,
        waiting: activeSessions.filter(s => s.status === 'waiting').length,
        active: activeSessions.filter(s => s.status === 'active').length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// ===== TAREAS PROGRAMADAS =====
setInterval(async () => {
  try {
    // Limpiar entradas de cola expiradas
    await ChatQueue.cleanupExpiredEntries(24);
    
    // Marcar agentes offline si no han tenido actividad en 10 minutos
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 10);
    
    await AgentStatus.updateMany(
      { 
        lastActivity: { $lt: cutoffTime },
        isOnline: true 
      },
      { 
        isOnline: false,
        isAvailable: false,
        activeChats: []
      }
    );
  } catch (error) {
    console.error("Error en limpieza programada:", error);
  }
}, 60000 * 60); // Cada hora

// Actualizar métricas cada 5 minutos
setInterval(async () => {
  try {
    const metrics = await ChatMetrics.getOrCreateTodayMetrics();
    
    const activeSessions = await ChatSession.countDocuments({ 
      status: { $in: ['waiting', 'active'] } 
    });
    const waitingSessions = await ChatSession.countDocuments({ status: 'waiting' });
    const onlineAgents = await AgentStatus.countDocuments({ isOnline: true });
    const availableAgents = await AgentStatus.countDocuments({ 
      isOnline: true, 
      isAvailable: true 
    });
    
    metrics.activeChats = activeSessions;
    metrics.waitingChats = waitingSessions;
    metrics.agentsOnline = onlineAgents;
    metrics.agentsAvailable = availableAgents;
    
    await metrics.save();
  } catch (error) {
    console.error("Error actualizando métricas:", error);
  }
}, 60000 * 5); // Cada 5 minutos

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({ error: err.message || "Error interno del servidor" });
});

// ===== INICIALIZACIÓN DEL SERVIDOR =====
const socketIO = initializeSocketServer(server);
app.set('io', socketIO);

const SERVER_PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Conectado a MongoDB");
    
    server.listen(SERVER_PORT, () => {
      console.log(`🚀 Servidor HTTP y Socket.IO corriendo en puerto ${SERVER_PORT}`);
      console.log(`🌐 Servidor disponible en: http://localhost:${SERVER_PORT}`);
      
      console.log("\n" + "=".repeat(60));
      console.log("📋 RUTAS PRINCIPALES REGISTRADAS:");
      console.log("=".repeat(60));
      console.log("   ✅ /api/auth - Autenticación");
      console.log("   ✅ /api/servicios - Servicios y beneficios");
      console.log("   ✅ /api/beneficiario - Beneficiarios");
      console.log("   ✅ /api/equipo - Equipo BNP");
      console.log("   ✅ /api/fondos - Sistema de fondos");
      console.log("   ✅ /api/metodos-pago - Métodos de pago");
      console.log("   ✅ /api/aliados - Aliados");
      console.log("   ✅ /api/chat - Sistema de chat");
      console.log("   ✅ /api/perfil - Estadísticas y perfil");
      
      console.log("\n" + "=".repeat(60));
      console.log("🔍 DEBUG ENDPOINTS:");
      console.log("=".repeat(60));
      console.log("   🔍 GET /api/debug/status");
      console.log("   🔍 GET /api/debug/chat-status");
      console.log("   🔍 GET /api/health");
      
      console.log("\n" + "=".repeat(60));
      console.log("🎉 SERVIDOR LISTO Y FUNCIONANDO");
      console.log("=".repeat(60));
    });
  })
  .catch((error) => {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  });