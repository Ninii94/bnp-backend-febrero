import { Usuario } from '../models/Usuario.js';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';

// Obtener perfil de usuario
export const obtenerPerfil = async (req, res) => {
  try {
    const { id } = req.params;

    // Primero buscar el usuario
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    let datos = {
      nombre_usuario: usuario.nombre_usuario,
      correo: usuario.correo,
      telefono: usuario.telefono,
      foto: usuario.foto,
      tipo: usuario.tipo
    };

    // Buscar info adicional según tipo
    if (usuario.tipo === 'aliado') {
      const aliado = await Aliado.findOne({ usuario_id: id }).populate('sucursales');
      if (aliado) {
        datos = {
          ...datos,
          inicio_contrato: aliado.inicio_contrato,
          fin_contrato: aliado.fin_contrato,
          departamento: aliado.departamento,
          sucursales: aliado.sucursales || [],
          servicios: aliado.servicios || []
        };
      }
    } else if (usuario.tipo === 'beneficiario') {
      const beneficiario = await Beneficiario.findOne({ usuario_id: id });
      if (beneficiario) {
        datos = {
          ...datos,
          departamento: beneficiario.departamento,
          servicios: beneficiario.servicios || []
        };
      }
    }

    return res.status(200).json(datos);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return res.status(500).json({ mensaje: 'Error al obtener el perfil', error: error.message });
  }
};

// Actualizar campo del perfil
export const actualizarCampoPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;

    // Primero actualizar el usuario
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Campos que pueden actualizarse directamente en Usuario
    const camposUsuario = ['nombre_usuario', 'correo', 'telefono', 'foto'];
    const actualizacionesUsuario = {};
    const actualizacionesExtra = {};

    // Separar actualizaciones
    for (const campo in actualizaciones) {
      if (camposUsuario.includes(campo)) {
        actualizacionesUsuario[campo] = actualizaciones[campo];
      } else {
        actualizacionesExtra[campo] = actualizaciones[campo];
      }
    }

    // Actualizar Usuario si hay campos
    if (Object.keys(actualizacionesUsuario).length > 0) {
      await Usuario.findByIdAndUpdate(id, actualizacionesUsuario);
    }

    // Actualizar modelo específico según tipo
    if (usuario.tipo === 'aliado' && Object.keys(actualizacionesExtra).length > 0) {
      await Aliado.findOneAndUpdate(
        { usuario_id: id },
        actualizacionesExtra
      );
    } else if (usuario.tipo === 'beneficiario' && Object.keys(actualizacionesExtra).length > 0) {
      await Beneficiario.findOneAndUpdate(
        { usuario_id: id },
        actualizacionesExtra
      );
    }

    return res.status(200).json({ mensaje: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({ mensaje: 'Error al actualizar el perfil', error: error.message });
  }
};

// Nuevo controlador específico para actualizar servicios
export const actualizarServicios = async (req, res) => {
  try {
    const { id } = req.params;
    const { servicios } = req.body;

    if (!Array.isArray(servicios)) {
      return res.status(400).json({ mensaje: 'El formato de servicios es inválido' });
    }

    // Primero verificar el tipo de usuario
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Actualizar según tipo
    if (usuario.tipo === 'aliado') {
      await Aliado.findOneAndUpdate(
        { usuario_id: id },
        { servicios }
      );
    } else if (usuario.tipo === 'beneficiario') {
      await Beneficiario.findOneAndUpdate(
        { usuario_id: id },
        { servicios }
      );
    } else {
      return res.status(400).json({ mensaje: 'Tipo de usuario no soportado' });
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
