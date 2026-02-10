import express from "express";
import { Ticket } from "../models/Ticket.js";

const router = express.Router();

// Obtener todos los tickets
router.get("/", async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate("aliado_id", "nombre_usuario email")
      .populate("beneficiario_id", "nombre_usuario email")
      .sort({ fecha_creacion: -1 });

    console.log("Tickets enviados desde el backend:", tickets);
    res.json(tickets);
  } catch (error) {
    console.error("Error al obtener tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

// Crear nuevo ticket
router.post("/", async (req, res) => {
  try {
    console.log("Datos recibidos en el backend:", req.body);

    const {
      titulo,
      descripcion,
      categoria,
      subcategoria,
      prioridad,
      aliado_id,
      equipo_creador_id,
      beneficiario_id,
      correo_contacto,
    } = req.body;

    // Validaciones básicas
    if (!titulo || !descripcion || !categoria) {
      return res.status(400).json({
        error: "Campos requeridos faltantes: titulo, descripcion, categoria",
      });
    }

    // Verificar que al menos uno de los IDs esté presente
    if (!aliado_id && !beneficiario_id && !equipo_creador_id) {
      return res.status(400).json({
        error:
          "Debe proporcionar al menos un ID: aliado_id, beneficiario_id o equipo_creador_id",
      });
    }

    const ticketData = {
      titulo,
      descripcion,
      categoria,
      subcategoria,
      prioridad: prioridad || "Media",
      // CORREGIDO: Usar estado válido del enum
      estado: "Esperando Respuesta",
      fecha_creacion: new Date(),
      ultima_actualizacion: new Date(),
      // Campos de seguimiento y respuesta
      seguimiento: [],
      tiempos_respuesta: {
        inicio: new Date(),
        resolucion: null,
      },
      encuesta: {
        enviada: false,
        fecha_envio: null,
      },
      satisfaccion: {
        calificacion: null,
        comentario: null,
        fecha_calificacion: null,
      },
      metricas: {
        tiempo_resolucion: {
          minutos: 0,
          horas: 0,
          dias: 0,
          semanas: 0,
        },
        numero_interacciones: 0,
        reabierto: false,
        veces_reabierto: 0,
      },
    };

    // Asignar correo_contacto solo si existe y no está vacío
    if (correo_contacto && correo_contacto.trim() !== "") {
      ticketData.correo_contacto = correo_contacto.trim();
    }

    // Asignar IDs solo si no son null, undefined o strings vacíos
    if (aliado_id && aliado_id.trim() !== "") {
      ticketData.aliado_id = aliado_id;
    }
    if (beneficiario_id && beneficiario_id.trim() !== "") {
      ticketData.beneficiario_id = beneficiario_id;
    }
    if (equipo_creador_id && equipo_creador_id.trim() !== "") {
      ticketData.equipo_creador_id = equipo_creador_id;
    }

    console.log("Datos del ticket a crear:", ticketData);

    const newTicket = new Ticket(ticketData);
    const savedTicket = await newTicket.save();

    console.log("Ticket creado con éxito:", savedTicket._id);

    // Poblar el ticket creado
    const populatedTicket = await Ticket.findById(savedTicket._id)
      .populate("aliado_id", "nombre_usuario email")
      .populate("beneficiario_id", "nombre_usuario email");

    res.status(201).json(populatedTicket);
  } catch (error) {
    console.error("Error detallado al crear ticket:", error);

    // Manejo específico de errores de validación de Mongoose
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        error: "Errores de validación",
        details: validationErrors,
      });
    }

    // Error de duplicado (si hay índices únicos)
    if (error.code === 11000) {
      return res.status(400).json({
        error: "El ticket ya existe",
        details: error.keyValue,
      });
    }

    res.status(500).json({
      error: "Error interno del servidor al crear ticket",
      details: error.message,
    });
  }
});

// Actualizar estado del ticket
router.patch("/:id/estado", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    const estadosFinales = ["Resuelto", "No Resuelto", "Cerrado"];

    // Si se está cambiando a un estado final y no hay tiempo de resolución, establecerlo
    if (
      estadosFinales.includes(req.body.estado) &&
      !ticket.tiempos_respuesta.resolucion
    ) {
      ticket.tiempos_respuesta.resolucion = new Date();
    }

    const estadoAnterior = ticket.estado;
    ticket.estado = req.body.estado;
    ticket.ultima_actualizacion = new Date();

    // Agregar entrada al seguimiento
    if (!ticket.seguimiento) {
      ticket.seguimiento = [];
    }

    ticket.seguimiento.push({
      mensaje: req.body.mensaje || `Estado actualizado a ${req.body.estado}`,
      estado_anterior: estadoAnterior,
      estado_nuevo: req.body.estado,
      interno: true,
      fecha: new Date(),
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("aliado_id", "nombre_usuario email")
      .populate("beneficiario_id", "nombre_usuario email");

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error al actualizar el estado:", error);
    res
      .status(500)
      .json({ error: "Error al actualizar estado: " + error.message });
  }
});

// Actualizar ticket
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      ultima_actualizacion: new Date(),
    };

    const updatedTicket = await Ticket.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("aliado_id", "nombre_usuario email")
      .populate("beneficiario_id", "nombre_usuario email");

    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    res
      .status(500)
      .json({ error: "Error al actualizar ticket: " + error.message });
  }
});

// Actualizar satisfacción del ticket
router.post("/:id/satisfaccion", async (req, res) => {
  try {
    const { id } = req.params;
    const { calificacion, comentario } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    // Inicializar objetos si no existen
    if (!ticket.satisfaccion) {
      ticket.satisfaccion = {};
    }
    if (!ticket.encuesta) {
      ticket.encuesta = {};
    }

    ticket.satisfaccion.calificacion = calificacion;
    ticket.satisfaccion.comentario = comentario;
    ticket.satisfaccion.fecha_calificacion = new Date();

    ticket.encuesta.enviada = true;
    ticket.encuesta.fecha_envio = new Date();

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error("Error al actualizar satisfacción:", error);
    res
      .status(500)
      .json({ error: "Error al actualizar satisfacción: " + error.message });
  }
});

// Eliminar ticket
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTicket = await Ticket.findByIdAndDelete(id);

    if (!deletedTicket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    res.json({ message: "Ticket eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar ticket:", error);
    res
      .status(500)
      .json({ error: "Error al eliminar ticket: " + error.message });
  }
});

export default router;
