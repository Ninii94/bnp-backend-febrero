
import express from 'express';
import { Beneficiario } from '../models/Beneficiario.js';
import CodigoController from '../controllers/CodigoController.js';

console.log("CodigoController:", typeof CodigoController);
console.log("Propiedades:", Object.getOwnPropertyNames(CodigoController));

const router = express.Router();

// ---------- RUTAS PARA CÓDIGOS ----------


console.log("Métodos disponibles:", Object.keys(CodigoController));

router.post('/crear', CodigoController.crearNuevoCodigo);
router.post('/generar', CodigoController.generarNuevoCodigo);
router.post('/monto', CodigoController.actualizarMonto);
router.post('/fechaActivacion', CodigoController.actualizarFechaActivacion);
router.post('/verificar', CodigoController.verificarCodigo);
router.post('/cobrar', CodigoController.marcarComoCobrado);
router.post('/desactivar', CodigoController.desactivarCodigo);
router.post('/reactivar', CodigoController.reactivarCodigo);

// Ruta para actualizar prima pagada y calcular automáticamente el reembolso
router.post('/primaPagada', async (req, res) => {
  try {
    const { beneficiarioId, primaPagada } = req.body;

    if (!beneficiarioId) {
      return res.status(400).json({ error: 'ID de beneficiario no proporcionado' });
    }

    if (isNaN(parseFloat(primaPagada))) {
      return res.status(400).json({ error: 'El valor de prima pagada no es válido' });
    }

    // Buscar y actualizar beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Calcular el reembolso (5.75% de la prima pagada)
    const primaPagadaFloat = parseFloat(primaPagada);
    const montoReembolso = primaPagadaFloat * 0.0575;

    // Actualizar la prima pagada y el monto de reembolso
    if (!beneficiario.codigo) {
      beneficiario.codigo = {};
    }
    
    beneficiario.codigo.primaPagada = primaPagadaFloat;
    
    // Actualizar monto de reembolso
    if (!beneficiario.codigo.monto) {
      beneficiario.codigo.monto = {
        valor: montoReembolso,
        moneda: 'USD'
      };
    } else {
      beneficiario.codigo.monto.valor = montoReembolso;
    }

    // Añadir al historial
    if (!beneficiario.codigo.historial) {
      beneficiario.codigo.historial = [];
    }

    beneficiario.codigo.historial.push({
      fecha_cambio: new Date(),
      motivo: 'OTRO',
      detalles: `Prima pagada: ${primaPagadaFloat} USD | Reembolso calculado: ${montoReembolso.toFixed(2)} USD (5.75%)`
    });

    await beneficiario.save();

    return res.status(200).json({ 
      message: 'Prima pagada y reembolso actualizados correctamente',
      beneficiario,
      primaPagada: primaPagadaFloat,
      montoReembolso: montoReembolso
    });
  } catch (error) {
    console.error('Error al actualizar prima pagada:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para cancelar reembolso
router.post('/cancelarReembolso', async (req, res) => {
  try {
    const { beneficiarioId, motivo } = req.body;

    if (!beneficiarioId) {
      return res.status(400).json({ error: 'ID de beneficiario no proporcionado' });
    }

    if (!motivo) {
      return res.status(400).json({ error: 'Motivo de cancelación no proporcionado' });
    }

    // Buscar y actualizar beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Verificar que el código no esté ya cobrado
    if (!beneficiario.codigo || beneficiario.codigo.estado_activacion === 'COBRADO') {
      return res.status(400).json({ error: 'El código no puede ser cancelado en su estado actual' });
    }

    // Cancelar el código
    beneficiario.codigo.estado_activacion = 'CANCELADO';
    beneficiario.codigo.motivoCancelacion = motivo;
    beneficiario.codigo.fechaCancelacion = new Date();
    beneficiario.codigo.activo = false;

    // Añadir al historial
    if (!beneficiario.codigo.historial) {
      beneficiario.codigo.historial = [];
    }

    beneficiario.codigo.historial.push({
      fecha_cambio: new Date(),
      motivo: 'CANCELACION',
      detalles: `Reembolso cancelado. Motivo: ${motivo}`
    });

    await beneficiario.save();

    return res.status(200).json({ 
      message: 'Reembolso cancelado correctamente',
      beneficiario
    });
  } catch (error) {
    console.error('Error al cancelar reembolso:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ---------- RUTAS PARA BENEFICIARIOS ----------

// Obtener todos los beneficiarios
router.get('/beneficiarios', async (req, res) => {
  try {
    const beneficiarios = await Beneficiario.find()
      .populate('estado_id')
      .populate('aliado_id')
      .populate('usuario_id')
      .sort({ fecha_creacion: -1 });
      
    res.json(beneficiarios);
  } catch (error) {
    console.error('Error al obtener beneficiarios:', error);
    res.status(500).json({ error: 'Error al obtener beneficiarios' });
  }
});

router.get('/beneficiarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
      
    const beneficiario = await Beneficiario.findById(id)
      .populate('estado_id')
      .populate('sucursal')
      .populate('aliado_id')
      .populate('usuario_id')
      .setOptions({ strictPopulate: false });
      
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }
      
    res.json(beneficiario);
  } catch (error) {
    console.error('Error al obtener beneficiario:', error);
    res.status(500).json({
      error: 'Error al obtener beneficiario',
      detalles: error.message
    });
  }
});

export default router;