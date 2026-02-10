import { checkAuth, isEquipoBNP } from '../middleware/auth.js';
import express from 'express';
import { Ticket } from '../models/Ticket.js';
import { ResetTimestamp } from '../models/ResetTimestamp.js';
import moment from 'moment-timezone';

const router = express.Router();

const TIMEZONE = 'America/Argentina/Buenos_Aires';

process.on('uncaughtException', (err) => {
  if (err.message.includes('TimeoutOverflowWarning')) {
    console.log('Ignorando TimeoutOverflowWarning');
  } else {
    console.error('Error no capturado:', err);
  }
});

const resetAnalytics = async () => {
  try {
    const result = await Ticket.updateMany({}, {
      $set: {
        // Reset time-related metrics
        'metricas.tiempo_resolucion.minutos': 0,
        'metricas.tiempo_resolucion.horas': 0,
        'metricas.tiempo_resolucion.dias': 0,
        'metricas.tiempo_resolucion.semanas': 0,

        // Reset interaction metrics
        'metricas.numero_interacciones': 0,
        'metricas.reabierto': false,
        'metricas.veces_reabierto': 0,

        // Reset status tracking
        'ultima_actualizacion': new Date(),
        'tiempos_respuesta.inicio': new Date(),
        'tiempos_respuesta.resolucion': null,

        // Reset tracking arrays
        'seguimiento': [],
      },
      // Use $unset to completely remove and reset complex fields
      $unset: {
        'satisfaccion': '',
        'encuesta': ''
      }
    });

    // After unsetting, set default structures
    await Ticket.updateMany({}, {
      $set: {
        'satisfaccion': {
          calificacion: null,
          comentario: null,
          fecha_calificacion: null
        },
        'encuesta': {
          enviada: false,
          fecha_envio: null
        }
      }
    });

    console.log('Analíticas reiniciadas:', {
      timestamp: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss z'),
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });

    // Additional validation
    if (!result.acknowledged) {
      throw new Error('La operación de reset no fue reconocida por la base de datos');
    }

    return result;
  } catch (error) {
    console.error('Error detallado al reiniciar analíticas:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
};

// Ruta para resetear todas las estadísticas
router.post('/reset', 
  checkAuth,  
  isEquipoBNP,  
  async (req, res) => {
  try {
    // First, perform the existing reset
    const resetResult = await resetAnalytics();

    // Update or create reset timestamp
    await ResetTimestamp.findOneAndUpdate(
      { type: 'ticket_analytics' },
      { timestamp: new Date() },
      { upsert: true }
    );

    res.json({ 
      message: 'Analíticas de tickets reiniciadas exitosamente', 
      timestamp: new Date().toISOString(),
      details: {
        modifiedCount: resetResult.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error completo al reiniciar analíticas:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    res.status(500).json({ 
      message: 'Error al reiniciar analíticas de tickets', 
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    });
  }
});

// Obtener analíticas generales
router.get('/', async (req, res) => {
  try {
    // Retrieve or create a reset timestamp
    const resetTimestampDoc = await ResetTimestamp.findOne({ type: 'ticket_analytics' });
    
    // If no reset timestamp exists, create one
    if (!resetTimestampDoc) {
      await ResetTimestamp.create({
        type: 'ticket_analytics',
        timestamp: new Date()
      });
    }

    const resetTimestamp = resetTimestampDoc 
      ? resetTimestampDoc.timestamp 
      : new Date(0); // Default to earliest possible date if no reset found

    const tickets = await Ticket.find({
      // Only consider tickets created after the reset timestamp
      fecha_creacion: { $gte: resetTimestamp }
    })
    .populate('aliado_id')
    .populate('beneficiario_id');

    // Rest of your existing analytics logic, but using the filtered tickets
    // Tickets finalizados (para métricas de resolución)
    const ticketsFinalizados = tickets.filter(t => 
      ['Resuelto', 'No Resuelto', 'Cerrado'].includes(t.estado)
    );

    // Tickets pendientes (solo en Esperando Respuesta)
    const ticketsPendientes = tickets.filter(t => 
      t.estado === 'Esperando Respuesta'
    );

    // Calcular satisfacción promedio solo de tickets finalizados
    const ticketsConCalificacion = ticketsFinalizados.filter(t => 
      t.satisfaccion && t.satisfaccion.calificacion
    );
    const averageSatisfaction = ticketsConCalificacion.length > 0
      ? ticketsConCalificacion.reduce((acc, t) => acc + t.satisfaccion.calificacion, 0) / ticketsConCalificacion.length
      : 0;

    // Problemas comunes (basado en tickets después del reset)
    const issueCount = tickets.reduce((acc, ticket) => {
      const key = `${ticket.categoria} - ${ticket.subcategoria}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const commonIssues = Object.entries(issueCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    // Tendencias en el tiempo (solo después del reset)
    const trendsOverTime = tickets.reduce((acc, ticket) => {
      const date = new Date(ticket.fecha_creacion).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { 
          tickets: 0, 
          ticketsResueltos: 0,
          satisfaction: 0, 
          totalRatings: 0 
        };
      }
      acc[date].tickets++;
      
      if (['Resuelto', 'No Resuelto', 'Cerrado'].includes(ticket.estado)) {
        acc[date].ticketsResueltos++;
      }
      
      if (ticket.satisfaccion?.calificacion) {
        acc[date].satisfaction += ticket.satisfaccion.calificacion;
        acc[date].totalRatings++;
      }
      return acc;
    }, {});

    const trendsArray = Object.entries(trendsOverTime).map(([date, data]) => ({
      date,
      tickets: data.tickets,
      ticketsResueltos: data.ticketsResueltos,
      satisfaction: data.totalRatings > 0 ? data.satisfaction / data.totalRatings : 0
    }));

    res.json({
      averageSatisfaction,
      totalRatings: ticketsConCalificacion.length,
      resolvedTickets: ticketsFinalizados.length,
      totalTickets: tickets.length,
      pendingTickets: ticketsPendientes.length,
      commonIssues,
      trendsOverTime: trendsArray.sort((a, b) => new Date(a.date) - new Date(b.date)),
      resetTimestamp: resetTimestamp
    });
  } catch (error) {
    console.error('Error al obtener analíticas:', error);
    res.status(500).json({ error: 'Error al obtener analíticas' });
  }
});

// Endpoint para tiempo de resolución
router.get('/tiempo-resolucion', checkAuth, async (req, res) => {
  try {
    // Get the latest reset timestamp
    const resetTimestampDoc = await ResetTimestamp.findOne({ type: 'ticket_analytics' });
    const resetTimestamp = resetTimestampDoc 
      ? resetTimestampDoc.timestamp 
      : new Date(0); // Default to earliest possible date if no reset found

    // Find only tickets created after the reset timestamp
    const tickets = await Ticket.find({
      fecha_creacion: { $gte: resetTimestamp },
      estado: { $in: ['Resuelto', 'No Resuelto', 'Cerrado'] } // Only count resolved tickets
    });

    // If no tickets found after reset, return zeros
    if (!tickets.length) {
      return res.json({
        ticketsResueltos: 0,
        promedioMinutos: 0,
        promedioHoras: 0,
        promedioDias: 0,
        promedioSemanas: 0
      });
    }

    // Calculate time metrics only for those tickets that have resolution time data
    const ticketsConTiempos = tickets.filter(ticket => 
      ticket.metricas && 
      ticket.metricas.tiempo_resolucion && 
      ticket.metricas.tiempo_resolucion.minutos !== undefined
    );

    if (!ticketsConTiempos.length) {
      return res.json({
        ticketsResueltos: tickets.length, // We have tickets but no time data
        promedioMinutos: 0,
        promedioHoras: 0,
        promedioDias: 0,
        promedioSemanas: 0
      });
    }

    // Sum up all time metrics
    const totalMinutos = ticketsConTiempos.reduce((acc, ticket) => 
      acc + (ticket.metricas.tiempo_resolucion.minutos || 0), 0);
    
    const totalHoras = ticketsConTiempos.reduce((acc, ticket) => 
      acc + (ticket.metricas.tiempo_resolucion.horas || 0), 0);
    
    const totalDias = ticketsConTiempos.reduce((acc, ticket) => 
      acc + (ticket.metricas.tiempo_resolucion.dias || 0), 0);
    
    const totalSemanas = ticketsConTiempos.reduce((acc, ticket) => 
      acc + (ticket.metricas.tiempo_resolucion.semanas || 0), 0);

    // Calculate averages
    const promedioMinutos = totalMinutos / ticketsConTiempos.length;
    const promedioHoras = totalHoras / ticketsConTiempos.length;
    const promedioDias = totalDias / ticketsConTiempos.length;
    const promedioSemanas = totalSemanas / ticketsConTiempos.length;

    res.json({
      ticketsResueltos: tickets.length,
      promedioMinutos,
      promedioHoras,
      promedioDias,
      promedioSemanas
    });
  } catch (error) {
    console.error('Error al obtener métricas de tiempo de resolución:', error);
    res.status(500).json({ 
      error: 'Error al obtener métricas de tiempo',
      details: error.message
    });
  }
});

export default router;