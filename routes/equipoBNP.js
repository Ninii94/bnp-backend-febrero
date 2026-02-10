import express from 'express';
import mongoose from 'mongoose';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';
import {BeneficioBeneficiario} from '../models/BeneficioBeneficiario.js'
import { Usuario } from '../models/Usuario.js'; 
import { Estado } from '../models/Estado.js';
import { Sucursal } from '../models/Sucursal.js';
import CodigoService from '../services/CodigoService.js';
import { Documento } from '../models/Documentos.js';
import { checkAuth, isBeneficiario, isEquipoBNP, isAliado} from '../middleware/auth.js';
import { Servicio } from '../models/Servicio.js';
import { HistorialServicio } from '../models/HistorialServicio.js';


import multer from 'multer';

import cloudinary from '../config/cloudinary.js';
import fs from 'fs';
import path from 'path';
const router = express.Router();

// Obtener estado activo según el tipo
async function getEstadoActivo(tipo) {
  try {
    const estado = await Estado.findOne({ 
      tipo: tipo,
      codigo: 'ACTIVO'
    });
    return estado._id;
  } catch (error) {
    throw new Error(`Error al obtener estado activo para ${tipo}`);
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = 'uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});
const uploadImageFromBase64 = async (imageData, folder = 'beneficiarios/identificacion') => {
  console.log('[UPLOAD] === STARTING PHOTO UPLOAD DEBUG ===');
  console.log('[UPLOAD] Received imageData type:', typeof imageData);
  console.log('[UPLOAD] imageData keys:', imageData ? Object.keys(imageData) : 'null/undefined');
  
  try {
    if (!imageData) {
      console.log('[UPLOAD] ERROR: No image data provided');
      return null;
    }

    // Log the structure of imageData
    if (typeof imageData === 'object') {
      console.log('[UPLOAD] Object structure:', {
        hasPreview: !!imageData.preview,
        hasFile: !!imageData.file,
        hasNombre: !!imageData.nombre,
        hasTipo: !!imageData.tipo,
        previewLength: imageData.preview ? imageData.preview.length : 0,
        previewStart: imageData.preview ? imageData.preview.substring(0, 50) : 'none'
      });
    }

    let base64String = null;
    let fileName = 'imagen_identificacion';
    let mimeType = 'image/jpeg';

    // Handle object with preview (from DniSeccion component)
    if (typeof imageData === 'object' && imageData.preview) {
      console.log('[UPLOAD] Processing object with preview');
      base64String = imageData.preview;
      fileName = imageData.nombre || 'imagen_identificacion';
      mimeType = imageData.tipo || 'image/jpeg';
      console.log('[UPLOAD] Extracted:', { fileName, mimeType, base64Length: base64String.length });
    }
    // Handle direct base64 string
    else if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
      console.log('[UPLOAD] Processing direct base64 string');
      base64String = imageData;
      console.log('[UPLOAD] Direct base64 length:', base64String.length);
    }
    // Handle object with file property (backup)
    else if (typeof imageData === 'object' && imageData.file) {
      console.log('[UPLOAD] Processing object with file property');
      base64String = imageData.preview || imageData.file;
      fileName = imageData.nombre || 'imagen_identificacion';
      mimeType = imageData.tipo || 'image/jpeg';
      console.log('[UPLOAD] From file property:', { fileName, mimeType, base64Length: base64String?.length });
    }
    else {
      console.log('[UPLOAD] ERROR: Unsupported image data format');
      console.log('[UPLOAD] Available keys:', Object.keys(imageData || {}));
      console.log('[UPLOAD] Sample data structure:', JSON.stringify(imageData, null, 2));
      return null;
    }

    if (!base64String) {
      console.log('[UPLOAD] ERROR: No valid base64 string found after processing');
      return null;
    }

    // Validate base64 format
    if (!base64String.startsWith('data:image')) {
      console.log('[UPLOAD] ERROR: Invalid base64 format - missing data:image prefix');
      console.log('[UPLOAD] String starts with:', base64String.substring(0, 20));
      return null;
    }

    console.log('[UPLOAD] ✅ Base64 validation passed');
    console.log('[UPLOAD] About to upload to Cloudinary...');
    console.log('[UPLOAD] Folder:', folder);
    console.log('[UPLOAD] Base64 length:', base64String.length);

 cloudinary.config({
  cloud_name: 'dfw3ahzsp',    
  api_key: '774342666882821',           
  api_secret: 'QRBCJ7sqjUliV1w3bCFncbP2wEU',     
  secure: true
});

  const config = cloudinary.config();
console.log('[UPLOAD] Cloudinary config hardcodeado:', {
  cloud_name: config.cloud_name ? 'SET' : 'NOT SET',
  cloud_name_value: config.cloud_name,
  api_key: config.api_key ? 'SET' : 'NOT SET',
  api_key_length: config.api_key ? config.api_key.length : 0,
  api_secret: config.api_secret ? 'SET' : 'NOT SET',
  api_secret_length: config.api_secret ? config.api_secret.length : 0
});

if (!config.cloud_name || !config.api_key || !config.api_secret) {
  console.log('[UPLOAD] ERROR: Credenciales de Cloudinary no configuradas correctamente');
  console.log('[UPLOAD] Verifica que hayas reemplazado TU_CLOUD_NAME_AQUI, TU_API_KEY_AQUI, TU_API_SECRET_AQUI');
  throw new Error('Credenciales de Cloudinary hardcodeadas no configuradas');
}

   

    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
      transformation: [
        {
          width: 800,
          height: 600,
          crop: 'limit',
          quality: 'auto:good',
          format: 'jpg'
        }
      ]
    };

    console.log('[UPLOAD] Upload options:', uploadOptions);

   
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(' timeout 30 sec');
        reject(new Error('Upload timeout'));
      }, 30000);

      cloudinary.uploader.upload(base64String, uploadOptions, (error, result) => {
        clearTimeout(timeout);
        
        if (error) {
          console.log('error llamando a cloudinary');
          console.log('detalles error:', {
            message: error.message,
            http_code: error.http_code,
            error_code: error.error?.code,
            error_message: error.error?.message
          });
          reject(error);
        } else if (!result) {
          console.log('ERROR: ');
          reject(new Error('No resultado Cloudinary'));
        } else {
          console.log(' ✅ Cloudinary callback');
          console.log(' preview:', {
            secure_url: result.secure_url,
            public_id: result.public_id,
            bytes: result.bytes,
            format: result.format
          });
          resolve(result);
        }
      });
    });

    console.log('[subido] ✅ ');
    console.log('[subido ] :', result.secure_url);
    console.log('[subido] :', result.public_id);

    const returnData = {
      nombre: fileName,
      ruta: result.secure_url,
      tipo: mimeType,
      tamaño: imageData.tamaño || null,
      fecha_subida: new Date(),
      public_id: result.public_id
    };

    console.log('[UPLOAD] ✅ Returning data:', returnData);
    console.log('[UPLOAD] === PHOTO UPLOAD DEBUG COMPLETE ===');

    return returnData;

  } catch (error) {
    console.log('[UPLOAD] === CRITICAL ERROR IN PHOTO UPLOAD ===');
    console.error('[UPLOAD] Error type:', error.constructor.name);
    console.error('[UPLOAD] Error message:', error.message);
    console.error('[UPLOAD] Error stack:', error.stack);
   
    if (error.error) {
      console.error('[UPLOAD] Cloudinary nested error:', error.error);
    }
    
    if (error.http_code) {
      console.error('[UPLOAD] HTTP status code:', error.http_code);
    }

 
    console.log('[UPLOAD] === ERROR CONTEXT ===');
    console.log('[UPLOAD] Image data received:', !!imageData);
    console.log('[UPLOAD] Cloudinary config exists:', !!cloudinary.config().cloud_name);
    console.log('[UPLOAD] === END ERROR DEBUG ===');
 
    return null;
  }
};
const registrarServiciosAsignados = async (
  usuarioId,
  serviciosIds,
  usuarioEjecutor
) => {
  try {
    if (!serviciosIds || serviciosIds.length === 0) return { count: 0, details: [] };

    const serviciosInfo = await Servicio.find({ _id: { $in: serviciosIds } });
    const fechaAsignacion = new Date();
    
    // Buscar el beneficiario por usuario_id
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    if (!beneficiario) {
      throw new Error('Beneficiario no encontrado');
    }
    
    console.log(`✅ Beneficiario encontrado: ${beneficiario._id} para usuario: ${usuarioId}`);
    
    // CREAR REGISTROS EN BeneficioBeneficiario con pendiente_activacion
    const beneficiosParaCrear = serviciosInfo.map((servicio) => ({
      beneficiarioId: beneficiario._id,
      servicioId: servicio._id,
      servicioNombre: servicio.nombre,
      estado: 'pendiente_activacion',
      creado_por: usuarioId
    }));
    
    const beneficiosCreados = await BeneficioBeneficiario.insertMany(beneficiosParaCrear);
    console.log(`✅ Creados ${beneficiosCreados.length} registros en BeneficioBeneficiario como PENDIENTE_ACTIVACION`);
    
    // TAMBIÉN crear en HistorialServicio
    const entradasHistorial = serviciosInfo.map((servicio) => ({
      usuarioId,
      servicioId: servicio._id,
      servicioNombre: servicio.nombre,
      accion: 'pendiente_activacion',
      fecha_asignacion: fechaAsignacion,
      fecha_activacion: null,
      fecha: fechaAsignacion,
      estado_actual: 'pendiente_activacion',
      tipo_usuario: 'beneficiario',
      usuario: usuarioEjecutor,
      notas: 'Servicio asignado durante la creación del beneficiario. Pendiente de activación.'
    }));

    const resultados = await HistorialServicio.insertMany(entradasHistorial);
    
    console.log(
      `✅ Servicios asignados como PENDIENTE DE ACTIVACIÓN: ${serviciosIds.length} servicios para beneficiario ${usuarioId}`
    );
    
    return {
      count: serviciosIds.length,
      details: serviciosInfo.map(s => s.nombre),
      beneficiosCreados: beneficiosCreados.length,
      registros: resultados
    };
  } catch (error) {
    console.error("Error registrando servicios asignados:", error);
    throw error;
  }
};
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Validar tipo de archivo (solo imágenes)
    if (!file.mimetype.match(/^image\/(jpeg|png|jpg|gif)$/)) {
      return cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'), false);
    }
    cb(null, true);
  }
});
router.get('/estados/publico', async (req, res) => {
  try {
    console.log('[equipoBNP] Obteniendo todos los estados (público)...');
    
    const estados = await Estado.find().lean();
    
    console.log(`[equipoBNP] Estados encontrados: ${estados.length}`);
    
    res.json(estados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener estados:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estados',
      error: error.message 
    });
  }
});

router.post('/aliados', async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      correo,
      direccion,
      inicio_contrato,
      fin_contrato,
      usuario,
      estado_id,
      sucursal_id,
      razon_social,
      ruc,
      tipo_servicio,
      colaborador_bnp
    } = req.body;

    console.log('Datos recibidos para crear aliado:', {
      nombre,
      telefono,
      correo,
      direccion,
      tipo_servicio,
      razon_social,
      ruc,
      colaborador_bnp
    });

    const nuevoUsuario = new Usuario({
      nombre_usuario: usuario.nombre_usuario,
      contrasena: usuario.contrasena,
      correo: usuario.correo,
      tipo: usuario.tipo
    });

    await nuevoUsuario.save();

    const sucursales = [];
    if (sucursal_id) {
      const sucursal = await Sucursal.findById(sucursal_id);
      if (sucursal) {
        sucursales.push(sucursal_id);
      }
    }

    let serviciosValidados = [];
    if (Array.isArray(tipo_servicio)) {
      const serviciosExistentes = await Servicio.find({
        _id: { $in: tipo_servicio }
      });
      
      serviciosValidados = serviciosExistentes.map(s => s._id);
      
      console.log('Servicios validados:', serviciosValidados);
    }

    const nuevoAliado = new Aliado({
      nombre,
      telefono,
      correo,
      direccion,
      estado_id: estado_id || null,
      inicio_contrato,
      fin_contrato,
      usuario_id: nuevoUsuario._id,
      sucursales,
      razon_social: razon_social || null,
      ruc: ruc || null,
      tipo_servicio: serviciosValidados,
      colaborador_bnp: colaborador_bnp || null,
      servicios: serviciosValidados,
      historialEstados: estado_id ? [{
        estado_id,
        motivo: 'Creación inicial del aliado'
      }] : []
    });

    await nuevoAliado.save();

    if (serviciosValidados.length > 0) {
      const entriesForHistory = [];
      
      for (const servicioId of serviciosValidados) {
        const servicioDoc = await Servicio.findById(servicioId);
        
       entriesForHistory.push({
  usuarioId: nuevoUsuario._id,
  servicioId,
  servicioNombre: servicioDoc ? servicioDoc.nombre : null,
  accion: 'activado',
  estado_actual: 'activo',         
  tipo_usuario: 'aliado',            
  fecha: new Date(),
  fecha_activacion: new Date(),      
  usuario: 'Sistema - Creación de aliado',
  notas: `Servicio ${servicioDoc?.nombre || 'desconocido'} activado durante creación de aliado` 
});
      }
      
      if (entriesForHistory.length > 0) {
        await HistorialServicio.insertMany(entriesForHistory);
        console.log(`Se registraron ${entriesForHistory.length} servicios en el historial`);
      }
    }

    res.status(201).json({ 
      mensaje: 'Aliado creado exitosamente',
      servicios_asignados: serviciosValidados.length
    });
  } catch (error) {
    console.error('Error al crear aliado:', error);
    res.status(500).json({ error: 'Error al crear aliado: ' + error.message });
  }
});

router.post('/beneficiarios', async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      genero,
      estado_civil,
      telefono,
      nacionalidad,
      direccion,
      fecha_nacimiento,
      pais,
      estado_provincia,
      ciudad,
      idioma_preferencia,
      foto_identificacion_beneficiario,
      foto_identificacion_pareja,
      sucursal,
      aliado_id, 
      hotel_aliado,
      aliado_sucursal,
      enganche_pagado,
      moneda_enganche,
      pareja,
      usuario,
      estado_id,
      servicios, 
      membresia,
      vigencia_membresia_anos,
      director,
      gerente,
      cerrador,
      colaborador_bnp,
      departamento,
      fecha_registro,
      monto_venta
    } = req.body;
     console.log('=== BENEFICIARIO CREATION STARTING ===');
    console.log('Photo data received:');
    console.log('- foto_identificacion_beneficiario present:', !!foto_identificacion_beneficiario);
    console.log('- foto_identificacion_pareja present:', !!foto_identificacion_pareja);
    
    if (foto_identificacion_beneficiario) {
      console.log('- beneficiario photo type:', typeof foto_identificacion_beneficiario);
      console.log('- beneficiario photo keys:', Object.keys(foto_identificacion_beneficiario || {}));
    }
    
    if (foto_identificacion_pareja) {
      console.log('- pareja photo type:', typeof foto_identificacion_pareja);
      console.log('- pareja photo keys:', Object.keys(foto_identificacion_pareja || {}));
    }

    console.log('Datos recibidos para crear beneficiario:', {
      nombre,
      apellido,
      correo: usuario?.correo,
      servicios_count: servicios?.length || 0,
      tiene_membresia: !!membresia,
      foto_beneficiario: !!foto_identificacion_beneficiario,
      foto_pareja: !!foto_identificacion_pareja
    });
    
    // Crear el usuario primero
    const nuevoUsuario = new Usuario({
      nombre_usuario: usuario.nombre_usuario,
      contrasena: usuario.contrasena,
      telefono: telefono,
      correo: usuario.correo,
      tipo: usuario.tipo
    });

    await nuevoUsuario.save();
    console.log('Usuario creado exitosamente:', nuevoUsuario._id);

    // FIXED: Declare variables at the beginning with null initialization
    let fotoBeneficiarioSubida = null;
    let fotoParejaSubida = null;

    // Process photos if they exist
    try {
      if (foto_identificacion_beneficiario) {
        console.log('[FOTOS] Procesando foto del beneficiario...');
        console.log('[FOTOS] Tipo de dato:', typeof foto_identificacion_beneficiario);
        console.log('[FOTOS] Tiene preview:', !!foto_identificacion_beneficiario.preview);
        
        fotoBeneficiarioSubida = await uploadImageFromBase64(
          foto_identificacion_beneficiario, 
          'beneficiarios/identificacion'
        );
        
        if (fotoBeneficiarioSubida) {
          console.log('[FOTOS] Foto beneficiario subida exitosamente:', fotoBeneficiarioSubida.ruta);
        } else {
          console.log('[FOTOS] No se pudo procesar la foto del beneficiario');
        }
      }

      if (foto_identificacion_pareja) {
        console.log('[FOTOS] Procesando foto de la pareja...');
        console.log('[FOTOS] Tipo de dato:', typeof foto_identificacion_pareja);
        console.log('[FOTOS] Tiene preview:', !!foto_identificacion_pareja.preview);
        
        fotoParejaSubida = await uploadImageFromBase64(
          foto_identificacion_pareja, 
          'beneficiarios/parejas'
        );
        
        if (fotoParejaSubida) {
          console.log('[FOTOS] Foto pareja subida exitosamente:', fotoParejaSubida.ruta);
        } else {
          console.log('[FOTOS] No se pudo procesar la foto de la pareja');
        }
      }
    } catch (fotoError) {
      console.error('[FOTOS] Error procesando fotos:', fotoError.message);
      // Continue without photos - don't break the creation process
      fotoBeneficiarioSubida = null;
      fotoParejaSubida = null;
    }

    // Validar servicios si se proporcionan
    let serviciosValidados = [];
    if (servicios && Array.isArray(servicios) && servicios.length > 0) {
      try {
        const serviciosExistentes = await Servicio.find({
          _id: { $in: servicios },
          $or: [{ tipoUsuario: "beneficiario" }, { tipoUsuario: "ambos" }],
        });

        serviciosValidados = serviciosExistentes.map((s) => s._id);
        console.log(
          `Servicios validados para beneficiario: ${serviciosValidados.length} de ${servicios.length} solicitados`
        );
      } catch (error) {
        console.error("Error validando servicios:", error);
        return res.status(400).json({
          error: "Error al validar los servicios seleccionados",
        });
      }
    }

    // Procesar enganche pagado
    let enganchePagadoObj;
    if (enganche_pagado) {
      if (typeof enganche_pagado === 'object' && 'valor' in enganche_pagado && 'moneda' in enganche_pagado) {
        enganchePagadoObj = enganche_pagado;
      } 
      else if (typeof enganche_pagado === 'number' || typeof enganche_pagado === 'string') {
        enganchePagadoObj = {
          valor: parseFloat(enganche_pagado) || 0,
          moneda: moneda_enganche || 'USD'
        };
      }
      else {
        enganchePagadoObj = {
          valor: 0,
          moneda: 'USD'
        };
      }
    } else {
      enganchePagadoObj = {
        valor: 0,
        moneda: 'USD'
      };
    }
    
    const aliadoIdFinal = aliado_id || hotel_aliado || null;
    const sucursalFinal = sucursal || aliado_sucursal || null;
    
    // Verificar si el aliado_id existe
    let aliadoIdValidado = null;
    if (aliadoIdFinal) {
      try {
        const aliado = await Aliado.findById(aliadoIdFinal);
        if (aliado) {
          aliadoIdValidado = aliadoIdFinal;
          console.log(`Aliado encontrado: ${aliado.nombre}, ID: ${aliado._id}`);
        } else {
          console.log(`No se encontró un aliado con ID: ${aliadoIdFinal}`);
        }
      } catch (err) {
        console.error(`Error al buscar aliado: ${err.message}`);
      }
    }
    
    // Preparar datos de pareja
    let parejaObj = null;
    if (pareja && typeof pareja === 'object') {
      console.log('Procesando datos de pareja recibidos:', pareja);
      
      let nombre_pareja = '';
      let apellido_pareja = '';
      
      if (pareja.nombre_completo && pareja.nombre_completo.trim()) {
        const partesNombre = pareja.nombre_completo.trim().split(' ');
        nombre_pareja = partesNombre[0] || '';
        apellido_pareja = partesNombre.slice(1).join(' ') || '';
      } else if (pareja.nombre || pareja.apellido) {
        nombre_pareja = pareja.nombre || '';
        apellido_pareja = pareja.apellido || '';
      }
      
      if (nombre_pareja || pareja.telefono || pareja.correo) {
        parejaObj = {
          nombre: nombre_pareja,
          apellido: apellido_pareja,
          fecha_nacimiento: pareja.fecha_nacimiento || null,
          correo: pareja.correo || '',
          telefono: pareja.telefono || '',
          genero: pareja.genero || 'prefiero no decirlo',
          estado_civil: pareja.estado_civil || 'no especificado',
          nacionalidad: pareja.nacionalidad || '',
          documento_identidad: {
            tipo: pareja.documento_identidad?.tipo || '',
            numero: pareja.documento_identidad?.numero || ''
          }
        };
        console.log('Información de pareja procesada correctamente:', parejaObj);
      }
    }
    
    // Procesar membresía
    let membresiaObj = null;
    if (membresia && typeof membresia === 'object') {
      membresiaObj = {
        ...membresia,
        vigencia_anos: parseInt(vigencia_membresia_anos) || 1
      };
      console.log('Membresía procesada con vigencia:', membresiaObj.vigencia_anos, 'años');
    }
    
    // Crear beneficiario con fotos procesadas
    const nuevoBeneficiario = new Beneficiario({
      // Información básica
      nombre,
      apellido: apellido || '',
      genero: genero || 'prefiero no decirlo',
      estado_civil: estado_civil || 'no especificado',
      telefono,
      nacionalidad,
      direccion,
      
      // Campos de ubicación
      fecha_nacimiento: fecha_nacimiento || null,
      pais: pais || '',
      estado_provincia: estado_provincia || '',
      ciudad: ciudad || '',
      
      // Fotos procesadas
      foto_identificacion_beneficiario: fotoBeneficiarioSubida,
      foto_identificacion_pareja: fotoParejaSubida,
      
      // Configuración
      idioma_preferencia: idioma_preferencia || 'esp',
      
      // Membresía
      membresia: membresiaObj || {},
      vigencia_membresia_anos: parseInt(vigencia_membresia_anos) || 1,
      
      // Campos administrativos
      director: director || '',
      gerente: gerente || '',
      cerrador: cerrador || '',
      colaborador_bnp: colaborador_bnp || '',
      departamento: departamento || '',
      fecha_registro: fecha_registro ? new Date(fecha_registro) : new Date(),
      monto_venta: parseFloat(monto_venta) || 0,
      
      // Información de pareja
      pareja: parejaObj,
      
      // Relaciones
      estado_id: estado_id || null,
      sucursal: sucursalFinal, 
      aliado_id: aliadoIdValidado, 
      hotel_aliado: aliadoIdValidado,
      aliado_sucursal: sucursalFinal,
      enganche_pagado: enganchePagadoObj,
      usuario_id: nuevoUsuario._id,
      correo: usuario.correo,
      
      // Servicios asignados
      servicios: serviciosValidados,
      
      historialEstados: estado_id ? [{
        estado_id,
        motivo: 'Creación inicial del beneficiario',
        fecha: new Date()
      }] : [],
      codigo: {
        activo: false,
        fecha_activacion: null
      }
    });

    await nuevoBeneficiario.save();
    console.log('Beneficiario creado exitosamente:', nuevoBeneficiario._id);
    
    // LOG de verificación incluyendo fotos
    console.log('Verificación de campos guardados:', {
      director: nuevoBeneficiario.director,
      gerente: nuevoBeneficiario.gerente,
      foto_beneficiario_guardada: !!nuevoBeneficiario.foto_identificacion_beneficiario,
      foto_pareja_guardada: !!nuevoBeneficiario.foto_identificacion_pareja,
      foto_beneficiario_url: nuevoBeneficiario.foto_identificacion_beneficiario?.ruta || 'No subida',
      foto_pareja_url: nuevoBeneficiario.foto_identificacion_pareja?.ruta || 'No subida'
    });
    
    // Registrar servicios como ASIGNADOS
    let resultadoServicios = { count: 0, details: [] };
    if (serviciosValidados.length > 0) {
      try {
        resultadoServicios = await registrarServiciosAsignados(
          nuevoUsuario._id,
          serviciosValidados,
          'Sistema - Creación de beneficiario'
        );
        console.log('Servicios asignados como inactivos para beneficiario');
      } catch (error) {
        console.error('Error asignando servicios:', error);
      }
    }
    
    // Recuperar el beneficiario completo
    const beneficiarioCompleto = await Beneficiario.findById(nuevoBeneficiario._id)
      .populate('aliado_id', 'nombre')
      .populate('sucursal', 'nombre')
      .populate('estado_id', 'nombre')
      .populate('servicios', 'nombre descripcion');

    // Respuesta incluyendo información de fotos
    res.status(201).json({ 
      mensaje: 'Beneficiario creado exitosamente',
      beneficiario: {
        _id: beneficiarioCompleto._id,
        nombre: beneficiarioCompleto.nombre,
        apellido: beneficiarioCompleto.apellido,
        correo: beneficiarioCompleto.correo,
        telefono: beneficiarioCompleto.telefono,
        idioma_preferencia: beneficiarioCompleto.idioma_preferencia,
        vigencia_membresia_anos: beneficiarioCompleto.vigencia_membresia_anos,
        director: beneficiarioCompleto.director,
        gerente: beneficiarioCompleto.gerente,
        cerrador: beneficiarioCompleto.cerrador,
        colaborador_bnp: beneficiarioCompleto.colaborador_bnp,
        departamento: beneficiarioCompleto.departamento,
        membresia: beneficiarioCompleto.membresia,
        servicios: beneficiarioCompleto.servicios?.map(s => s.nombre) || [],
        servicios_count: beneficiarioCompleto.servicios?.length || 0,
        // Información de fotos en la respuesta
        fotos: {
          beneficiario: fotoBeneficiarioSubida ? 'SUBIDA' : 'NO_SUBIDA',
          pareja: fotoParejaSubida ? 'SUBIDA' : 'NO_SUBIDA',
          urls: {
            beneficiario: fotoBeneficiarioSubida?.ruta || null,
            pareja: fotoParejaSubida?.ruta || null
          }
        }
      },
      codigo: beneficiarioCompleto.llave_unica || beneficiarioCompleto.codigo?.value || 'N/A',
      aliado: beneficiarioCompleto.aliado_id ? {
        id: beneficiarioCompleto.aliado_id._id,
        nombre: beneficiarioCompleto.aliado_id.nombre
      } : null,
      pareja: beneficiarioCompleto.pareja,
      servicios_asignados: resultadoServicios.count,
      servicios_detalles: resultadoServicios.details
    });

     console.log('=== FINAL VERIFICATION ===');
    console.log('Photo processing summary:', {
      beneficiario_processed: !!fotoBeneficiarioSubida,
      pareja_processed: !!fotoParejaSubida,
      beneficiario_url: fotoBeneficiarioSubida?.ruta || 'None',
      pareja_url: fotoParejaSubida?.ruta || 'None'
    });
  } catch (error) {
    console.error('Error al crear beneficiario:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Error de validación: ' + Object.values(error.errors).map(e => e.message).join(', ') 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Error: Ya existe un beneficiario con ese código'
      });
    }
    
    res.status(500).json({ error: 'Error al crear beneficiario: ' + error.message });
  }
});
router.post('/aliados/:id/foto', checkAuth, isEquipoBNP, upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si se envió un archivo
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No se ha proporcionado ninguna imagen'
      });
    }
    
    // Buscar el aliado
    const aliado = await Aliado.findById(id);
    if (!aliado) {
      // Eliminar archivo temporal
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
      
      return res.status(404).json({ 
        message: 'Aliado no encontrado'
      });
    }
    
    // Subir imagen a Cloudinary
    console.log('Subiendo imagen a Cloudinary:', req.file.path);
    
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'aliados',
        public_id: `aliado-${id}`,
        overwrite: true,
        resource_type: 'image'
      });
      
      console.log('Imagen subida con éxito:', result.secure_url);
      
      // Actualizar la URL de la foto en el aliado
      aliado.foto = result.secure_url;
      await aliado.save();
      
      // Eliminar archivo temporal
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
      
      return res.status(200).json({
        message: 'Foto actualizada correctamente',
        fotoUrl: result.secure_url
      });
      
    } catch (cloudinaryError) {
      console.error('Error en Cloudinary:', cloudinaryError);
      
      // Eliminar archivo temporal en caso de error
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
      
      return res.status(500).json({
        message: 'Error al subir la imagen a Cloudinary',
        error: cloudinaryError.message
      });
    }
    
  } catch (error) {
    console.error('Error al actualizar foto del aliado:', error);
    
    // Intentar eliminar archivo temporal si existe
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
    }
    
    res.status(500).json({
      message: 'Error al procesar la solicitud',
      error: error.message
    });
  }
});
// actualizar el perfil de un usuario (Equipo BNP)
router.put('/perfil/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const datosActualizacion = req.body;
    
    console.log(`[PUT /perfil/${id}] Datos recibidos para actualización:`, datosActualizacion);
    
    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron datos para actualizar'
      });
    }
    
    let beneficiario = await Beneficiario.findById(id);
    
    if (!beneficiario) {
      console.log(`[PUT /perfil/${id}] Error: No se encontró beneficiario con este ID`);
      return res.status(404).json({
        success: false,
        message: 'Beneficiario no encontrado'
      });
    }
    
    // Lista COMPLETA de campos que podemos actualizar (incluyendo vigencia_membresia_anos)
    const camposPermitidos = [
      // Información básica
      'nombre', 'apellido', 'telefono', 'correo',
      
      // Información personal
      'genero', 'estado_civil', 'nacionalidad', 'fecha_nacimiento',
      
      // Ubicación
      'pais', 'estado_provincia', 'ciudad', 'direccion',
      
      // Información administrativa
      'departamento', 'director', 'gerente', 'cerrador', 'colaborador_bnp',
      'idioma_preferencia', 'fecha_registro', 'monto_venta',
      'vigencia_membresia_anos', // NUEVO CAMPO AGREGADO
      
      // Relaciones
      'aliado_id', 'sucursal', 'hotel_aliado', 'aliado_sucursal',
      
      // Imágenes
      'foto', 'portada', 'descripcion',
      
      // Información financiera (solo ciertos campos)
      'enganche_pagado'
    ];
    
    let actualizado = false;
    const cambios = {};
    
    // Procesar cada campo
    for (const campo of camposPermitidos) {
      if (datosActualizacion[campo] !== undefined) {
        
        // Validaciones específicas
        if (campo === 'estado_civil') {
          const estadosCivilValidos = ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado'];
          if (!estadosCivilValidos.includes(datosActualizacion[campo])) {
            return res.status(400).json({
              success: false,
              message: `Valor para estado_civil no válido. Debe ser uno de: ${estadosCivilValidos.join(', ')}`
            });
          }
        }
        
        if (campo === 'genero') {
          const generosValidos = ['masculino', 'femenino', 'prefiero no decirlo'];
          if (!generosValidos.includes(datosActualizacion[campo])) {
            return res.status(400).json({
              success: false,
              message: `Valor para genero no válido. Debe ser uno de: ${generosValidos.join(', ')}`
            });
          }
        }

        if (campo === 'idioma_preferencia') {
          const idiomasValidos = ['esp', 'por', 'ing'];
          if (!idiomasValidos.includes(datosActualizacion[campo])) {
            return res.status(400).json({
              success: false,
              message: `Valor para idioma_preferencia no válido. Debe ser uno de: ${idiomasValidos.join(', ')}`
            });
          }
        }

        // NUEVA VALIDACIÓN: Vigencia de membresía
        if (campo === 'vigencia_membresia_anos') {
          const vigenciaNumerico = parseInt(datosActualizacion[campo]);
          if (isNaN(vigenciaNumerico) || vigenciaNumerico < 1 || vigenciaNumerico > 99) {
            return res.status(400).json({
              success: false,
              message: 'La vigencia de membresía debe ser un número entre 1 y 99 años'
            });
          }
          beneficiario[campo] = vigenciaNumerico;
          
          // Sincronizar con membresía si existe
          if (beneficiario.membresia) {
            if (!beneficiario.membresia) {
              beneficiario.membresia = {};
            }
            beneficiario.membresia.vigencia_anos = vigenciaNumerico;
          }
          
          cambios[campo] = vigenciaNumerico;
          actualizado = true;
          continue; // Continuar con el siguiente campo
        }

        // Procesar campos especiales
        if (campo === 'fecha_nacimiento' || campo === 'fecha_registro') {
          beneficiario[campo] = datosActualizacion[campo] ? new Date(datosActualizacion[campo]) : null;
        } else if (campo === 'monto_venta') {
          beneficiario[campo] = parseFloat(datosActualizacion[campo]) || 0;
        } else if (campo === 'enganche_pagado') {
          // Manejar objeto de enganche pagado
          if (typeof datosActualizacion[campo] === 'object' && datosActualizacion[campo] !== null) {
            beneficiario[campo] = datosActualizacion[campo];
          }
        } else {
          // Campo normal
          beneficiario[campo] = datosActualizacion[campo];
        }
        
        cambios[campo] = datosActualizacion[campo];
        actualizado = true;
        
        // Sincronización de campos relacionados
        if (campo === 'aliado_id') {
          beneficiario.hotel_aliado = datosActualizacion[campo];
        } else if (campo === 'hotel_aliado') {
          beneficiario.aliado_id = datosActualizacion[campo];
        }
        
        if (campo === 'sucursal') {
          beneficiario.aliado_sucursal = datosActualizacion[campo];
        } else if (campo === 'aliado_sucursal') {
          beneficiario.sucursal = datosActualizacion[campo];
        }
      }
    }

    // Manejar campos anidados (membresía)
    if (datosActualizacion.membresia) {
      if (!beneficiario.membresia) {
        beneficiario.membresia = {};
      }
      
      Object.keys(datosActualizacion.membresia).forEach(key => {
        beneficiario.membresia[key] = datosActualizacion.membresia[key];
        actualizado = true;
      });
      
      // Si se actualiza vigencia_anos en membresía, sincronizar con campo principal
      if (datosActualizacion.membresia.vigencia_anos) {
        const vigencia = parseInt(datosActualizacion.membresia.vigencia_anos);
        if (vigencia >= 1 && vigencia <= 99) {
          beneficiario.vigencia_membresia_anos = vigencia;
        }
      }
    }

    // Procesar campos de membresía con notación de punto
 Object.keys(datosActualizacion).forEach(key => {
  if (key.startsWith('membresia.')) {
    if (!beneficiario.membresia) {
      beneficiario.membresia = {};
    }
    const subCampo = key.replace('membresia.', '');
    beneficiario.membresia[subCampo] = datosActualizacion[key];
    
    // SPECIAL CASE: Handle liquidation status
    if (subCampo === 'estado_liquidacion') {
      const estadoLiquidacion = datosActualizacion[key];
      beneficiario.membresia.liquidada = (estadoLiquidacion === 'liquidada' || estadoLiquidacion === 'liquidada_parcial');
      console.log(`[PERFIL] Actualizando liquidación: estado=${estadoLiquidacion}, liquidada=${beneficiario.membresia.liquidada}`);
    }
    
    actualizado = true;
    
    // Sincronizar vigencia si se actualiza por notación de punto
    if (subCampo === 'vigencia_anos') {
      const vigencia = parseInt(datosActualizacion[key]);
      if (vigencia >= 1 && vigencia <= 99) {
        beneficiario.vigencia_membresia_anos = vigencia;
      }
    }
  }
});
    
    // Actualizar 
    if (datosActualizacion.correo && beneficiario.usuario_id) {
      try {
        const usuario = await Usuario.findById(beneficiario.usuario_id);
        if (usuario) {
          usuario.correo = datosActualizacion.correo;
          await usuario.save();
          console.log(`[PUT /perfil/${id}] Correo actualizado también en usuario ${usuario._id}`);
        }
      } catch (err) {
        console.error(`[PUT /perfil/${id}] Error al actualizar correo en usuario:`, err);
      }
    }
    
    if (actualizado) {
      console.log(`[PUT /perfil/${id}] Guardando cambios...`, cambios);
      
      await beneficiario.save();
      
      console.log(`[PUT /perfil/${id}] Cambios guardados exitosamente`);
      
      // Obtener 
      const beneficiarioActualizado = await Beneficiario.findById(id)
        .populate('estado_id', 'nombre')
        .populate('sucursal', 'nombre correo telefono')
        .populate('aliado_id', 'nombre telefono correo')
        .populate('usuario_id', 'nombre_usuario correo tipo');
      
      res.json({
        success: true,
        message: 'Perfil actualizado correctamente',
        data: beneficiarioActualizado,
        cambios_realizados: cambios
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'No se realizaron cambios en el perfil'
      });
    }
  } catch (error) {
    console.error(`[PUT /perfil/${id}] Error al actualizar perfil:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
});

router.put('/api/perfil/:id/estado-civil', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_civil } = req.body;
    
    console.log(`[PUT /api/perfil/${id}/estado-civil] Actualizando estado civil a: ${estado_civil}`);
    
    // Validación explícita del valor
    const estadosCivilValidos = ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado'];
    if (!estado_civil || !estadosCivilValidos.includes(estado_civil)) {
      console.log(`[PUT /api/perfil/${id}/estado-civil] Error: Valor inválido para estado_civil: ${estado_civil}`);
      return res.status(400).json({
        success: false,
        message: `Valor para estado_civil no válido. Debe ser uno de: ${estadosCivilValidos.join(', ')}`
      });
    }
    
    // Buscar beneficiario
    const beneficiario = await Beneficiario.findById(id);
    if (!beneficiario) {
      console.log(`[PUT /api/perfil/${id}/estado-civil] Error: Beneficiario no encontrado`);
      return res.status(404).json({
        success: false,
        message: 'Beneficiario no encontrado'
      });
    }
    
    console.log(`[PUT /api/perfil/${id}/estado-civil] Beneficiario encontrado. Valor actual: ${beneficiario.estado_civil}`);
    

    beneficiario.estado_civil = estado_civil;
    
  
    await beneficiario.save();
    
    console.log(`[PUT /api/perfil/${id}/estado-civil] Cambios guardados correctamente. Nuevo valor: ${beneficiario.estado_civil}`);
  
    const beneficiarioActualizado = await Beneficiario.findById(id);
    console.log(`[PUT /api/perfil/${id}/estado-civil] Verificación - Valor en DB: ${beneficiarioActualizado.estado_civil}`);
    
  
    return res.json({
      success: true,
      message: 'Estado civil actualizado correctamente',
      estado_civil: beneficiarioActualizado.estado_civil
    });
  } catch (error) {
    console.error(`[PUT /api/perfil/${id}/estado-civil] Error:`, error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado civil',
      error: error.message
    });
  }
});
// Obtener estados
router.get('/estados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[equipoBNP] Obteniendo todos los estados...');
    
    const estados = await Estado.find().lean();
    
    console.log(`[equipoBNP] Estados encontrados: ${estados.length}`);
    
    res.json(estados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener estados:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estados',
      error: error.message 
    });
  }
});
router.get('/estados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[equipoBNP] Obteniendo todos los estados (autenticado)...');
    
    const estados = await Estado.find().lean();
    
    console.log(`[equipoBNP] Estados encontrados: ${estados.length}`);
    
    res.json(estados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener estados:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estados',
      error: error.message 
    });
  }
});

// Obtener sucursales
router.get('/sucursales', async (req, res) => {
  try {
    const sucursales = await Sucursal.find();
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener sucursales:', error);
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});router.get('/sucursales/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 === DEBUG SUCURSAL ===');
    console.log('🔍 ID recibido:', id);
    console.log('🔍 Usuario autenticado:', req.usuario?.nombre_usuario);
    console.log('🔍 Tipo de usuario:', req.tipo);
    console.log('🔍 Headers:', req.headers.authorization ? 'Token presente' : 'Sin token');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ ID inválido:', id);
      return res.status(400).json({ mensaje: 'ID de sucursal inválido' });
    }

    console.log('✅ ID válido, buscando en BD...');
    const sucursal = await Sucursal.findById(id).lean();

    if (!sucursal) {
      console.log('❌ Sucursal no encontrada para ID:', id);
      
      // DEBUG: Ver qué sucursales existen
      const todasLasSucursales = await Sucursal.find({}).select('_id nombre').lean();
      console.log('📋 Sucursales en BD:', todasLasSucursales.map(s => ({ id: s._id, nombre: s.nombre })));
      
      return res.status(404).json({ mensaje: 'Sucursal no encontrada' });
    }

    console.log('✅ Sucursal encontrada:', sucursal.nombre);
    console.log('🔍 === FIN DEBUG SUCURSAL ===');
    
    res.json(sucursal);
  } catch (error) {
    console.error('❌ [equipoBNP] Error al obtener sucursal:', error);
    res.status(500).json({ 
      mensaje: 'Error interno del servidor',
      error: error.message 
    });
  }
});
router.get('/estados/tipo/:tipo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { tipo } = req.params;
    
    console.log(`[equipoBNP] Obteniendo estados de tipo: ${tipo}`);
    
    const estados = await Estado.find({ tipo: tipo.toUpperCase() }).lean();
    
    console.log(`[equipoBNP] Estados ${tipo} encontrados: ${estados.length}`);
    
    res.json(estados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener estados por tipo:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estados por tipo',
      error: error.message 
    });
  }
});
router.get('/estados/publico/tipo/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    console.log(`[equipoBNP] Obteniendo estados de tipo: ${tipo} (público)`);
    
    const estados = await Estado.find({ tipo: tipo.toUpperCase() }).lean();
    
    console.log(`[equipoBNP] Estados ${tipo} encontrados: ${estados.length}`);
    
    res.json(estados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener estados por tipo:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estados por tipo',
      error: error.message 
    });
  }
});
router.get('/sucursales/aliado/:aliadoId', async (req, res) => {
  try {
    const { aliadoId } = req.params;
    
    console.log('Buscando sucursales para aliado:', aliadoId);
    
    if (!mongoose.Types.ObjectId.isValid(aliadoId)) {
      return res.status(400).json({ mensaje: 'ID de aliado inválido' });
    }
    
    const sucursales = await Sucursal.find({ 
      aliado_id: aliadoId,
      activo: { $ne: false } // Incluir donde activo es true o no existe
    }).sort({ nombre: 1 });
    
    console.log(`Encontradas ${sucursales.length} sucursales para aliado ${aliadoId}`);
    
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener sucursales del aliado:', error);
    res.status(500).json({ 
      error: 'Error al obtener sucursales',
      mensaje: error.message 
    });
  }
});
router.get('/beneficiarios/:id/perfil-completo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[equipoBNP] === INICIANDO BÚSQUEDA PERFIL COMPLETO ===`);
    console.log(`[equipoBNP] ID recibido: ${id}`);
    console.log(`[equipoBNP] Tipo de ID: ${typeof id}`);
    console.log(`[equipoBNP] Es ObjectId válido: ${mongoose.Types.ObjectId.isValid(id)}`);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: 'ID de beneficiario inválido' });
    }

    // Búsqueda por usuario_id
    console.log(`[equipoBNP] Buscando por usuario_id...`);
    const beneficiario = await Beneficiario.findOne({ usuario_id: id })
      .populate('usuario_id', 'nombre_usuario correo')
      .populate('aliado_id', 'nombre telefono correo')
      .populate('sucursal', 'nombre correo telefono')
      .populate('estado_id', 'nombre')
      .lean();

    console.log(`[equipoBNP] Resultado de búsqueda:`, !!beneficiario);

    if (!beneficiario) {
      // Intentar búsqueda por _id como fallback
      console.log(`[equipoBNP] Intentando búsqueda por _id...`);
      const beneficiarioPorId = await Beneficiario.findById(id)
        .populate('usuario_id', 'nombre_usuario correo')
        .populate('aliado_id', 'nombre telefono correo')
        .populate('sucursal', 'nombre correo telefono')
        .populate('estado_id', 'nombre')
        .lean();

      if (!beneficiarioPorId) {
        console.log(`[equipoBNP] No se encontró beneficiario con ID: ${id}`);
        return res.status(404).json({ mensaje: 'Beneficiario no encontrado' });
      }
      
      // Usar el encontrado por _id
      const perfilCompleto = { ...beneficiarioPorId };
      return res.json(perfilCompleto);
    }

    console.log(`[equipoBNP] Beneficiario encontrado: ${beneficiario.nombre} ${beneficiario.apellido}`);

    // Transformar pareja
    let parejaTransformada = null;
    if (beneficiario.pareja) {
      parejaTransformada = {
        nombre_completo: `${beneficiario.pareja.nombre || ''} ${beneficiario.pareja.apellido || ''}`.trim() || '',
        telefono: beneficiario.pareja.telefono || '',
        correo: beneficiario.pareja.correo || '',
        nombre: beneficiario.pareja.nombre || '',
        apellido: beneficiario.pareja.apellido || '',
        fecha_nacimiento: beneficiario.pareja.fecha_nacimiento,
        genero: beneficiario.pareja.genero,
        estado_civil: beneficiario.pareja.estado_civil,
        nacionalidad: beneficiario.pareja.nacionalidad,
        documento_identidad: beneficiario.pareja.documento_identidad
      };
    }

    const perfilCompleto = {
      ...beneficiario,
      aliado_nombre: beneficiario.aliado_id?.nombre,
      aliado_telefono: beneficiario.aliado_id?.telefono,
      aliado_correo: beneficiario.aliado_id?.correo,
      sucursal_nombre: beneficiario.sucursal?.nombre,
      sucursal_correo: beneficiario.sucursal?.correo,
      sucursal_telefono: beneficiario.sucursal?.telefono,
      estado_nombre: beneficiario.estado_id?.nombre || 'Sin estado asignado',
      nombre_usuario: beneficiario.usuario_id?.nombre_usuario,
      correo: beneficiario.correo || beneficiario.usuario_id?.correo,
      membresia: {
        ...beneficiario.membresia,
        vigencia_anos: beneficiario.vigencia_membresia_anos || beneficiario.membresia?.vigencia_anos || 1
      },
      pareja: parejaTransformada
    };

    console.log(`[equipoBNP] Enviando perfil completo exitosamente`);
    res.json(perfilCompleto);
    
  } catch (error) {
    console.error('[equipoBNP] Error al obtener perfil completo:', error);
    res.status(500).json({ 
      mensaje: 'Error interno del servidor',
      error: error.message 
    });
  }
});
// Ruta para obtener documentos de un beneficiario específico (acceso desde equipoBNP)
router.get('/beneficiarios/:beneficiarioId/documentos', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    
    // Validar ID de beneficiario
    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({ 
        mensaje: 'ID de beneficiario inválido',
        error: 'El ID proporcionado no tiene un formato válido'
      });
    }
    
    console.log(`Obteniendo documentos para beneficiario: ${beneficiarioId}`);
    
    // Verificar si existe el beneficiario
    const beneficiario = await Beneficiario.findById(beneficiarioId);
    
    if (!beneficiario) {
      return res.status(404).json({ mensaje: 'Beneficiario no encontrado' });
    }
    
    // Buscar documentos en la nueva colección Documento
    let documentos = [];
    
    try {
      documentos = await Documento.find({ 
        beneficiario_id: beneficiarioId,
        activo: true
      }).sort({ actualizado_en: -1 });
      
      console.log(`Encontrados ${documentos.length} documentos del modelo Documento`);
    } catch (error) {
      console.error('Error al buscar en el modelo Documento:', error);
    }
    
    // Si no hay documentos en la nueva colección, buscar en la propiedad documentos_viaje del beneficiario
    if (documentos.length === 0 && beneficiario.documentos_viaje && Array.isArray(beneficiario.documentos_viaje)) {
      console.log('Usando documentos_viaje del modelo Beneficiario');
      documentos = beneficiario.documentos_viaje;
    }
    
    // Mapear los documentos para asegurar una estructura consistente
    const documentosFormateados = documentos.map(doc => {
      // Si el documento viene del modelo Documento
      if (doc.toObject) {
        const docObj = doc.toObject();
        return {
          id: docObj._id.toString(),
          tipo: docObj.tipo,
          nombre: docObj.nombre || '',
          numero: docObj.numero || '',
          fecha_emision: docObj.fecha_emision,
          fecha_vencimiento: docObj.fecha_vencimiento,
          pais: docObj.pais,
          archivo: docObj.archivo || null,
          creado_en: docObj.creado_en
        };
      }
      
      // Si el documento viene directamente del array documentos_viaje
      return {
        id: doc._id?.toString() || doc.id?.toString() || '',
        tipo: doc.tipo || 'Documento',
        nombre: doc.nombre || '',
        numero: doc.numero || '',
        fecha_emision: doc.fecha_emision,
        fecha_vencimiento: doc.fecha_vencimiento,
        pais: doc.pais || '',
        archivo: doc.archivo || null,
        creado_en: doc.fecha_creacion || doc.creado_en || new Date()
      };
    });
    
    res.json(documentosFormateados);
  } catch (error) {
    console.error('Error al obtener documentos desde equipo BNP:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener documentos',
      error: error.message
    });
  }
});


// Ruta para obtener un documento específico
router.get('/documentos/:documentoId', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { documentoId } = req.params;
    
    // Validar ID de documento
    if (!mongoose.Types.ObjectId.isValid(documentoId)) {
      return res.status(400).json({ mensaje: 'ID de documento inválido' });
    }
    
    // Buscar el documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado' });
    }
    
    // Retornar el documento formateado
    res.json({
      id: documento._id,
      tipo: documento.tipo,
      nombre: documento.nombre || '',
      numero: documento.numero || '',
      fecha_emision: documento.fecha_emision,
      fecha_vencimiento: documento.fecha_vencimiento,
      pais: documento.pais,
      archivo: documento.archivo || null,
      beneficiario_id: documento.beneficiario_id,
      creado_en: documento.creado_en,
      actualizado_en: documento.actualizado_en
    });
  } catch (error) {
    console.error('Error al obtener documento específico:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener documento',
      error: error.message
    });
  }
});
// Ruta para actualizar la visibilidad de un documento para el equipo BNP
router.put('/documentos/:documentoId/compartir', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { documentoId } = req.params;
    const equipoId = req.usuario.equipo_id;
    
    // Validar ID de documento
    if (!mongoose.Types.ObjectId.isValid(documentoId)) {
      return res.status(400).json({ mensaje: 'ID de documento inválido' });
    }
    
    // Buscar y actualizar el documento
    const documento = await Documento.findByIdAndUpdate(
      documentoId,
      { 
        $addToSet: { compartido_con: equipoId },
        $set: { actualizado_en: new Date() }
      },
      { new: true }
    );
    
    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado' });
    }
    
    res.json({ 
      mensaje: 'Documento compartido correctamente',
      documento: {
        id: documento._id,
        compartido_con: documento.compartido_con
      }
    });
  } catch (error) {
    console.error('Error al compartir documento:', error);
    res.status(500).json({ 
      mensaje: 'Error al compartir documento',
      error: error.message
    });
  }
});

// Ruta para añadir comentarios a un documento
router.post('/documentos/:documentoId/comentarios', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { documentoId } = req.params;
    const { comentario } = req.body;
    
    // Validar datos
    if (!comentario || typeof comentario !== 'string') {
      return res.status(400).json({ mensaje: 'El comentario es requerido' });
    }
    
    // Validar ID de documento
    if (!mongoose.Types.ObjectId.isValid(documentoId)) {
      return res.status(400).json({ mensaje: 'ID de documento inválido' });
    }
    
    // Buscar el documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado' });
    }
    
    // Preparar el objeto de comentario
    const nuevoComentario = {
      texto: comentario,
      usuario_id: req.usuario._id,
      fecha: new Date()
    };
    
    // Añadir el comentario al documento
    if (!documento.comentarios) {
      documento.comentarios = [];
    }
    
    documento.comentarios.push(nuevoComentario);
    documento.actualizado_en = new Date();
    
    // Guardar el documento actualizado
    await documento.save();
    
    res.status(201).json({ 
      mensaje: 'Comentario agregado correctamente',
      comentario: nuevoComentario
    });
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).json({ 
      mensaje: 'Error al agregar comentario',
      error: error.message
    });
  }
});

// Ruta para marcar un documento como revisado por el equipo
router.put('/documentos/:documentoId/marcar-revisado', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { documentoId } = req.params;
    const { revisado } = req.body;
    
    // Validar ID de documento
    if (!mongoose.Types.ObjectId.isValid(documentoId)) {
      return res.status(400).json({ mensaje: 'ID de documento inválido' });
    }
    
    // Buscar el documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado' });
    }
    
    // Actualizar el estado de revisión
    documento.revisado_por_equipo = revisado || true;
    documento.fecha_revision = new Date();
    documento.usuario_revision = req.usuario._id;
    documento.actualizado_en = new Date();
    
    // Guardar el documento actualizado
    await documento.save();
    
    res.json({ 
      mensaje: 'Documento marcado como revisado',
      documento: {
        id: documento._id,
        revisado_por_equipo: documento.revisado_por_equipo,
        fecha_revision: documento.fecha_revision
      }
    });
  } catch (error) {
    console.error('Error al marcar documento como revisado:', error);
    res.status(500).json({ 
      mensaje: 'Error al actualizar estado de revisión',
      error: error.message
    });
  }
});

// Ruta para solicitar actualización de documento
router.post('/documentos/:documentoId/solicitar-actualizacion', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { documentoId } = req.params;
    const { motivo, detalles } = req.body;
    
    // Validar datos
    if (!motivo) {
      return res.status(400).json({ mensaje: 'El motivo de la solicitud es requerido' });
    }
    
    // Validar ID de documento
    if (!mongoose.Types.ObjectId.isValid(documentoId)) {
      return res.status(400).json({ mensaje: 'ID de documento inválido' });
    }
    
    // Buscar el documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado' });
    }
    
    // Crear la solicitud de actualización
    const solicitud = {
      motivo,
      detalles: detalles || '',
      fecha: new Date(),
      usuario_id: req.usuario._id,
      estado: 'pendiente'
    };
    
    // Añadir la solicitud al documento
    if (!documento.solicitudes_actualizacion) {
      documento.solicitudes_actualizacion = [];
    }
    
    documento.solicitudes_actualizacion.push(solicitud);
    documento.requiere_actualizacion = true;
    documento.actualizado_en = new Date();
    
    // Guardar el documento actualizado
    await documento.save();
    
    // TODO: Enviar notificación al beneficiario
    
    res.status(201).json({ 
      mensaje: 'Solicitud de actualización enviada',
      solicitud
    });
  } catch (error) {
    console.error('Error al solicitar actualización de documento:', error);
    res.status(500).json({ 
      mensaje: 'Error al solicitar actualización',
      error: error.message
    });
  }
});

// Crear sucursal
router.post('/sucursales', async (req, res) => {
  try {
    const nuevaSucursal = new Sucursal(req.body);
    await nuevaSucursal.save();
    res.status(201).json(nuevaSucursal);
  } catch (error) {
    console.error('Error al crear sucursal:', error);
    res.status(500).json({ error: 'Error al crear sucursal' });
  }
});

// Obtener todos los aliados
router.get('/aliados', async (req, res) => {
  try {
    const { busqueda } = req.query;
    
    let filtro = {};
    
    // Si hay parámetro de búsqueda, filtrar por nombre
    if (busqueda && busqueda.trim().length > 0) {
      filtro.nombre = { $regex: busqueda.trim(), $options: 'i' };
    }
    
    const aliados = await Aliado.find(filtro)
      .populate('estado_id')
      .populate('historialEstados.estado_id')
      .populate('sucursales')
      .populate('usuario_id', 'nombre_usuario correo tipo')
      .limit(busqueda ? 20 : 100) // Limitar resultados en búsqueda
      .sort({ nombre: 1 });
      
    // Formatear los datos para incluir el correo de ambas fuentes
    const aliadosFormateados = aliados.map(aliado => {
      const aliadoObj = aliado.toObject();
      // Usar correo del aliado si existe, si no, usar el del usuario
      aliadoObj.correo = aliado.correo || (aliado.usuario_id ? aliado.usuario_id.correo : null);
      return aliadoObj;
    });
    
    console.log(`Encontrados ${aliadosFormateados.length} aliados${busqueda ? ` para búsqueda: "${busqueda}"` : ''}`);
    
    res.json(aliadosFormateados);
  } catch (error) {
    console.error('Error al obtener aliados:', error);
    res.status(500).json({ error: 'Error al obtener aliados' });
  }
});

// Obtener todos los beneficiarios
router.get('/beneficiarios', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const beneficiarios = await Beneficiario.find({})
      .populate('usuario_id', 'nombre_usuario correo _id')
      .populate('aliado_id', 'nombre')
       .populate('sucursal', 'nombre correo telefono direccion')
        .populate('aliado_sucursal', 'nombre correo telefono direccion')
      .populate('sucursal', 'nombre _id aliado_id direccion telefono correo')
      .populate('estado_id', 'nombre codigo') 
       .select('nombre apellido correo telefono usuario_id aliado_id sucursal estado_id fecha_creacion historialEstados')
      .sort({ nombre: 1, apellido: 1 });
 const conSucursal = beneficiarios.filter(b => b.sucursal).length;
    console.log(`[equipoBNP] Beneficiarios con sucursal: ${conSucursal}`);
 if (beneficiarios.length > 0) {
      console.log('[equipoBNP] Primer beneficiario tiene historialEstados:', !!beneficiarios[0].historialEstados);
    }

     const beneficiariosFormateados = beneficiarios
      .filter(beneficiario => beneficiario.usuario_id && beneficiario.usuario_id._id)
      .map(beneficiario => {
      console.log(`Estado para beneficiario ${beneficiario._id}:`, {
          estado_id: beneficiario.estado_id,
          codigo: beneficiario.codigo
        });
        const sucursalInfo = beneficiario.sucursal ? {
          _id: beneficiario.sucursal._id,
          nombre: beneficiario.sucursal.nombre,
          aliado_id: beneficiario.sucursal.aliado_id
        } : null;

        return {
          _id: beneficiario.usuario_id._id,
          beneficiario_id: beneficiario._id,
          nombre: beneficiario.nombre || '',
          apellido: beneficiario.apellido || '',
          nombre_completo: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim(),
          correo: beneficiario.correo || beneficiario.usuario_id.correo || '',
          telefono: beneficiario.telefono || '',
          nombre_usuario: beneficiario.usuario_id.nombre_usuario || '',
         
          aliado_id: beneficiario.aliado_id?._id || beneficiario.hotel_aliado,
          aliado_nombre: beneficiario.aliado_id?.nombre,
      
          sucursal: beneficiario.sucursal?._id || beneficiario.aliado_sucursal || beneficiario.sucursal_id,
          sucursal_nombre: beneficiario.sucursal?.nombre || null,
          sucursal_info: sucursalInfo,
       
          hotel_aliado: beneficiario.hotel_aliado,
          aliado_sucursal: beneficiario.aliado_sucursal,
          sucursal_id: beneficiario.sucursal_id,
           estado_id: beneficiario.estado_id,
           historialEstados: beneficiario.historialEstados || [], 
          codigo: beneficiario.codigo,
          estado: beneficiario.estado,
          
          estado: beneficiario.estado,
          fecha_creacion: beneficiario.fecha_creacion,
          tipo: 'beneficiario'
        };
      });
  console.log(`[equipoBNP] Beneficiarios formateados: ${beneficiariosFormateados.length}`);
   const formateadosConSucursal = beneficiariosFormateados.filter(b => b.sucursal_nombre).length;
    console.log(`[equipoBNP] Formateados con sucursal_nombre: ${formateadosConSucursal}`);

    res.json(beneficiariosFormateados);
  } catch (error) {
    console.error('[equipoBNP] Error al obtener beneficiarios:', error);
    res.status(500).json({
      mensaje: 'Error al obtener la lista de beneficiarios',
      error: error.message
    });
  }
});

router.get('/sucursales', async (req, res) => {
  try {
    const sucursales = await Sucursal.find();
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener sucursales:', error);
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});

// Obtener un beneficiario específico
router.get('/beneficiarios/:id', async (req, res) => {
  try {
    const beneficiario = await Beneficiario.findById(req.params.id)
      .populate('sucursal', 'nombre direccion telefono correo') //
      .populate('aliado_id', 'nombre telefono correo');
    
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }
    const response = {
      ...beneficiario.toObject(),
      sucursal_info: beneficiario.sucursal ? {
        nombre: beneficiario.sucursal.nombre,
        correo: beneficiario.sucursal.correo,
        telefono: beneficiario.sucursal.telefono
      } : null
    };
    res.json(beneficiario);
  } catch (error) {
    console.error('Error al obtener beneficiario:', error);
    res.status(500).json({ error: 'Error al obtener beneficiario' });
  }
});

// Obtener un aliado específico
router.get('/aliados/:id', async (req, res) => {
  try {
    const aliado = await Aliado.findById(req.params.id)
      .populate('estado_id')
      .populate('sucursales')
      .populate('usuario_id', 'nombre_usuario correo tipo');
    
    if (!aliado) {
      return res.status(404).json({ error: 'Aliado no encontrado' });
    }
    
    // Formatear la respuesta para incluir el correo de ambas fuentes
    const aliadoData = {
      ...aliado.toObject(),
      correo: aliado.correo || (aliado.usuario_id ? aliado.usuario_id.correo : null)
    };
    
    res.json(aliadoData);
  } catch (error) {
    console.error('Error al obtener aliado:', error);
    res.status(500).json({ error: 'Error al obtener aliado' });
  }
});
router.get('/sucursales/aliado/:aliadoId', async (req, res) => {
  try {
    const { aliadoId } = req.params;
    const sucursales = await Sucursal.find({ 
      aliado_id: aliadoId,
      activo: true 
    });
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener sucursales del aliado:', error);
    res.status(500).json({ error: 'Error al obtener sucursales' });
  }
});
// Actualizar foto de perfil del aliado
router.post("/actualizar-foto", checkAuth, isAliado, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No se proporcionó ninguna imagen'
      });
    }
    
    console.log('Archivo recibido:', req.file);
    
    // Subir a cloudinary
    const resultado = await cloudinary.uploader.upload(req.file.path, {
      folder: 'aliados',
      use_filename: true,
      unique_filename: true,
      overwrite: true
    });
    
    console.log('Imagen subida a Cloudinary:', resultado.secure_url);
    
    // Eliminar el archivo temporal
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error al eliminar archivo temporal:', err);
    });
    
    // Actualizar la URL de la foto en el aliado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });
    
    if (!aliado) {
      return res.status(404).json({
        message: 'Aliado no encontrado'
      });
    }
    
    aliado.foto = resultado.secure_url;
    await aliado.save();
    
    return res.json({
      message: 'Foto actualizada correctamente',
      fotoUrl: resultado.secure_url,
      fotoId: resultado.public_id
    });
    
  } catch (error) {
    console.error('Error al actualizar foto de aliado:', error);
    
    // Si hay un archivo temporal, intentar eliminarlo
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
    }
    
    res.status(500).json({
      message: 'Error al actualizar foto',
      error: error.message
    });
  }
});
// Cambiar estado de un aliado

router.patch('/aliados/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id, motivo } = req.body;

    console.log('🔄 Cambiando estado de aliado:', {
      aliado_id: id,
      nuevo_estado_id: estado_id,
      motivo
    });

  
    const aliado = await Aliado.findById(id);
    if (!aliado) {
      console.log(' Aliado no encontrado:', id);
      return res.status(404).json({ error: 'Aliado no encontrado' });
    }

 
    const estado = await Estado.findById(estado_id);
    if (!estado) {
      console.log(' Estado no encontrado:', estado_id);
      return res.status(404).json({ error: 'Estado no encontrado' });
    }

    console.log(' Aliado encontrado:', aliado.nombre);
    console.log(' Estado encontrado:', estado.nombre);

    // Actualizar estado actual
    aliado.estado_id = estado_id;
    
    // Agregar al historial con fecha actual
    const nuevoHistorial = {
      estado_id,
      motivo: motivo || 'Sin motivo especificado',
      fecha: new Date()
    };
    
    aliado.historialEstados.push(nuevoHistorial);

    // Guardar cambios
    await aliado.save();

    console.log(' Estado actualizado correctamente');
    console.log(' Nuevo historial:', {
      total: aliado.historialEstados.length,
      ultimo: nuevoHistorial
    });

    
    const aliadoActualizado = await Aliado.findById(id)
      .populate('estado_id')
      .populate({
        path: 'historialEstados.estado_id',
        model: 'Estado'
      })
      .populate('sucursales')
      .populate('usuario_id', 'nombre_usuario correo tipo');

    res.json({ 
      mensaje: 'Estado actualizado correctamente',
      aliado: aliadoActualizado
    });
  } catch (error) {
    console.error(' Error al actualizar estado del aliado:', error);
    res.status(500).json({ 
      error: 'Error al actualizar estado del aliado',
      detalles: error.message 
    });
  }
});
// Cambiar estado de un beneficiario
router.patch('/beneficiarios/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id, motivo } = req.body;

    const beneficiario = await Beneficiario.findById(id);
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Actualizar estado
    beneficiario.estado_id = estado_id;
    
    // Agregar al historial
    beneficiario.historialEstados.push({
      estado_id,
      motivo,
      fecha: new Date()
    });

    await beneficiario.save();
    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Actualizar beneficiario
router.put('/beneficiarios/:id', async (req, res) => {
  try {
    const beneficiario = await Beneficiario.findById(req.params.id);
    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const camposActualizables = [
      'nombre', 'apellido', 'telefono', 'nacionalidad', 'direccion',
      'departamento', 'colaborador_bnp', 'aliado_sucursal',
      'hotel_aliado', 'sucursal', 'fecha_registro', 'monto_venta',
      'enganche_pagado', 'director', 'gerente', 'cerrador', 'foto'
    ];

    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        beneficiario[campo] = req.body[campo];
      }
    });

    await beneficiario.save();
    res.json({
      mensaje: 'Beneficiario actualizado correctamente',
      beneficiario
    });
  } catch (error) {
    console.error('Error al actualizar beneficiario:', error);
    res.status(500).json({ error: 'Error al actualizar beneficiario' });
  }
});
// Ruta para actualizar información de membresía
router.put('/beneficiarios/:id/membresia', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const datosMembresia = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: 'ID inválido' });
    }

    console.log(`[equipoBNP] Actualizando membresía para ID: ${id}`, datosMembresia);

    // NEW APPROACH: Procesar los datos de forma más directa
    const updateObject = {};
    
    // Variables para detectar cambios en estado de liquidación
    let estadoLiquidacionValue = null;
    let foundEstadoLiquidacion = false;
    
    // Procesar cada campo individualmente
    Object.keys(datosMembresia).forEach(key => {
      console.log(`[DEBUG] Procesando campo: ${key} = ${datosMembresia[key]}`);
      
      if (key.startsWith('membresia.')) {
        // Para campos con notación de punto, usar directamente
        updateObject[key] = datosMembresia[key];
        
        // CRITICAL: Detectar estado_liquidacion
        if (key === 'membresia.estado_liquidacion') {
          estadoLiquidacionValue = datosMembresia[key];
          foundEstadoLiquidacion = true;
          console.log(`[LIQUIDACION-DETECT] Encontrado estado_liquidacion: ${estadoLiquidacionValue}`);
        }
      } else {
        // Para otros campos, agregar el prefijo membresia.
        const fullKey = `membresia.${key}`;
        updateObject[fullKey] = datosMembresia[key];
        
        // CRITICAL: Detectar estado_liquidacion sin prefijo
        if (key === 'estado_liquidacion') {
          estadoLiquidacionValue = datosMembresia[key];
          foundEstadoLiquidacion = true;
          console.log(`[LIQUIDACION-DETECT] Encontrado estado_liquidacion (sin prefijo): ${estadoLiquidacionValue}`);
        }
      }
    });

    // ALWAYS UPDATE liquidada when estado_liquidacion is present
    if (foundEstadoLiquidacion && estadoLiquidacionValue !== null) {
      const liquidadaValue = (estadoLiquidacionValue === 'liquidada' || estadoLiquidacionValue === 'liquidada_parcial');
      updateObject['membresia.liquidada'] = liquidadaValue;
      
      console.log(`[LIQUIDACION-SET] Estado: ${estadoLiquidacionValue} → Liquidada: ${liquidadaValue}`);
    }

    console.log(`[equipoBNP] Update object final:`, updateObject);

    // Intentar actualizar por _id del beneficiario primero
    let beneficiarioActualizado = await Beneficiario.findByIdAndUpdate(
      id,
      { $set: updateObject },
      { new: true, runValidators: true }
    );

    // Si no se encuentra por _id, intentar por usuario_id
    if (!beneficiarioActualizado) {
      console.log(`[equipoBNP] No encontrado por _id, intentando por usuario_id...`);
      beneficiarioActualizado = await Beneficiario.findOneAndUpdate(
        { usuario_id: id },
        { $set: updateObject },
        { new: true, runValidators: true }
      );
    }

    if (!beneficiarioActualizado) {
      return res.status(404).json({ mensaje: 'Beneficiario no encontrado' });
    }

    // CRITICAL VERIFICATION: Verificar inmediatamente en la base de datos
    const verificacionDirecta = await Beneficiario.findById(beneficiarioActualizado._id).lean();
    
    console.log(`[VERIFICATION-DIRECT] Estado en BD (consulta directa):`, {
      estado_liquidacion: verificacionDirecta.membresia?.estado_liquidacion,
      liquidada: verificacionDirecta.membresia?.liquidada,
      membresia_completa: verificacionDirecta.membresia
    });

    console.log(`[equipoBNP] Membresía actualizada para beneficiario: ${beneficiarioActualizado._id}`);

    res.json({ 
      success: true,
      mensaje: 'Información de membresía actualizada correctamente',
      membresia: beneficiarioActualizado.membresia,
      // ENHANCED DEBUG info
      debug: {
        estado_liquidacion: verificacionDirecta.membresia?.estado_liquidacion,
        liquidada: verificacionDirecta.membresia?.liquidada,
        update_object_used: updateObject,
        campos_detectados: Object.keys(datosMembresia),
        found_estado_liquidacion: foundEstadoLiquidacion
      }
    });
  } catch (error) {
    console.error('[equipoBNP] Error al actualizar membresía:', error);
    res.status(500).json({ 
      mensaje: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// Actualizar perfil iode beneficiar
router.put('/beneficiarios/:id/perfil', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const datosActualizacion = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: 'ID de usuario inválido' });
    }

    console.log(`[equipoBNP] Actualizando perfil para usuario_id: ${id}`, Object.keys(datosActualizacion));

    // Actualizar por usuario_id
    const beneficiarioActualizado = await Beneficiario.findOneAndUpdate(
      { usuario_id: id },
      { $set: datosActualizacion },
      { new: true, runValidators: true }
    );

    if (!beneficiarioActualizado) {
      return res.status(404).json({ mensaje: 'Beneficiario no encontrado' });
    }

    console.log(`[equipoBNP] Perfil actualizado para beneficiario: ${beneficiarioActualizado._id}`);

    res.json({ 
      success: true,
      mensaje: 'Perfil actualizado correctamente',
      beneficiario: beneficiarioActualizado
    });
  } catch (error) {
    console.error('[equipoBNP] Error al actualizar perfil:', error);
    res.status(500).json({ 
      mensaje: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// Ruta para actualizar información administrativa
router.put('/beneficiarios/:id/administrativa', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const adminData = req.body;
    
    const beneficiario = await Beneficiario.findById(id);
    if (!beneficiario) {
      return res.status(404).json({ message: 'Beneficiario no encontrado' });
    }

    // Campos administrativos permitidos
    const camposAdministrativos = [
      'director', 'gerente', 'cerrador', 'colaborador_bnp',
      'idioma_preferencia', 'fecha_registro', 'monto_venta', 
      'departamento', 'vigencia_membresia_anos'
    ];

    let actualizado = false;
    
    //1 iteración con validaciones específicas
    camposAdministrativos.forEach(campo => {
      if (adminData[campo] !== undefined) {
        if (campo === 'vigencia_membresia_anos') {
          const valor = parseInt(adminData[campo]);
          if (valor >= 1 && valor <= 99) {
            beneficiario[campo] = valor;
            // Sincronizar con membresía si existe
            if (beneficiario.membresia) {
              beneficiario.membresia.vigencia_anos = valor;
            }
            actualizado = true;
          }
        } else if (campo === 'fecha_registro') {
          beneficiario[campo] = adminData[campo] ? new Date(adminData[campo]) : null;
          actualizado = true;
        } else if (campo === 'monto_venta') {
          beneficiario[campo] = parseFloat(adminData[campo]) || 0;
          actualizado = true;
        } else {
          beneficiario[campo] = adminData[campo];
          actualizado = true;
        }
      }
    });

    if (!actualizado) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron campos válidos para actualizar'
      });
    }

    await beneficiario.save();

    res.json({
      success: true,
      message: 'Información administrativa actualizada correctamente',
      data: {
        director: beneficiario.director,
        gerente: beneficiario.gerente,
        cerrador: beneficiario.cerrador,
        colaborador_bnp: beneficiario.colaborador_bnp,
        idioma_preferencia: beneficiario.idioma_preferencia,
        fecha_registro: beneficiario.fecha_registro,
        monto_venta: beneficiario.monto_venta,
        departamento: beneficiario.departamento,
        vigencia_membresia_anos: beneficiario.vigencia_membresia_anos
      }
    });

  } catch (error) {
    console.error('Error al actualizar información administrativa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar información administrativa',
      error: error.message
    });
  }
});
// Ruta para subir fotos de identificación
router.post('/beneficiarios/:id/fotos-identificacion', checkAuth, isEquipoBNP, upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body; // 'beneficiario' o 'pareja'
    
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó imagen' });
    }

    if (!['beneficiario', 'pareja'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo de imagen no válido' });
    }

    const beneficiario = await Beneficiario.findById(id);
    if (!beneficiario) {
      // Eliminar archivo temporal
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
      return res.status(404).json({ message: 'Beneficiario no encontrado' });
    }

    try {
      // Subir a Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `beneficiarios/identificaciones`,
        public_id: `${tipo}-${id}`,
        overwrite: true,
        resource_type: 'image'
      });

      // Preparar objeto de foto
      const fotoData = {
        nombre: req.file.originalname,
        ruta: result.secure_url,
        tipo: req.file.mimetype,
        fecha_subida: new Date()
      };

      // Actualizar según el tipo
      if (tipo === 'beneficiario') {
        beneficiario.foto_identificacion_beneficiario = fotoData;
      } else {
        beneficiario.foto_identificacion_pareja = fotoData;
      }

      await beneficiario.save();

      // Eliminar archivo temporal
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });

      const fieldName = tipo === 'beneficiario' ? 'foto_identificacion_beneficiario' : 'foto_identificacion_pareja';
      
      res.json({
        success: true,
        message: 'Foto de identificación subida correctamente',
        [fieldName]: fotoData
      });

    } catch (cloudinaryError) {
      console.error('Error en Cloudinary:', cloudinaryError);
      
      // Eliminar archivo temporal
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al subir imagen',
        error: cloudinaryError.message
      });
    }

  } catch (error) {
    console.error('Error al procesar foto de identificación:', error);
    
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud',
      error: error.message
    });
  }
});
// Actualizar aliado
router.put('/aliados/:id', async (req, res) => {
  try {
    const aliado = await Aliado.findById(req.params.id);
    if (!aliado) {
      return res.status(404).json({ error: 'Aliado no encontrado' });
    }

    const camposActualizables = [
      'nombre', 'telefono', 'correo', 'nacionalidad', 'direccion',
      'departamento', 'colaborador_bnp', 'ruc', 'razon_social', 
      'tipo_servicio', 'foto', 'sucursales', 'servicios'
    ];

    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        // Para servicios, asegúrate de guardar los IDs correctamente
        if (campo === 'servicios' && Array.isArray(req.body[campo])) {
          console.log('Guardando servicios:', req.body[campo]);
          aliado[campo] = req.body[campo];
        } else {
          aliado[campo] = req.body[campo];
        }
      }
    });

    // Si actualizamos el correo del aliado, también actualizar el correo del usuario
    if (req.body.correo && aliado.usuario_id) {
      try {
        const usuario = await Usuario.findById(aliado.usuario_id);
        if (usuario) {
          usuario.correo = req.body.correo;
          await usuario.save();
          console.log(`Correo actualizado también en usuario ${usuario._id}`);
        }
      } catch (err) {
        console.error(`Error al actualizar correo en usuario:`, err);
        // No interrumpimos el flujo si hay error aquí
      }
    }

    await aliado.save();
    console.log('Aliado actualizado con servicios:', aliado.servicios);

    // Devolver el aliado populado
    const aliadoActualizado = await Aliado.findById(aliado._id)
      .populate('usuario_id', 'nombre_usuario correo tipo')
      .populate('sucursales')
      .populate('estado_id');

    res.json({
      mensaje: 'Aliado actualizado correctamente',
      aliado: aliadoActualizado
    });
  } catch (error) {
    console.error('Error al actualizar aliado:', error);
    res.status(500).json({ error: 'Error al actualizar aliado' });
  }
});
// Ruta para eliminar fotos de identificación
router.delete('/beneficiarios/:id/fotos-identificacion/:tipo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id, tipo } = req.params;
    
    if (!['beneficiario', 'pareja'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo de imagen no válido' });
    }

    const beneficiario = await Beneficiario.findById(id);
    if (!beneficiario) {
      return res.status(404).json({ message: 'Beneficiario no encontrado' });
    }

    // Eliminar según el tipo
    if (tipo === 'beneficiario') {
      beneficiario.foto_identificacion_beneficiario = null;
    } else {
      beneficiario.foto_identificacion_pareja = null;
    }

    await beneficiario.save();

    res.json({
      success: true,
      message: 'Foto de identificación eliminada correctamente'
    });

  } catch (error) {
    console.error('Error al eliminar foto de identificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar foto',
      error: error.message
    });
  }
});
router.get('/debug/todas-sucursales', async (req, res) => {
  try {
    const sucursales = await Sucursal.find({}).lean();
    res.json({
      total: sucursales.length,
      sucursales: sucursales.map(s => ({
        _id: s._id,
        nombre: s.nombre,
        aliado_id: s.aliado_id,
        activo: s.activo
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;