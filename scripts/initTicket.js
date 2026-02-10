import { Ticket } from '../models/Ticket.js';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';
import mongoose from 'mongoose';

export const initTickets = async () => {
  try {
    // Crear un aliado de ejemplo
    const aliado = new Aliado({
      nombre: "Hotel del sol",
      telefono: "123-456-7890",
      direccion: "Calle Principal 123",
      info_contacto: "Juan Pérez - Gerente",
      inicio_contrato: new Date(),
      fin_contrato: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      tipo_servicio: "Hotelería"
    });
    await aliado.save();

    // Crear un beneficiario de ejemplo
    const beneficiario = new Beneficiario({
      nombre: "María",
      apellido: "González",
      telefono: "098-765-4321",
      nacionalidad: "Panameña",
      direccion: "Avenida Central 456",
      llave_unica: "BNF-001",
      hotel_aliado: "Hotel del sol",
      sucursal: "Sede Central"
    });
    await beneficiario.save();

    // Crear ticket de ejemplo
    const ticketEjemplo = new Ticket({
      titulo: "Problema con sistema de reservas",
      descripcion: "El sistema no permite realizar reservas para fechas posteriores a diciembre 2024",
      categoria: "Técnico",
      subcategoria: "Fallos en el sistema",
      aliado_id: aliado._id,
      estado: "Nuevo",
      prioridad: "Alta",
      seguimiento: [{
        mensaje: "Se ha creado el ticket y asignado al equipo técnico",
        interno: true,
        estado_anterior: null,
        estado_nuevo: "Nuevo"
      }]
    });
    await ticketEjemplo.save();

    console.log('Datos de ejemplo inicializados correctamente');
    return { aliado, beneficiario, ticket: ticketEjemplo };
  } catch (error) {
    console.error('Error al inicializar datos:', error);
    throw error;
  }
};

// Rutas API necesarias para el componente
export const ticketRoutes = (router) => {
  // Obtener todos los tickets
  router.get('/tickets', async (req, res) => {
    try {
      const tickets = await Ticket.find()
        .populate('aliado_id', 'nombre_usuario correo tipo')
        .populate('beneficiario_id', 'nombre_usuario correo tipo')
        .sort({ fecha_creacion: -1 });
      res.json(tickets);
    } catch (error) {
      console.error('Error al obtener tickets:', error);
      res.status(500).json({ message: 'Error al obtener tickets' });
    }
  });

  // Crear nuevo ticket
  router.post('/tickets', async (req, res) => {
    try {
      const ticket = new Ticket(req.body);
      await ticket.save();
      res.status(201).json(ticket);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

 
// Actualizar estado del ticket
router.patch('/tickets/:id/estado', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const estadoAnterior = ticket.estado;
    ticket.estado = req.body.estado;

    // Agregar entrada al seguimiento
    ticket.seguimiento.push({
      mensaje: req.body.mensaje || `Estado actualizado a ${req.body.estado}`,
      estado_anterior: estadoAnterior,
      estado_nuevo: req.body.estado,
      interno: true,
      fecha: new Date()
    });

    await ticket.save();

    // Poblar los datos antes de enviar la respuesta
    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('aliado_id', 'nombre_usuario correo tipo')
      .populate('beneficiario_id', 'nombre_usuario correo tipo');

    res.json(updatedTicket);
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    res.status(400).json({ error: error.message });
  }
});
};

export default router;