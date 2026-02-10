import mongoose from 'mongoose';
import { Beneficiario } from '../models/Beneficiario.js';

/**
 * Servicio para manejar operaciones relacionadas con la información de pareja de los beneficiarios
 */
class ParejaService {
  /**
   * Obtiene la información de pareja de un beneficiario
   * @param {string} beneficiarioId - ID del beneficiario
   * @returns {Object} Objeto con información de la pareja o un objeto vacío
   */
  static async obtenerInfoPareja(beneficiarioId) {
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      throw new Error('ID de beneficiario inválido');
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }

    // Retornar un objeto vacío si no hay información de pareja
    return beneficiario.pareja || {
      nombre_completo: '',
      telefono: '',
      correo: ''
    };
  }

  /**
   * Guarda o actualiza la información de pareja de un beneficiario
   * @param {string} beneficiarioId - ID del beneficiario
   * @param {Object} datosPareja - Objeto con la información de la pareja (nombre_completo, telefono, correo)
   * @returns {Object} Objeto con la información de pareja actualizada
   */
  static async guardarInfoPareja(beneficiarioId, datosPareja) {
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      throw new Error('ID de beneficiario inválido');
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }

    // Validar que los campos sean los permitidos
    const { nombre_completo, telefono, correo } = datosPareja;
    
    // Actualizar la información de pareja
    beneficiario.pareja = {
      nombre_completo: nombre_completo || '',
      telefono: telefono || '',
      correo: correo || ''
    };

    await beneficiario.save();
    return beneficiario.pareja;
  }

  /**
   * Elimina la información de pareja de un beneficiario
   * @param {string} beneficiarioId - ID del beneficiario
   * @returns {boolean} True si se eliminó correctamente
   */
  static async eliminarInfoPareja(beneficiarioId) {
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      throw new Error('ID de beneficiario inválido');
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }

    beneficiario.pareja = null;
    await beneficiario.save();
    return true;
  }

  /**
   * Actualiza un campo específico de la información de pareja
   * @param {string} beneficiarioId - ID del beneficiario
   * @param {string} campo - Campo a actualizar (nombre_completo, telefono, correo)
   * @param {string} valor - Nuevo valor para el campo
   * @returns {Object} Objeto con la información de pareja actualizada
   */
  static async actualizarCampoPareja(beneficiarioId, campo, valor) {
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      throw new Error('ID de beneficiario inválido');
    }

    // Validar que el campo sea válido
    const camposPermitidos = ['nombre_completo', 'telefono', 'correo'];
    if (!camposPermitidos.includes(campo)) {
      throw new Error(`Campo inválido. Los campos permitidos son: ${camposPermitidos.join(', ')}`);
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
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
    
    return beneficiario.pareja;
  }

  /**
   * Verifica si existe información de pareja para un beneficiario
   * @param {string} beneficiarioId - ID del beneficiario
   * @returns {boolean} True si existe información de pareja
   */
  static async existeInfoPareja(beneficiarioId) {
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      throw new Error('ID de beneficiario inválido');
    }

    const beneficiario = await Beneficiario.findById(beneficiarioId);
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }

    return beneficiario.pareja !== null && 
           beneficiario.pareja !== undefined &&
           (
             (beneficiario.pareja.nombre_completo && beneficiario.pareja.nombre_completo.trim() !== '') ||
             (beneficiario.pareja.telefono && beneficiario.pareja.telefono.trim() !== '') ||
             (beneficiario.pareja.correo && beneficiario.pareja.correo.trim() !== '')
           );
  }

  /**
   * Obtiene la lista de beneficiarios que tienen información de pareja
   * @returns {Array} Array de objetos con id del beneficiario e información de pareja
   */
  static async listarBeneficiariosConPareja() {
    // Buscar todos los beneficiarios que tienen el campo pareja definido
    const beneficiarios = await Beneficiario.find({
      pareja: { $exists: true, $ne: null }
    }).select('_id nombre apellido pareja');

    // Filtrar los que realmente tienen datos en los campos de pareja
    return beneficiarios.filter(b => 
      b.pareja && (
        (b.pareja.nombre_completo && b.pareja.nombre_completo.trim() !== '') ||
        (b.pareja.telefono && b.pareja.telefono.trim() !== '') ||
        (b.pareja.correo && b.pareja.correo.trim() !== '')
      )
    ).map(b => ({
      id: b._id,
      nombre_beneficiario: `${b.nombre || ''} ${b.apellido || ''}`.trim(),
      pareja: b.pareja
    }));
  }
}

export default ParejaService;