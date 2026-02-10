import express from 'express';
import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isBeneficiario, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación aplicado a todas las rutas
router.use(checkAuth);

/**
 * @route GET /api/pareja/info/:beneficiarioId
 * @desc Obtener la información de la pareja de un beneficiario específico
 * @access Privado - Equipo BNP o propietario del beneficiario
 */
router.get('/info/:beneficiarioId', async (req, res) => {
  try {
    const { beneficiarioId } = req.params;

    // Validar el formato del ID
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de beneficiario inválido'
      });
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar autorización: solo el propietario o el equipo BNP puede ver esta información
    if (
      req.usuario.tipo !== 'equipoBNP' && 
      (!beneficiario.usuario_id || beneficiario.usuario_id.toString() !== req.usuario._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        mensaje: 'No autorizado para acceder a esta información'
      });
    }

    // Si no hay información de pareja, devolver un objeto vacío en lugar de null
    const infoParejaResponse = beneficiario.pareja || {
      nombre_completo: '',
      telefono: '',
      correo: ''
    };

    return res.status(200).json({
      success: true,
      pareja: infoParejaResponse
    });
  } catch (error) {
    console.error('Error al obtener información de pareja:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener información de pareja',
      error: error.message
    });
  }
});

/**
 * @route POST /api/pareja/guardar/:beneficiarioId
 * @desc Guardar o actualizar la información de pareja de un beneficiario
 * @access Privado - Equipo BNP o propietario del beneficiario
 */
router.post('/guardar/:beneficiarioId', async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { nombre_completo, telefono, correo } = req.body;

    // Validar el formato del ID
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de beneficiario inválido'
      });
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar autorización: solo el propietario o el equipo BNP puede modificar esta información
    if (
      req.usuario.tipo !== 'equipoBNP' && 
      (!beneficiario.usuario_id || beneficiario.usuario_id.toString() !== req.usuario._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        mensaje: 'No autorizado para modificar esta información'
      });
    }

    // Actualizar la información de la pareja
    beneficiario.pareja = {
      nombre_completo: nombre_completo || '',
      telefono: telefono || '',
      correo: correo || ''
    };

    await beneficiario.save();

    return res.status(200).json({
      success: true,
      mensaje: 'Información de pareja guardada con éxito',
      pareja: beneficiario.pareja
    });
  } catch (error) {
    console.error('Error al guardar información de pareja:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al guardar información de pareja',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/pareja/eliminar/:beneficiarioId
 * @desc Eliminar la información de pareja de un beneficiario
 * @access Privado - Equipo BNP o propietario del beneficiario
 */
router.delete('/eliminar/:beneficiarioId', async (req, res) => {
  try {
    const { beneficiarioId } = req.params;

    // Validar el formato del ID
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de beneficiario inválido'
      });
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar autorización: solo el propietario o el equipo BNP puede eliminar esta información
    if (
      req.usuario.tipo !== 'equipoBNP' && 
      (!beneficiario.usuario_id || beneficiario.usuario_id.toString() !== req.usuario._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        mensaje: 'No autorizado para eliminar esta información'
      });
    }

    // Eliminar la información de la pareja estableciéndola como null
    beneficiario.pareja = null;
    await beneficiario.save();

    return res.status(200).json({
      success: true,
      mensaje: 'Información de pareja eliminada con éxito'
    });
  } catch (error) {
    console.error('Error al eliminar información de pareja:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al eliminar información de pareja',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/pareja/actualizar-campo/:beneficiarioId
 * @desc Actualizar un campo específico de la información de pareja
 * @access Privado - Equipo BNP o propietario del beneficiario
 */
router.put('/actualizar-campo/:beneficiarioId', async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { campo, valor } = req.body;

    // Validar que se proporcione un campo y un valor
    if (!campo || valor === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Se requiere especificar el campo y el valor a actualizar'
      });
    }

    // Validar que el campo sea válido
    const camposPermitidos = ['nombre_completo', 'telefono', 'correo'];
    if (!camposPermitidos.includes(campo)) {
      return res.status(400).json({
        success: false,
        mensaje: `Campo inválido. Los campos permitidos son: ${camposPermitidos.join(', ')}`
      });
    }

    // Validar el formato del ID
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de beneficiario inválido'
      });
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar autorización: solo el propietario o el equipo BNP puede modificar esta información
    if (
      req.usuario.tipo !== 'equipoBNP' && 
      (!beneficiario.usuario_id || beneficiario.usuario_id.toString() !== req.usuario._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        mensaje: 'No autorizado para modificar esta información'
      });
    }

    // Inicializar el objeto pareja si no existe
    if (!beneficiario.pareja) {
      beneficiario.pareja = {
        nombre_completo: '',
        telefono: '',
        correo: ''
      };
    }

    // Actualizar el campo específico
    beneficiario.pareja[campo] = valor;
    await beneficiario.save();

    return res.status(200).json({
      success: true,
      mensaje: `Campo ${campo} actualizado con éxito`,
      pareja: beneficiario.pareja
    });
  } catch (error) {
    console.error('Error al actualizar campo de pareja:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar campo de pareja',
      error: error.message
    });
  }
});

/**
 * @route GET /api/pareja/validar/:beneficiarioId
 * @desc Verificar si existe información de pareja para un beneficiario
 * @access Privado - Equipo BNP o propietario del beneficiario
 */
router.get('/validar/:beneficiarioId', async (req, res) => {
  try {
    const { beneficiarioId } = req.params;

    // Validar el formato del ID
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de beneficiario inválido'
      });
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Beneficiario no encontrado'
      });
    }

    // Verificar autorización: solo el propietario o el equipo BNP puede acceder a esta información
    if (
      req.usuario.tipo !== 'equipoBNP' && 
      (!beneficiario.usuario_id || beneficiario.usuario_id.toString() !== req.usuario._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        mensaje: 'No autorizado para acceder a esta información'
      });
    }

    // Verificar si existe información de pareja y si contiene datos
    const existeInfoPareja = beneficiario.pareja !== null && 
                           beneficiario.pareja !== undefined &&
                           (
                             (beneficiario.pareja.nombre_completo && beneficiario.pareja.nombre_completo.trim() !== '') ||
                             (beneficiario.pareja.telefono && beneficiario.pareja.telefono.trim() !== '') ||
                             (beneficiario.pareja.correo && beneficiario.pareja.correo.trim() !== '')
                           );

    return res.status(200).json({
      success: true,
      existe: existeInfoPareja,
      mensaje: existeInfoPareja ? 'Existe información de pareja' : 'No existe información de pareja'
    });
  } catch (error) {
    console.error('Error al validar información de pareja:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al validar información de pareja',
      error: error.message
    });
  }
});

export default router;