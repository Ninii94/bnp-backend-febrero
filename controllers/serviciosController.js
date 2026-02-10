// controllers/serviciosController.js
import { Usuario } from '../models/Usuario.js';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';

export const actualizarServicios = async (req, res) => {
  try {
    console.log('Recibida solicitud para actualizar servicios');
    const { id } = req.params;
    const { servicios } = req.body;

    console.log(`ID: ${id}, Servicios: ${JSON.stringify(servicios)}`);

    if (!Array.isArray(servicios)) {
      return res.status(400).json({ mensaje: 'El formato de servicios es inválido' });
    }

    // Verificar el tipo de usuario
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    let actualizado = false;

    // Actualizar según tipo
    if (usuario.tipo === 'aliado') {
      const result = await Aliado.findOneAndUpdate(
        { usuario_id: id },
        { servicios },
        { new: true }
      );
      actualizado = Boolean(result);
    } else if (usuario.tipo === 'beneficiario') {
      const result = await Beneficiario.findOneAndUpdate(
        { usuario_id: id },
        { servicios },
        { new: true }
      );
      actualizado = Boolean(result);
    } else {
      return res.status(400).json({ mensaje: 'Tipo de usuario no soportado' });
    }

    if (!actualizado) {
      return res.status(404).json({ mensaje: 'No se pudo actualizar los servicios' });
    }

    return res.status(200).json({ 
      mensaje: 'Servicios actualizados correctamente',
      servicios
    });
  } catch (error) {
    console.error('Error al actualizar servicios:', error);
    return res.status(500).json({ mensaje: 'Error al actualizar los servicios', error: error.message });
  }
};