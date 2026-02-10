import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { ComprobantePago } from '../models/ComprobantePago.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Usuario } from '../models/Usuario.js';
import verificarToken from '../middleware/verificarToken.js';
import { 
  registrarComprobantePagoSubido 
} from '../middleware/bitacoraHelpers.js';

const router = express.Router();

// Configurar multer para almacenamiento en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite de 5MB
  },
  fileFilter: (req, file, cb) => {
    // Permitir PDFs e imágenes
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, JPG, JPEG y PNG'), false);
    }
  }
});

// 1. Subir comprobante de pago (solo beneficiarios)
router.post('/', verificarToken, upload.single('comprobante'), async (req, res) => {
  try {
    if (req.tipo !== 'beneficiario') {
      return res.status(403).json({ mensaje: 'Solo los beneficiarios pueden subir comprobantes.' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se ha subido ningún archivo' });
    }

    // Obtener beneficiario con los campos necesarios para la bitácora
    const usuario = await Usuario.findById(req.usuario.id);
    let beneficiario;
    
    if (usuario.beneficiario_id) {
      beneficiario = await Beneficiario.findById(usuario.beneficiario_id);
    } else {
      beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario.id });
    }

    if (!beneficiario) {
      return res.status(404).json({ mensaje: 'Perfil de beneficiario no encontrado.' });
    }

    // Convertir el buffer a base64
    const fileStr = req.file.buffer.toString('base64');
    const fileType = req.file.mimetype;
    const uploadStr = `data:${fileType};base64,${fileStr}`;

    // Determinar tipo de archivo
    const tipoArchivo = fileType === 'application/pdf' ? 'pdf' : 'imagen';

    // Subir a Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(uploadStr, {
      folder: 'comprobantes_pago',
      resource_type: 'auto',
    });

    // Crear comprobante en la base de datos
    const comprobante = new ComprobantePago({
      beneficiario_id: beneficiario._id,
      titulo: req.body.titulo || 'Comprobante de pago',
      archivo: {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
        nombre_original: req.file.originalname,
        tipo: req.file.mimetype === 'application/pdf' ? 'pdf' : 'imagen',
        tamano: req.file.size
      }
    });

    await comprobante.save();
try {
      await registrarComprobantePagoSubido({
        beneficiario_nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
        beneficiario_id: beneficiario._id,
        beneficiario_codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
        tipo_comprobante: req.body.titulo || 'Comprobante de Pago',
        archivo_nombre: req.file.originalname,
        archivo_url: uploadResponse.secure_url,
      }, req);
    } catch (bitacoraError) {
      console.error('Error silencioso en bitácora:', bitacoraError);
    }

    res.status(201).json({
      mensaje: 'Comprobante subido exitosamente',
      comprobante: {
        _id: comprobante._id,
        titulo: comprobante.titulo,
        archivo: comprobante.archivo,
        estado: comprobante.estado,
        fecha_subida: comprobante.fecha_subida
      }
    });

  } catch (error) {
    console.error('Error al subir comprobante:', error);
    res.status(500).json({
      mensaje: 'Error al subir el comprobante',
      error: error.message
    });
  }
});

// 2. Subir comprobantes para activación de beneficios (solo beneficiarios)
router.post('/activacion-beneficios', verificarToken, upload.array('comprobantes', 3), async (req, res) => {
  try {
    // Verificar que es un beneficiario
    if (req.tipo !== 'beneficiario') {
      return res.status(403).json({ mensaje: 'Solo los beneficiarios pueden subir comprobantes.' });
    }

    const { titulos } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        mensaje: 'No se han recibido archivos'
      });
    }

    // Obtener beneficiario
    const usuario = await Usuario.findById(req.usuario.id);
    let beneficiario;
    
    if (usuario.beneficiario_id) {
      beneficiario = await Beneficiario.findById(usuario.beneficiario_id);
    } else {
      beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario.id });
    }

    if (!beneficiario) {
      return res.status(404).json({
        mensaje: 'Beneficiario no encontrado'
      });
    }

    const comprobantesSubidos = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const tituloArray = Array.isArray(titulos) ? titulos : [titulos];
      const titulo = tituloArray[i] || `Comprobante Beneficio ${i + 1}`;

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'comprobantes_activacion',
            resource_type: 'auto',
            public_id: `comp_${req.usuario.id}_${Date.now()}_${i}`,
            tags: ['comprobante', 'activacion', 'beneficio']
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.end(file.buffer);
      });

      try {
        const resultado = await uploadPromise;

        const nuevoComprobante = new ComprobantePago({
          beneficiario_id: beneficiario._id,
          titulo: titulo,
          archivo: {
            url: resultado.secure_url,
            public_id: resultado.public_id,
            nombre_original: file.originalname,
            tipo: file.mimetype === 'application/pdf' ? 'pdf' : 'imagen',
            tamano: file.size
          },
          estado: 'recibido',
          metadata: {
            categoria: 'ACTIVACION_BENEFICIO',
            numero_beneficio: i + 1,
            total_beneficios: req.files.length
          }
        });

        await nuevoComprobante.save();
        comprobantesSubidos.push(nuevoComprobante);
await registrarComprobantePagoSubido({
        beneficiario_nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
        beneficiario_id: beneficiario._id,
        beneficiario_codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
        tipo_comprobante: `Activación de Beneficio: ${titulo}`,
        archivo_nombre: file.originalname,
        archivo_url: resultado.secure_url,
      }, req);

        console.log(`✅ Comprobante ${i + 1} subido: ${titulo}`);
      } catch (uploadError) {
        console.error(`❌ Error subiendo comprobante ${i + 1}:`, uploadError);
      }
    }

    if (comprobantesSubidos.length === 0) {
      return res.status(500).json({
        mensaje: 'Error al subir los comprobantes'
      });
    }

    res.status(201).json({
      mensaje: `${comprobantesSubidos.length} comprobante(s) subido(s) exitosamente`,
      comprobantes: comprobantesSubidos.map(comp => ({
        _id: comp._id,
        titulo: comp.titulo,
        archivo: comp.archivo,
        fecha_subida: comp.fecha_subida,
        estado: comp.estado,
        metadata: comp.metadata
      })),
      total: comprobantesSubidos.length
    });

  } catch (error) {
    console.error('❌ Error en activación de beneficios:', error);
    res.status(500).json({
      mensaje: 'Error al procesar los comprobantes',
      error: error.message
    });
  }
});


// 3. Obtener comprobantes del beneficiario
router.get('/', verificarToken, async (req, res) => {
  try {
    let comprobantes;

    if (req.tipo === 'beneficiario') {
      // Si es beneficiario, obtener sus propios comprobantes
      const usuario = await Usuario.findById(req.usuario.id);
      let beneficiario;
      
      if (usuario.beneficiario_id) {
        beneficiario = await Beneficiario.findById(usuario.beneficiario_id);
      } else {
        beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario.id });
      }

      if (!beneficiario) {
        return res.status(404).json({ mensaje: 'Perfil de beneficiario no encontrado.' });
      }

      comprobantes = await ComprobantePago.find({
        beneficiario_id: beneficiario._id,
        activo: true
      }).sort({ fecha_subida: -1 });

    } else if (req.tipo === 'equipo_bnp' || req.tipo === 'admin') {
      // Si es equipo, puede ver todos los comprobantes o filtrar por beneficiario
      const filtro = { activo: true };
      
      if (req.query.beneficiario_id) {
        filtro.beneficiario_id = req.query.beneficiario_id;
      }

      console.log('🔍 Cargando comprobantes con populate mejorado...');

      // ✅ POPULATE CORREGIDO - usando los nombres correctos de campos
      comprobantes = await ComprobantePago.find(filtro)
        .populate({
          path: 'beneficiario_id',
          select: 'nombre apellido llave_unica correo usuario_id', // ✅ 'correo' en vez de 'email'
          populate: {
            path: 'usuario_id',
            select: 'correo nombre_usuario _id' // ✅ 'correo' y 'nombre_usuario'
          }
        })
        .populate('revisado_por', 'nombre_usuario correo') // ✅ 'nombre_usuario' y 'correo'
        .sort({ fecha_subida: -1 });

      // Log para debugging
      if (comprobantes.length > 0) {
        console.log('✅ Comprobantes cargados:', comprobantes.length);
        console.log('🔍 Primer comprobante completo:', {
          _id: comprobantes[0]._id,
          titulo: comprobantes[0].titulo,
          beneficiario: comprobantes[0].beneficiario_id ? {
            _id: comprobantes[0].beneficiario_id._id,
            nombre: comprobantes[0].beneficiario_id.nombre,
            apellido: comprobantes[0].beneficiario_id.apellido,
            llave_unica: comprobantes[0].beneficiario_id.llave_unica,
            correo_beneficiario: comprobantes[0].beneficiario_id.correo,
            usuario: comprobantes[0].beneficiario_id.usuario_id ? {
              _id: comprobantes[0].beneficiario_id.usuario_id._id,
              correo: comprobantes[0].beneficiario_id.usuario_id.correo,
              nombre_usuario: comprobantes[0].beneficiario_id.usuario_id.nombre_usuario
            } : null
          } : null
        });
      }

    } else {
      return res.status(403).json({ mensaje: 'No tienes permisos para ver comprobantes.' });
    }

    res.json(comprobantes);
  } catch (error) {
    console.error('Error al obtener comprobantes:', error);
    res.status(500).json({ mensaje: 'Error al obtener comprobantes', error: error.message });
  }
});

// 4. Obtener comprobantes de un beneficiario específico (sin autenticación para uso interno)
router.get('/beneficiario/:beneficiarioId', verificarToken, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const { categoria } = req.query;

    // Verificar permisos - solo equipo o el mismo beneficiario
    if (req.tipo === 'beneficiario') {
      const usuario = await Usuario.findById(req.usuario.id);
      let beneficiario;
      
      if (usuario.beneficiario_id) {
        beneficiario = await Beneficiario.findById(usuario.beneficiario_id);
      } else {
        beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario.id });
      }

      if (!beneficiario || beneficiario._id.toString() !== beneficiarioId) {
        return res.status(403).json({ mensaje: 'No tienes permiso para ver estos comprobantes.' });
      }
    } else if (req.tipo !== 'equipo_bnp' && req.tipo !== 'admin') {
      return res.status(403).json({ mensaje: 'No tienes permisos para ver comprobantes.' });
    }

    const filtro = { beneficiario_id: beneficiarioId };
    if (categoria) {
      filtro.categoria = categoria;
    }

    // ✅ POPULATE CORREGIDO
    const comprobantes = await ComprobantePago.find(filtro)
      .populate({
        path: 'beneficiario_id',
        select: 'nombre apellido llave_unica correo usuario_id',
        populate: {
          path: 'usuario_id',
          select: 'correo nombre_usuario _id'
        }
      })
      .sort({ fecha_subida: -1 })
      .select('titulo archivo estado fecha_subida observaciones metadata');

    res.json({
      success: true,
      comprobantes,
      total: comprobantes.length
    });

  } catch (error) {
    console.error('Error al obtener comprobantes:', error);
    res.status(500).json({
      mensaje: 'Error al obtener comprobantes',
      error: error.message
    });
  }
});

// 5. Actualizar estado del comprobante (solo equipo)
router.put('/:id/estado', verificarToken, async (req, res) => {
  try {
    if (req.tipo !== 'equipo_bnp' && req.tipo !== 'admin') {
      return res.status(403).json({ mensaje: 'Solo el equipo puede actualizar el estado.' });
    }

    const { estado, observaciones } = req.body;
    const estadosValidos = ['recibido', 'pago_rechazado', 'pago_confirmado'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado no válido.' });
    }

    // ✅ POPULATE CORREGIDO
    const comprobante = await ComprobantePago.findByIdAndUpdate(
      req.params.id,
      {
        estado,
        observaciones,
        fecha_revision: new Date(),
        revisado_por: req.usuario.id
      },
      { new: true }
    ).populate({
      path: 'beneficiario_id',
      select: 'nombre apellido llave_unica correo usuario_id',
      populate: {
        path: 'usuario_id',
        select: 'correo nombre_usuario _id'
      }
    });

    if (!comprobante) {
      return res.status(404).json({ mensaje: 'Comprobante no encontrado.' });
    }

    res.json({
      mensaje: 'Estado actualizado exitosamente',
      comprobante
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ mensaje: 'Error al actualizar estado', error: error.message });
  }
});

// 6. Eliminar comprobante (soft delete)
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const comprobante = await ComprobantePago.findById(req.params.id);
    
    if (!comprobante) {
      return res.status(404).json({ mensaje: 'Comprobante no encontrado.' });
    }

    // Verificar permisos
    if (req.tipo === 'beneficiario') {
      // Verificar que es el dueño del comprobante
      const usuario = await Usuario.findById(req.usuario.id);
      let beneficiario;
      
      if (usuario.beneficiario_id) {
        beneficiario = await Beneficiario.findById(usuario.beneficiario_id);
      } else {
        beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario.id });
      }

      if (!beneficiario || comprobante.beneficiario_id.toString() !== beneficiario._id.toString()) {
        return res.status(403).json({ mensaje: 'No tienes permiso para eliminar este comprobante.' });
      }
    } else if (req.tipo !== 'equipo_bnp' && req.tipo !== 'admin') {
      return res.status(403).json({ mensaje: 'No tienes permisos para eliminar comprobantes.' });
    }

    // Soft delete
    await ComprobantePago.findByIdAndUpdate(req.params.id, { activo: false });

    res.json({ mensaje: 'Comprobante eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar comprobante:', error);
    res.status(500).json({ mensaje: 'Error al eliminar comprobante', error: error.message });
  }
});

export default router;