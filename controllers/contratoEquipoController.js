import { ContratoEquipo } from '../models/ContratoEquipo.js';
import { Aliado } from '../models/Aliado.js';
import { Servicio } from '../models/Servicio.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuración de multer para PDFs de contratos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads/contratos-equipo');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'contrato-equipo-' + uniqueSuffix + ext);
  }
});

export const uploadContratoEquipo = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF'), false);
    }
    cb(null, true);
  }
});

// Crear contrato de equipo
export const crearContratoEquipo = async (req, res) => {
  try {
    const { 
      aliado_id, 
      contenido, 
      servicios_equipo = [],
      plantilla_usada, 
      notas
    } = req.body;

    console.log('Creando contrato de equipo para aliado:', aliado_id);

    // Validar que el aliado existe
    const aliado = await Aliado.findById(aliado_id);
    if (!aliado) {
      return res.status(404).json({
        success: false,
        message: 'Aliado no encontrado'
      });
    }

    // Validar servicios si se proporcionan
    let serviciosValidados = [];
    if (servicios_equipo.length > 0) {
      const serviciosExistentes = await Servicio.find({
        _id: { $in: servicios_equipo }
      });
      serviciosValidados = serviciosExistentes.map(s => s._id);
      console.log('Servicios validados para contrato de equipo:', serviciosValidados);
    }

    const nuevoContrato = new ContratoEquipo({
      aliado_id,
      contenido,
      servicios_equipo: serviciosValidados,
      plantilla_usada,
      notas,
      usuario_creador: req.usuario?._id,
      tipo_contrato: 'equipo'
    });

    await nuevoContrato.save();
    
    // Poblar datos para respuesta
    await nuevoContrato.populate([
      { path: 'aliado_id', select: 'nombre correo razon_social ruc telefono direccion' },
      { path: 'servicios_equipo', select: 'nombre descripcion' }
    ]);

    console.log('Contrato de equipo creado exitosamente:', nuevoContrato._id);

    res.status(201).json({
      success: true,
      message: 'Contrato de equipo creado exitosamente',
      data: nuevoContrato
    });

  } catch (error) {
    console.error('Error al crear contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los contratos de equipo
export const obtenerContratosEquipo = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado, 
      aliado_nombre, 
      fecha_desde, 
      fecha_hasta 
    } = req.query;

    console.log('Obteniendo contratos de equipo con filtros:', { estado, aliado_nombre });

    // Construir filtros
    const filtros = { tipo_contrato: 'equipo' };
    
    if (estado) {
      filtros.estado = estado;
    }
    
    if (fecha_desde || fecha_hasta) {
      filtros.fecha_creacion = {};
      if (fecha_desde) filtros.fecha_creacion.$gte = new Date(fecha_desde);
      if (fecha_hasta) filtros.fecha_creacion.$lte = new Date(fecha_hasta);
    }

    // Pipeline de agregación
    let pipeline = [
      { $match: filtros },
      {
        $lookup: {
          from: 'aliados',
          localField: 'aliado_id',
          foreignField: '_id',
          as: 'aliado'
        }
      },
      { $unwind: '$aliado' },
      {
        $lookup: {
          from: 'servicios',
          localField: 'servicios_equipo',
          foreignField: '_id',
          as: 'servicios'
        }
      }
    ];

    // Filtro por nombre de aliado
    if (aliado_nombre) {
      pipeline.push({
        $match: {
          'aliado.nombre': { $regex: aliado_nombre, $options: 'i' }
        }
      });
    }

    // Ordenar y paginar
    pipeline.push(
      { $sort: { fecha_creacion: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const contratos = await ContratoEquipo.aggregate(pipeline);
    const totalContratos = await ContratoEquipo.countDocuments(filtros);

    console.log(`Encontrados ${contratos.length} contratos de equipo`);

    res.status(200).json({
      success: true,
      data: contratos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalContratos / limit),
        totalContratos,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener contratos de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener contratos de equipo de un aliado específico
export const obtenerContratosEquipoAliado = async (req, res) => {
  try {
    const userId = req.usuario._id;

    // Buscar el aliado por usuario_id
    const aliado = await Aliado.findOne({ usuario_id: userId });
    
    if (!aliado) {
      return res.status(404).json({
        success: false,
        message: 'Información de aliado no encontrada'
      });
    }

    console.log(`Obteniendo contratos de equipo para aliado: ${aliado.nombre}`);

    const contratos = await ContratoEquipo.find({
      tipo_contrato: 'equipo',
      aliado_id: aliado._id
    })
    .populate('servicios_equipo', 'nombre descripcion')
    .sort({ fecha_creacion: -1 });

    res.status(200).json({
      success: true,
      data: contratos,
      aliado: {
        _id: aliado._id,
        nombre: aliado.nombre,
        correo: aliado.correo,
        razon_social: aliado.razon_social
      }
    });

  } catch (error) {
    console.error('Error al obtener contratos de equipo del aliado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener contrato de equipo por ID
export const obtenerContratoEquipoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await ContratoEquipo.findById(id)
      .populate('aliado_id', 'nombre correo telefono razon_social ruc direccion departamento')
      .populate('servicios_equipo', 'nombre descripcion')
      .populate('usuario_creador', 'nombre email');

    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato de equipo no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: contrato
    });

  } catch (error) {
    console.error('Error al obtener contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar contrato de equipo
export const actualizarContratoEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido, servicios_equipo, notas, plantilla_usada } = req.body;

    console.log(`Actualizando contrato de equipo: ${id}`);

    const contrato = await ContratoEquipo.findById(id);
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato de equipo no encontrado'
      });
    }

    // No permitir actualizar si ya está firmado
    if (contrato.estado === 'firmado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede modificar un contrato de equipo firmado'
      });
    }

    // Validar servicios si se proporcionan
    let serviciosValidados = contrato.servicios_equipo;
    if (servicios_equipo && Array.isArray(servicios_equipo)) {
      const serviciosExistentes = await Servicio.find({
        _id: { $in: servicios_equipo }
      });
      serviciosValidados = serviciosExistentes.map(s => s._id);
    }

    const actualizaciones = {
      ...(contenido && { contenido }),
      ...(servicios_equipo && { servicios_equipo: serviciosValidados }),
      ...(notas !== undefined && { notas }),
      ...(plantilla_usada && { plantilla_usada })
    };

    const contratoActualizado = await ContratoEquipo.findByIdAndUpdate(
      id,
      actualizaciones,
      { new: true }
    )
    .populate('aliado_id', 'nombre correo razon_social ruc')
    .populate('servicios_equipo', 'nombre descripcion');

    console.log('Contrato de equipo actualizado exitosamente');

    res.status(200).json({
      success: true,
      message: 'Contrato de equipo actualizado exitosamente',
      data: contratoActualizado
    });

  } catch (error) {
    console.error('Error al actualizar contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar contrato de equipo
export const eliminarContratoEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await ContratoEquipo.findById(id);
    
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato de equipo no encontrado'
      });
    }

    // No permitir eliminar contratos firmados
    if (contrato.estado === 'firmado') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden eliminar contratos de equipo firmados'
      });
    }

    // Eliminar archivo físico si existe
    if (contrato.archivo_contrato?.ruta && fs.existsSync(contrato.archivo_contrato.ruta)) {
      try {
        fs.unlinkSync(contrato.archivo_contrato.ruta);
        console.log('Archivo de contrato eliminado:', contrato.archivo_contrato.ruta);
      } catch (err) {
        console.error('Error al eliminar archivo:', err);
      }
    }

    await ContratoEquipo.findByIdAndDelete(id);

    console.log('Contrato de equipo eliminado:', id);

    res.status(200).json({
      success: true,
      message: 'Contrato de equipo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Subir archivo PDF de contrato de equipo
export const subirArchivoContratoEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ningún archivo PDF'
      });
    }

    const contrato = await ContratoEquipo.findById(id);
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato de equipo no encontrado'
      });
    }

    const urlBase = `${req.protocol}://${req.get('host')}`;
    
    // Eliminar archivo anterior si existe
    if (contrato.archivo_contrato?.ruta && fs.existsSync(contrato.archivo_contrato.ruta)) {
      try {
        fs.unlinkSync(contrato.archivo_contrato.ruta);
      } catch (err) {
        console.error('Error al eliminar archivo anterior:', err);
      }
    }

    // Actualizar contrato con nuevo archivo
    contrato.archivo_contrato = {
      nombre: req.file.originalname,
      mimetype: req.file.mimetype,
      ruta: req.file.path,
      tamano: req.file.size,
      url: `${urlBase}/api/contratos-equipo/descargar/${id}`
    };

    await contrato.save();

    console.log('Archivo PDF subido para contrato de equipo:', id);

    res.status(200).json({
      success: true,
      message: 'Archivo PDF subido exitosamente',
      data: {
        archivo: contrato.archivo_contrato
      }
    });

  } catch (error) {
    console.error('Error al subir archivo de contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Descargar archivo PDF de contrato de equipo
export const descargarArchivoContratoEquipo = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await ContratoEquipo.findById(id);
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato de equipo no encontrado'
      });
    }

    if (!contrato.archivo_contrato?.ruta) {
      return res.status(404).json({
        success: false,
        message: 'No hay archivo PDF para este contrato de equipo'
      });
    }

    const rutaArchivo = contrato.archivo_contrato.ruta;
    
    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({
        success: false,
        message: 'El archivo PDF no existe en el servidor'
      });
    }

    // Configurar headers para descarga
    res.setHeader('Content-Type', contrato.archivo_contrato.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${contrato.archivo_contrato.nombre}"`);
    
    // Enviar archivo
    const fileStream = fs.createReadStream(rutaArchivo);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error al descargar archivo de contrato de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener estadísticas de contratos de equipo
export const obtenerEstadisticasContratosEquipo = async (req, res) => {
  try {
    const estadisticas = await ContratoEquipo.aggregate([
      { $match: { tipo_contrato: 'equipo' } },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);

    const contratosPorMes = await ContratoEquipo.aggregate([
      {
        $match: { 
          tipo_contrato: 'equipo',
          fecha_creacion: { 
            $gte: new Date(new Date().getFullYear(), 0, 1) 
          }
        }
      },
      {
        $group: {
          _id: {
            mes: { $month: '$fecha_creacion' },
            año: { $year: '$fecha_creacion' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        estadisticasPorEstado: estadisticas,
        contratosPorMes
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de contratos de equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};
