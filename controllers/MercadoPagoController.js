// src/controllers/MercadoPagoController.js
import MercadoPagoService from '../services/MercadoPagoService.js';
import Reserva from '../models/Reserva.js';

class MercadoPagoController {
  // Crear preferencia de pago
  static async crearPreferenciaPago(req, res) {
    try {
      const { reservaId } = req.params;
      
      if (!reservaId) {
        return res.status(400).json({ error: 'ID de reserva es requerido' });
      }
      
      const preferencia = await MercadoPagoService.crearPreferenciaPago(reservaId);
      
      res.status(200).json(preferencia);
    } catch (error) {
      console.error('Error en controlador de creación de preferencia:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        detalles: 'Error en la creación de preferencia de pago'
      });
    }
  }
  
  // Procesar webhook
  static async procesarWebhook(req, res) {
    try {
      const { type, data } = req.body;
      
      if (!type || !data) {
        return res.status(400).json({ error: 'Parámetros incompletos' });
      }
      
      const resultado = await MercadoPagoService.procesarWebhook(type, data);
      
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en controlador de webhook:', error);
      // Importante: Siempre responder 200 a MercadoPago para evitar reintentos
      res.status(200).json({ 
        error: error.message,
        detalles: 'Error en el procesamiento del webhook'
      });
    }
  }
  
  // Verificar estado de pago
  static async verificarEstadoPago(req, res) {
    try {
      const { paymentId } = req.params;
      
      if (!paymentId) {
        return res.status(400).json({ error: 'ID de pago es requerido' });
      }
      
      const resultado = await MercadoPagoService.verificarPago(paymentId);
      
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en controlador de verificación de pago:', error);
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        detalles: 'Error en la verificación del estado de pago'
      });
    }
  }
}

export default MercadoPagoController;