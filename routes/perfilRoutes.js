// routes/perfilRoutes.js
import express from 'express';
import { Usuario } from '../models/Usuario.js';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Sucursal } from '../models/Sucursal.js';
import { Estado } from '../models/Estado.js'; // Asegúrate de importar el modelo Estado
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

// Obtener lista de perfiles de aliados
router.get('/aliados', async (req, res) => {
  try {
    const aliados = await Aliado.find()
      .populate('usuario_id', 'nombre_usuario correo tipo');
    
    const perfilesAliados = aliados.map(aliado => ({
      _id: aliado._id,
      nombre_usuario: aliado.nombre || aliado.usuario_id?.nombre_usuario,
      correo: aliado.usuario_id?.correo,
      tipo: 'aliado',
      telefono: aliado.telefono,
      departamento: aliado.departamento,
      foto: aliado.foto,
      sucursal: aliado.sucursal,
      descripcion: aliado.descripcion
    }));

    res.json(perfilesAliados);
  } catch (error) {
    console.error('Error al obtener perfiles de aliados:', error);
    res.status(500).json({ error: 'Error al obtener perfiles de aliados' });
  }
});

// Obtener lista de perfiles de beneficiarios
router.get('/beneficiarios', async (req, res) => {
  try {
    const beneficiarios = await Beneficiario.find()
      .populate('usuario_id', 'nombre_usuario correo tipo')
      .populate('estado_id', 'nombre'); // Poblar el estado para obtener su nombre
    
    const perfilesBeneficiarios = beneficiarios.map(beneficiario => ({
      _id: beneficiario._id,
      nombre_usuario: beneficiario.nombre || beneficiario.usuario_id?.nombre_usuario,
      correo: beneficiario.usuario_id?.correo,
      tipo: 'beneficiario',
      telefono: beneficiario.telefono,
      nacionalidad: beneficiario.nacionalidad,
      direccion: beneficiario.direccion,
      departamento: beneficiario.departamento,
      foto: beneficiario.foto,
      descripcion: beneficiario.descripcion,
      hotel_aliado: beneficiario.hotel_aliado,
      aliado_sucursal: beneficiario.aliado_sucursal,
      fecha_creacion: beneficiario.fecha_creacion,
      estado: beneficiario.estado_id ? beneficiario.estado_id.nombre : 'Sin estado asignado',
      enganche_pagado: beneficiario.enganche_pagado
    }));

    res.json(perfilesBeneficiarios);
  } catch (error) {
    console.error('Error al obtener perfiles de beneficiarios:', error);
    res.status(500).json({ error: 'Error al obtener perfiles de beneficiarios' });
  }
});

// Obtener perfil específico por ID
// Modificación de la ruta GET /:id en perfilRoutes.js para incluir los nuevos campos
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Buscando perfil para ID: ${id}`);
    
    // Buscar primero como aliado con populate
    let perfil = await Aliado.findById(id)
      .populate('usuario_id', 'nombre_usuario correo tipo')
      .populate({
        path: 'sucursales',
        match: { activo: true },
        select: 'nombre direccion telefono correo'
      });
    
    let tipo = 'aliado';
    
    // Si no es aliado, buscar como beneficiario con populate adecuado
    if (!perfil) {
      perfil = await Beneficiario.findById(id)
        .populate('usuario_id', 'nombre_usuario correo tipo')
        .populate('estado_id', 'nombre')
        .populate('aliado_id', 'nombre telefono'); // Añadir populate para aliado_id
      tipo = 'beneficiario';
    }

    if (!perfil) {
      console.log(`No se encontró perfil para ID: ${id}`);
      
      // En lugar de devolver un 404, devolvemos un perfil básico por defecto
      return res.json({
        _id: id,
        nombre_usuario: 'Usuario',
        correo: '',
        tipo: 'desconocido',
        telefono: '',
        departamento: '',
        foto: '/default-profile.jpg',
        descripcion: '',
        servicios: [],
        nacionalidad: '',
        direccion: '',
        hotel_aliado: '',
        aliado_sucursal: '',
        fecha_creacion: new Date(),
        estado_id: null,
        enganche_pagado: { valor: 0, moneda: 'reales' }
      });
    }

    // Depuración: Imprimir el perfil completo para ver qué contiene
    console.log(`Perfil encontrado (${tipo}):`, {
      id: perfil._id,
      nombre: perfil.nombre,
      aliado_id: perfil.aliado_id, // Log para verificar si aliado_id existe
      servicios: perfil.servicios,
      // Imprimir los nuevos campos para verificar
      fecha_nacimiento: perfil.fecha_nacimiento || 'no definido',
      pais: perfil.pais || 'no definido',
      estado_provincia: perfil.estado_provincia || 'no definido',
      ciudad: perfil.ciudad || 'no definido'
    });

    // Preparar la respuesta basada en el tipo
    const perfilData = {
      _id: perfil._id,
      nombre_usuario: perfil.nombre || perfil.usuario_id?.nombre_usuario || '',
      correo: perfil.usuario_id?.correo || '',
      tipo: tipo,
      telefono: perfil.telefono || '',
      inicio_contrato: perfil.inicio_contrato || null,
      fin_contrato: perfil.fin_contrato || null,
      departamento: perfil.departamento || '',
      foto: perfil.foto || '',
      portada: perfil.portada || '',
      descripcion: perfil.descripcion || '',
      servicios: Array.isArray(perfil.servicios) ? perfil.servicios.map(id => String(id)) : [],
      
      // Solo incluir sucursales si es un aliado
      sucursales: tipo === 'aliado' && Array.isArray(perfil.sucursales) ? 
        perfil.sucursales.map(s => ({
          _id: s._id,
          nombre: s.nombre || '',
          direccion: s.direccion || '',
          telefono: s.telefono || '',
          correo: s.correo || ''
        })) : [],
      
      // Campos adicionales para beneficiarios
      nacionalidad: tipo === 'beneficiario' ? (perfil.nacionalidad || '') : '',
      direccion: tipo === 'beneficiario' ? (perfil.direccion || '') : '',
      
      // Incluir información del hotel/aliado
      hotel_aliado: tipo === 'beneficiario' ? (perfil.hotel_aliado || '') : '',
      aliado_sucursal: tipo === 'beneficiario' ? (perfil.aliado_sucursal || '') : '',
      
      // Añadir información del aliado si existe
      aliado_id: tipo === 'beneficiario' && perfil.aliado_id ? perfil.aliado_id._id : null,
      aliado_nombre: tipo === 'beneficiario' && perfil.aliado_id ? perfil.aliado_id.nombre : null,
      aliado_telefono: tipo === 'beneficiario' && perfil.aliado_id ? perfil.aliado_id.telefono : null,
      
      fecha_creacion: perfil.fecha_creacion || new Date(),
      estado_id: tipo === 'beneficiario' ? perfil.estado_id : null,
      estado: tipo === 'beneficiario' && perfil.estado_id ? (perfil.estado_id.nombre || 'No asignado') : '',
      enganche_pagado: tipo === 'beneficiario' ? (perfil.enganche_pagado || { valor: 0, moneda: 'reales' }) : { valor: 0, moneda: 'reales' },
      
      // Añadir los nuevos campos que faltan
      apellido: tipo === 'beneficiario' ? (perfil.apellido || '') : '',
      genero: tipo === 'beneficiario' ? (perfil.genero || 'prefiero no decirlo') : '',
      estado_civil: tipo === 'beneficiario' ? (perfil.estado_civil || 'no especificado') : '',
      // Añadir fecha de nacimiento y campos de ubicación que faltan
      fecha_nacimiento: tipo === 'beneficiario' ? perfil.fecha_nacimiento || null : null,
      pais: tipo === 'beneficiario' ? (perfil.pais || '') : '',
      estado_provincia: tipo === 'beneficiario' ? (perfil.estado_provincia || '') : '',
      ciudad: tipo === 'beneficiario' ? (perfil.ciudad || '') : ''
    };

    console.log(`Enviando datos del perfil ID ${id}:`, {
      _id: perfilData._id,
      tipo: perfilData.tipo,
      aliado_id: perfilData.aliado_id,
      aliado_nombre: perfilData.aliado_nombre,
      servicios: perfilData.servicios,
      // Log para verificar si se incluyen los nuevos campos
      fecha_nacimiento: perfilData.fecha_nacimiento ? 'definida' : 'no definida',
      pais: perfilData.pais || 'no definido',
      estado_provincia: perfilData.estado_provincia || 'no definido',
      ciudad: perfilData.ciudad || 'no definido'
    });

    res.json(perfilData);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    
    // En caso de error, devolver un perfil por defecto en lugar de un 500
    res.json({
      _id: req.params.id,
      nombre_usuario: 'Usuario',
      correo: '',
      tipo: 'desconocido',
      telefono: '',
      departamento: '',
      foto: '/default-profile.jpg',
      descripcion: '',
      servicios: [],
      nacionalidad: '',
      direccion: '',
      hotel_aliado: '',
      aliado_sucursal: '',
      fecha_creacion: new Date(),
      estado_id: null,
      enganche_pagado: { valor: 0, moneda: 'reales' }
    });
  }
});

// Actualizar servicios de un perfil
router.put('/mantenimiento-servicios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { servicios } = req.body;
    
    console.log('Actualizando servicios para ID:', id);
    console.log('Servicios recibidos:', servicios);
    
    if (!Array.isArray(servicios)) {
      return res.status(400).json({ 
        mensaje: 'Formato inválido', 
        detalle: 'Se esperaba un array de servicios'
      });
    }
    
    // Buscar primero en Aliado
    let perfil = await Aliado.findById(id);
    let model = Aliado;
    let tipo = 'aliado';
    
    // Si no es aliado, buscar en Beneficiario
    if (!perfil) {
      perfil = await Beneficiario.findById(id);
      model = Beneficiario;
      tipo = 'beneficiario';
    }
    
    if (!perfil) {
      return res.status(404).json({ mensaje: 'Perfil no encontrado' });
    }
    
    console.log('Servicios antes de actualizar:', perfil.servicios);
    
    const usandoNuevoFormato = servicios.some(id => 
      id.match(/^[0-9a-fA-F]{24}$/) 
    );
    
    console.log('¿Usando nuevo formato?', usandoNuevoFormato);
   
    let serviciosActualizados = [...servicios]; 
    
    const perfilActualizado = await model.findByIdAndUpdate(
      id, 
      { servicios: serviciosActualizados },
      { new: true, runValidators: true }
    );
    
    console.log('Servicios después de actualizar:', perfilActualizado.servicios);
    
    // Verificar que se hayan actualizado correctamente
    if (!perfilActualizado || !Array.isArray(perfilActualizado.servicios)) {
      throw new Error('Error al actualizar los servicios');
    }
    
    res.json({ 
      mensaje: 'Servicios actualizados correctamente',
      tipo,
      servicios: perfilActualizado.servicios
    });
  } catch (error) {
    console.error('Error al actualizar servicios:', error);
    res.status(500).json({ 
      mensaje: 'Error del servidor',
      error: error.message
    });
  }
});

// Ruta para actualizar el monto inicial pagado (enganche)
router.put('/enganche/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { valor, moneda } = req.body;
    
    if (valor === undefined || moneda === undefined) {
      return res.status(400).json({
        mensaje: 'Datos incompletos',
        detalle: 'Se requiere valor y moneda'
      });
    }
    
    // Validar que la moneda sea válida
    if (!['reales', 'dolares'].includes(moneda)) {
      return res.status(400).json({
        mensaje: 'Moneda inválida',
        detalle: 'La moneda debe ser "reales" o "dolares"'
      });
    }
    
    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(id);
    
    if (!beneficiario) {
      return res.status(404).json({ mensaje: 'Beneficiario no encontrado' });
    }
    
    // Actualizar el enganche pagado
    const beneficiarioActualizado = await Beneficiario.findByIdAndUpdate(
      id,
      {
        enganche_pagado: {
          valor: parseFloat(valor),
          moneda
        }
      },
      { new: true, runValidators: true }
    );
    
    res.json({
      mensaje: 'Monto inicial actualizado correctamente',
      enganche_pagado: beneficiarioActualizado.enganche_pagado
    });
  } catch (error) {
    console.error('Error al actualizar monto inicial:', error);
    res.status(500).json({
      mensaje: 'Error al actualizar monto inicial',
      error: error.message
    });
  }
});

// Obtener imagen de perfil
router.get('/imagen/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero buscar como Aliado
    let perfil = await Aliado.findById(id);
    let tipo = 'aliado';
    
    // Si no es aliado, buscar como Beneficiario
    if (!perfil) {
      perfil = await Beneficiario.findById(id);
      tipo = 'beneficiario';
    }

    if (!perfil) {
      return res.status(404).json({ 
        mensaje: 'Perfil no encontrado',
        foto: '/perfil1.jpg'
      });
    }

    // Devolver la URL de la foto o una imagen por defecto
    res.json({
      _id: id,
      tipo: tipo,
      foto: perfil.foto || '/perfil1.jpg'
    });
  } catch (error) {
    console.error('Error al obtener imagen de perfil:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener imagen de perfil',
      foto: '/perfil1.jpg'
    });
  }
});
// Modificación de la ruta PUT /:id en perfilRoutes.js para manejar los nuevos campos
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('PUT /perfil/', id, 'Datos recibidos:', updateData);
    
    // Verificar si es aliado
    let perfil = await Aliado.findById(id);
    let model = Aliado;
    let tipo = 'aliado';
    
    // Si no es aliado, verificar si es beneficiario
    if (!perfil) {
      perfil = await Beneficiario.findById(id);
      model = Beneficiario;
      tipo = 'beneficiario';
    }

    if (!perfil) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Preparamos los campos a actualizar
    const updateFields = {
      telefono: updateData.telefono,
      correo: updateData.correo,
      departamento: updateData.departamento,
      descripcion: updateData.descripcion,
      foto: updateData.foto,
      fin_contrato: updateData.fin_contrato,
      portada: updateData.portada
    };
    
    // Añadir campos adicionales solo para beneficiarios
    if (tipo === 'beneficiario') {
      // Campos originales
      if (updateData.nacionalidad !== undefined) updateFields.nacionalidad = updateData.nacionalidad;
      if (updateData.direccion !== undefined) updateFields.direccion = updateData.direccion;
      if (updateData.hotel_aliado !== undefined) updateFields.hotel_aliado = updateData.hotel_aliado;
      if (updateData.aliado_sucursal !== undefined) updateFields.aliado_sucursal = updateData.aliado_sucursal;
      
      // Añadir nuevos campos a la actualización
      if (updateData.pais !== undefined) updateFields.pais = updateData.pais;
      if (updateData.estado_provincia !== undefined) updateFields.estado_provincia = updateData.estado_provincia;
      if (updateData.ciudad !== undefined) updateFields.ciudad = updateData.ciudad;
      
      // El campo fecha_nacimiento debería ser actualizado solo si es proporcionado
      if (updateData.fecha_nacimiento !== undefined) updateFields.fecha_nacimiento = updateData.fecha_nacimiento;
      
      // Campos existentes que siempre deben ser manejados
      if (updateData.apellido !== undefined) updateFields.apellido = updateData.apellido;
      if (updateData.genero !== undefined) updateFields.genero = updateData.genero;
      if (updateData.estado_civil !== undefined) updateFields.estado_civil = updateData.estado_civil;
      
      // No permitimos actualizar estos campos directamente desde esta ruta
      // estado_id - tiene su propia ruta
      // fecha_creacion - no editable
      // enganche_pagado - debería tener su propia lógica de negocio
    }
    
    // Log para depuración
    console.log('Campos a actualizar:', updateFields);
    
    // Actualizar datos del perfil
    let updatedPerfil = await model.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { 
        new: true,
        runValidators: true
      }
    );
    
    // Verificar actualización
    console.log('Perfil actualizado:', {
      id: updatedPerfil._id,
      // Verificar nuevos campos
      pais: updatedPerfil.pais || 'no definido',
      estado_provincia: updatedPerfil.estado_provincia || 'no definido',
      ciudad: updatedPerfil.ciudad || 'no definido'
    });
    
    // Poblar el usuario_id
    updatedPerfil = await updatedPerfil.populate('usuario_id', 'nombre_usuario correo tipo');
    
    // Poblar datos según el tipo de perfil
    if (tipo === 'aliado') {
      // Solo poblar sucursales si es un aliado
      updatedPerfil = await updatedPerfil.populate({
        path: 'sucursales',
        match: { activo: true },
        select: 'nombre direccion telefono correo'
      });
    } else if (tipo === 'beneficiario') {
      // Poblar estado para beneficiarios
      updatedPerfil = await updatedPerfil.populate('estado_id', 'nombre');
    }

    // Actualizar correo en el modelo Usuario si se proporciona
    if (updateData.correo && perfil.usuario_id) {
      await Usuario.findByIdAndUpdate(
        perfil.usuario_id,
        { correo: updateData.correo }
      );
    }

    const responseData = {
      _id: updatedPerfil._id,
      nombre_usuario: updatedPerfil.nombre || updatedPerfil.usuario_id?.nombre_usuario,
      correo: updatedPerfil.usuario_id?.correo,
      tipo: tipo,
      telefono: updatedPerfil.telefono || '',
      inicio_contrato: updatedPerfil.inicio_contrato,
      fin_contrato: updatedPerfil.fin_contrato,
      departamento: updatedPerfil.departamento || '',
      foto: updatedPerfil.foto || '',
      portada: updatedPerfil.portada || '',
      descripcion: updatedPerfil.descripcion || '',
      sucursales: tipo === 'aliado' ? (updatedPerfil.sucursales || []) : [],
      
      // Campos adicionales para beneficiarios
      nacionalidad: tipo === 'beneficiario' ? (updatedPerfil.nacionalidad || '') : '',
      direccion: tipo === 'beneficiario' ? (updatedPerfil.direccion || '') : '',
      hotel_aliado: tipo === 'beneficiario' ? (updatedPerfil.hotel_aliado || '') : '',
      aliado_sucursal: tipo === 'beneficiario' ? (updatedPerfil.aliado_sucursal || '') : '',
      fecha_creacion: updatedPerfil.fecha_creacion || new Date(),
      estado_id: tipo === 'beneficiario' ? updatedPerfil.estado_id : null,
      estado: tipo === 'beneficiario' && updatedPerfil.estado_id ? (updatedPerfil.estado_id.nombre || 'No asignado') : '',
      enganche_pagado: tipo === 'beneficiario' ? (updatedPerfil.enganche_pagado || { valor: 0, moneda: 'reales' }) : { valor: 0, moneda: 'reales' },
      servicios: Array.isArray(updatedPerfil.servicios) ? updatedPerfil.servicios.map(id => String(id)) : [],
      
      // Agregar los nuevos campos en la respuesta
      apellido: tipo === 'beneficiario' ? (updatedPerfil.apellido || '') : '',
      genero: tipo === 'beneficiario' ? (updatedPerfil.genero || 'prefiero no decirlo') : '',
      estado_civil: tipo === 'beneficiario' ? (updatedPerfil.estado_civil || 'no especificado') : '',
      fecha_nacimiento: tipo === 'beneficiario' ? updatedPerfil.fecha_nacimiento || null : null,
      pais: tipo === 'beneficiario' ? (updatedPerfil.pais || '') : '',
      estado_provincia: tipo === 'beneficiario' ? (updatedPerfil.estado_provincia || '') : '',
      ciudad: tipo === 'beneficiario' ? (updatedPerfil.ciudad || '') : ''
    };

    // Log para verificar campos antes de enviar respuesta
    console.log('Enviando respuesta con campos de ubicación:', {
      pais: responseData.pais || 'no definido',
      estado_provincia: responseData.estado_provincia || 'no definido',
      ciudad: responseData.ciudad || 'no definido'
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil: ' + error.message });
  }
});
export default router;