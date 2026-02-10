import express from 'express';
import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isBeneficiario } from '../middleware/auth.js';

const router = express.Router();

// Obtener información del código de reembolso del beneficiario autenticado
router.get('/perfil-reembolso', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    
    // Obtener el beneficiario (ya debería estar disponible desde el middleware)
    const beneficiario = req.beneficiario || await Beneficiario.findOne({ usuario_id: usuarioId });
    
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Perfil de beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.json({ 
        exito: true,
        codigo: null,
        mensaje: 'No tiene un código de reembolso asignado'
      });
    }
    
    // Verificar si está expirado
    const expirado = beneficiario.isCodigoReembolsoExpirado();
    
    // Calcular tiempo restante
    const tiempoRestante = beneficiario.tiempoRestanteCodigoReembolso();
    
    // Obtener información relevante
    const codigoInfo = {
      codigo: beneficiario.codigo_reembolso.codigo,
      monto: beneficiario.codigo_reembolso.monto,
      activo: beneficiario.codigo_reembolso.activo,
      fecha_creacion: beneficiario.codigo_reembolso.fecha_creacion,
      fecha_expiracion: beneficiario.codigo_reembolso.fecha_expiracion,
      servicios_aplicables: beneficiario.codigo_reembolso.servicios_aplicables
    };
    
    res.json({
      exito: true,
      codigo: codigoInfo,
      expirado,
      tiempoRestante
    });
    
  } catch (error) {
    console.error('Error al obtener código de reembolso del beneficiario:', error);
    res.status(500).json({ 
      exito: false, 
      mensaje: 'Error al obtener información del código de reembolso',
      error: error.message
    });
  }
});

// Historial de uso del código de reembolso
router.get('/historial-reembolso', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    
    // Obtener el beneficiario
    const beneficiario = req.beneficiario || await Beneficiario.findOne({ usuario_id: usuarioId });
    
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Perfil de beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.json({ 
        exito: true,
        historial: [],
        mensaje: 'No tiene un código de reembolso asignado'
      });
    }
    
    // Obtener historial
    const historial = beneficiario.codigo_reembolso.historial || [];
    
    // Ordenar por fecha (más reciente primero)
    historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    res.json({
      exito: true,
      historial
    });
    
  } catch (error) {
    console.error('Error al obtener historial de código de reembolso:', error);
    res.status(500).json({ 
      exito: false, 
      mensaje: 'Error al obtener historial del código de reembolso',
      error: error.message
    });
  }
});

// Verificar si un servicio acepta el código de reembolso 
// (útil para verificar antes de redirigir a un servicio como Amadeus)
router.get('/verificar-servicio/:servicio', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const { servicio } = req.params;
    const usuarioId = req.usuario._id;
    
    // Validar el servicio
    if (!servicio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Debe especificar un servicio'
      });
    }
    
    // Obtener el beneficiario
    const beneficiario = req.beneficiario || await Beneficiario.findOne({ usuario_id: usuarioId });
    
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Perfil de beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.json({ 
        exito: false,
        valido: false,
        mensaje: 'No tiene un código de reembolso asignado'
      });
    }
    
    // Verificar si está activo
    if (!beneficiario.codigo_reembolso.activo) {
      return res.json({
        exito: false,
        valido: false,
        mensaje: 'Su código de reembolso no está activo'
      });
    }
    
    // Verificar si ha expirado
    if (beneficiario.isCodigoReembolsoExpirado()) {
      return res.json({
        exito: false,
        valido: false,
        mensaje: 'Su código de reembolso ha expirado'
      });
    }
    
    // Verificar si el servicio es aplicable
    const servicioValido = beneficiario.codigo_reembolso.servicios_aplicables.includes(servicio);
    
    if (!servicioValido) {
      return res.json({
        exito: false,
        valido: false,
        mensaje: `Su código no es aplicable para el servicio "${servicio}"`
      });
    }
    
    // Todo válido
    res.json({
      exito: true,
      valido: true,
      mensaje: 'Código válido para este servicio',
      codigo: beneficiario.codigo_reembolso.codigo,
      monto: beneficiario.codigo_reembolso.monto
    });
    
  } catch (error) {
    console.error('Error al verificar servicio para código de reembolso:', error);
    res.status(500).json({ 
      exito: false, 
      mensaje: 'Error al verificar servicios para el código de reembolso',
      error: error.message
    });
  }
});

// Solicitar un servicio que use el código de reembolso
router.post('/solicitar/:servicio', checkAuth, isBeneficiario, async (req, res) => {
  try {
    const { servicio } = req.params;
    const { detalles } = req.body;
    const usuarioId = req.usuario._id;
    
    // Validar el servicio
    if (!servicio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Debe especificar un servicio'
      });
    }
    
    // Obtener el beneficiario
    const beneficiario = req.beneficiario || await Beneficiario.findOne({ usuario_id: usuarioId });
    
    if (!beneficiario) {
      return res.status(404).json({ 
        exito: false, 
        mensaje: 'Perfil de beneficiario no encontrado' 
      });
    }
    
    // Verificar si tiene código de reembolso
    if (!beneficiario.codigo_reembolso || !beneficiario.codigo_reembolso.codigo) {
      return res.json({ 
        exito: false,
        mensaje: 'No tiene un código de reembolso asignado'
      });
    }
    
    // Verificar si está activo
    if (!beneficiario.codigo_reembolso.activo) {
      return res.json({
        exito: false,
        mensaje: 'Su código de reembolso no está activo'
      });
    }
    
    // Verificar si ha expirado
    if (beneficiario.isCodigoReembolsoExpirado()) {
      return res.json({
        exito: false,
        mensaje: 'Su código de reembolso ha expirado'
      });
    }
    
    // Verificar si el servicio es aplicable
    const servicioValido = beneficiario.codigo_reembolso.servicios_aplicables.includes(servicio);
    
    if (!servicioValido) {
      return res.json({
        exito: false,
        mensaje: `Su código no es aplicable para el servicio "${servicio}"`
      });
    }
    
    // Registrar la solicitud en el historial
    beneficiario.codigo_reembolso.historial.push({
      accion: 'USO',
      fecha: new Date(),
      usuario: req.usuario._id,
      detalles: detalles || `Solicitud de servicio: ${servicio}`
    });
    
    // En un sistema de producción, aquí iría la lógica para:
    // 1. Integrar con el servicio externo (ej. Amadeus)
    // 2. Aplicar el descuento/reembolso
    // 3. Crear un registro de transacción
    
    // Guardar los cambios en el historial
    await beneficiario.save();
    
    res.json({
      exito: true,
      mensaje: `Solicitud para servicio "${servicio}" registrada correctamente`,
      codigo: beneficiario.codigo_reembolso.codigo,
      monto: beneficiario.codigo_reembolso.monto
    });
    
  } catch (error) {
    console.error('Error al solicitar servicio con código de reembolso:', error);
    res.status(500).json({ 
      exito: false, 
      mensaje: 'Error al procesar la solicitud',
      error: error.message
    });
  }
});

export default router;