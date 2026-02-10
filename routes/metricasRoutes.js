//manejo de rutas para el tiempo de respuesta de los tickets

import express from 'express';
import { Ticket } from '../models/Ticket.js';

const router = express.Router();

router.get('/tiempo-resolucion', async (req, res) => {
  try {
    // Buscar TODOS los tickets
    const tickets = await Ticket.find();

    // Contar tickets resueltos explícitamente
    const ticketsResueltos = tickets.filter(ticket => 
      ['Resuelto', 'Cerrado', 'No Resuelto'].includes(ticket.estado)
    );

    // Calcular tiempos de resolución solo para tickets con tiempos completos
    const tiemposResolucion = ticketsResueltos
      .filter(ticket => 
        ticket.tiempos_respuesta.inicio && 
        ticket.tiempos_respuesta.resolucion
      )
      .map(ticket => {
        const tiempoTotal = ticket.tiempos_respuesta.resolucion.getTime() - 
                            ticket.tiempos_respuesta.inicio.getTime();
        return {
          tiempoTotal,
          minutos: Math.floor(tiempoTotal / (1000 * 60)),
          horas: Math.floor(tiempoTotal / (1000 * 60 * 60)),
          dias: Math.floor(tiempoTotal / (1000 * 60 * 60 * 24)),
          semanas: Math.floor(tiempoTotal / (1000 * 60 * 60 * 24 * 7))
        };
      });

    // Manejar caso de no tener tickets resueltos
    if (tiemposResolucion.length === 0) {
      return res.json({
        totalTickets: tickets.length,
        ticketsResueltos: ticketsResueltos.length,
        promedioMinutos: 0,
        promedioHoras: 0,
        promedioDias: 0,
        promedioSemanas: 0
      });
    }

    // Función para calcular promedio
    const calcularPromedio = (propiedad) => {
      const suma = tiemposResolucion.reduce((acc, tiempo) => acc + tiempo[propiedad], 0);
      return suma / tiemposResolucion.length;
    };

    // Crear métricas
    const metricas = {
      totalTickets: tickets.length,
      ticketsResueltos: ticketsResueltos.length,
      promedioMinutos: calcularPromedio('minutos'),
      promedioHoras: calcularPromedio('horas'),
      promedioDias: calcularPromedio('dias'),
      promedioSemanas: calcularPromedio('semanas')
    };

    res.json(metricas);
  } catch (error) {
    console.error('Error al obtener métricas de tiempo de resolución:', error);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

export default router;