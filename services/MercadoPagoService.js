// src/services/MercadoPagoService.js
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import Reserva from '../models/Reserva.js';

// Cargar variables de entorno
dotenv.config();

// Configurar MercadoPago (versión actualizada)
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

class MercadoPagoService {
  // Crear preferencia de pago para una reserva
  static async crearPreferenciaPago(reservaId) {
    try {
      // Obtener la reserva
      const reserva = await Reserva.findById(reservaId);
      
      if (!reserva) {
        throw new Error('Reserva no encontrada');
      }
      
      // Obtener información del contacto principal
      const contactoPrincipal = reserva.pasajeros.find(p => p.email);
      
      if (!contactoPrincipal) {
        throw new Error('No se encontró información de contacto en la reserva');
      }
      
      // Crear preferencia con el SDK actualizado
      const preference = new Preference(mercadopago);
      
      const preferenceData = {
        items: [
          {
            id: reservaId,
            title: `Reserva de vuelo ${reserva.vuelo.itinerario.itineraries[0].segments[0].departure.iataCode} a ${reserva.vuelo.itinerario.itineraries[0].segments[reserva.vuelo.itinerario.itineraries[0].segments.length-1].arrival.iataCode}`,
            description: `${reserva.pasajeros.length} pasajero(s) - ${reserva.vuelo.itinerario.itineraries.length > 1 ? 'Ida y vuelta' : 'Solo ida'}`,
            quantity: 1,
            currency_id: reserva.vuelo.moneda,
            unit_price: reserva.vuelo.precio_con_descuento
          }
        ],
        payer: {
          name: contactoPrincipal.nombre,
          surname: contactoPrincipal.apellido,
          email: contactoPrincipal.email,
          phone: {
            number: contactoPrincipal.telefono
          }
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/confirmacion/${reservaId}`,
          failure: `${process.env.FRONTEND_URL}/pago/${reservaId}?status=failure`,
          pending: `${process.env.FRONTEND_URL}/pago/${reservaId}?status=pending`
        },
        auto_return: 'approved',
        external_reference: reservaId,
        statement_descriptor: 'Viajes BNP',
      };
      
      const response = await preference.create({ body: preferenceData });
      
      // Actualizar la reserva con la preferencia de pago
      reserva.metodo_pago = {
        tipo: 'MERCADOPAGO',
        detalles: {
          preference_id: response.id
        }
      };
      
      await reserva.save();
      
      return response;
    } catch (error) {
      console.error('Error creando preferencia de pago:', error);
      throw error;
    }
  }
  
  // Verificar estado de un pago
  static async verificarPago(paymentId) {
    try {
      const payment = new Payment(mercadopago);
      const response = await payment.get({ id: paymentId });
      return response;
    } catch (error) {
      console.error('Error verificando pago:', error);
      throw error;
    }
  }
  
  // Procesar webhook de notificación de MercadoPago
  static async procesarWebhook(tipo, data) {
    try {
      // Si es una notificación de pago
      if (tipo === 'payment') {
        const paymentId = data.id;
        const paymentInfo = await this.verificarPago(paymentId);
        
        // Obtener la reserva por external_reference
        const reservaId = paymentInfo.external_reference;
        const reserva = await Reserva.findById(reservaId);
        
        if (!reserva) {
          throw new Error(`No se encontró la reserva con ID ${reservaId}`);
        }
        
        // Actualizar estado del pago según el estado de MercadoPago
        switch (paymentInfo.status) {
          case 'approved':
            reserva.estado_pago = 'COMPLETADO';
            break;
          case 'pending':
            reserva.estado_pago = 'PENDIENTE';
            break;
          case 'in_process':
            reserva.estado_pago = 'PROCESANDO';
            break;
          case 'rejected':
            reserva.estado_pago = 'ERROR';
            break;
          case 'cancelled':
            reserva.estado_pago = 'CANCELADO';
            break;
          default:
            reserva.estado_pago = 'PENDIENTE';
        }
        
        // Guardar detalles adicionales
        reserva.metodo_pago.detalles = {
          ...reserva.metodo_pago.detalles,
          payment_id: paymentId,
          payment_status: paymentInfo.status,
          payment_method: paymentInfo.payment_method_id,
          payment_amount: paymentInfo.transaction_amount
        };
        
        reserva.fecha_actualizacion = new Date();
        
        await reserva.save();
        
        return {
          success: true,
          reserva
        };
      }
      
      return {
        success: true,
        message: 'Notificación recibida pero no procesada'
      };
    } catch (error) {
      console.error('Error procesando webhook:', error);
      throw error;
    }
  }
}

export default MercadoPagoService;