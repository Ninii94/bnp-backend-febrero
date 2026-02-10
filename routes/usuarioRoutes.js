import express from 'express';
import { Usuario } from '../models/Usuario.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// IMPORTANTE: Las rutas específicas DEBEN ir ANTES que las rutas con parámetros dinámicos

router.get('/debug', (req, res) => {
  console.log('🔍 DEBUG: Ruta de usuarios funcionando');
  res.json({ 
    message: 'Rutas de usuarios funcionando',
    timestamp: new Date().toISOString()
  });
});

// @route   GET /api/usuarios/check-username
// @desc    Verificar disponibilidad de nombre de usuario
// @access  Public
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    console.log('🔍 Verificando username:', username);
    
    // Validaciones básicas
    if (!username || username.length < 3) {
      return res.json({
        available: false,
        message: 'El nombre de usuario debe tener al menos 3 caracteres'
      });
    }
    
    // Normalizar username (minúsculas, sin espacios)
    const normalizedUsername = username.toLowerCase().trim();
    
    console.log('🔍 Username normalizado:', normalizedUsername);
    
    // Verificar si el username ya existe
    const existingUser = await Usuario.findOne({ 
      nombre_usuario: { $regex: new RegExp(`^${normalizedUsername}$`, 'i') }
    });
    
    console.log('🔍 Usuario existente encontrado:', existingUser ? 'SÍ' : 'NO');
    if (existingUser) {
      console.log('🔍 Detalles del usuario existente:', {
        id: existingUser._id,
        nombre_usuario: existingUser.nombre_usuario,
        correo: existingUser.correo
      });
    }
    
    const available = !existingUser;
    
    console.log(`✅ Resultado final: ${normalizedUsername} está ${available ? 'DISPONIBLE' : 'OCUPADO'}`);
    
    res.json({
      available,
      message: available 
        ? 'Nombre de usuario disponible' 
        : 'Este nombre de usuario ya está en uso'
    });
    
  } catch (error) {
    console.error('❌ Error verificando username:', error);
    res.status(500).json({
      available: false,
      message: 'Error al verificar disponibilidad'
    });
  }
});

// @route   GET /api/usuarios/check-email
// @desc    Verificar disponibilidad de correo electrónico
// @access  Public
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    console.log('🔍 Verificando email:', email);
    
    // Validación básica de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.json({
        available: false,
        message: 'Ingresa un correo electrónico válido'
      });
    }
    
    // Normalizar email (minúsculas, sin espacios)
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('🔍 Email normalizado:', normalizedEmail);
    
    // Verificar si el email ya existe en Usuario
    const existingUser = await Usuario.findOne({ 
      correo: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    console.log('🔍 Usuario con este email encontrado:', existingUser ? 'SÍ' : 'NO');
    if (existingUser) {
      console.log('🔍 Detalles del usuario existente:', {
        id: existingUser._id,
        nombre_usuario: existingUser.nombre_usuario,
        correo: existingUser.correo
      });
    }
    
    // También verificar en Beneficiario (por si hay correos duplicados allí)
    const existingBeneficiario = await Beneficiario.findOne({
      correo: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    console.log('🔍 Beneficiario con este email encontrado:', existingBeneficiario ? 'SÍ' : 'NO');
    if (existingBeneficiario) {
      console.log('🔍 Detalles del beneficiario existente:', {
        id: existingBeneficiario._id,
        nombre: existingBeneficiario.nombre,
        correo: existingBeneficiario.correo
      });
    }
    
    const available = !existingUser && !existingBeneficiario;
    
    console.log(`✅ Resultado final: ${normalizedEmail} está ${available ? 'DISPONIBLE' : 'OCUPADO'}`);
    
    res.json({
      available,
      message: available 
        ? 'Correo electrónico disponible' 
        : 'Este correo ya está registrado'
    });
    
  } catch (error) {
    console.error('❌ Error verificando email:', error);
    res.status(500).json({
      available: false,
      message: 'Error al verificar disponibilidad'
    });
  }
});
// @route   POST /api/usuarios/batch
// @desc    Obtener múltiples usuarios por sus IDs
// @access  Private (EquipoBNP)
router.post('/batch', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { ids } = req.body;
    
    console.log('🔍 Solicitud batch para usuarios:', ids);
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        mensaje: 'Se requiere un array de IDs',
        ids_recibidos: ids
      });
    }
    
    // Validar que todos los IDs tengan formato válido
    const idsValidos = ids.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
    
    if (idsValidos.length === 0) {
      console.log('❌ No hay IDs válidos:', ids);
      return res.json([]);
    }
    
    console.log(`✅ IDs válidos: ${idsValidos.length} de ${ids.length}`);
    
    // Buscar usuarios
    const usuarios = await Usuario.find({
      _id: { $in: idsValidos }
    }).select('_id nombre_usuario correo tipo');
    
    console.log(`📊 Usuarios encontrados: ${usuarios.length}`);
    console.log('👥 Usuarios:', usuarios.map(u => ({ 
      id: u._id, 
      nombre_usuario: u.nombre_usuario 
    })));
    
    res.json(usuarios);
    
  } catch (error) {
    console.error('❌ Error en consulta batch de usuarios:', error);
    res.status(500).json({
      mensaje: 'Error al obtener usuarios en lote',
      error: error.message
    });
  }
});
// @route   POST /api/usuarios/validate-credentials
// @desc    Validar múltiples credenciales de una vez
// @access  Public
router.post('/validate-credentials', async (req, res) => {
  try {
    const { username, email } = req.body;
    const validation = {
      username: { available: true, message: '' },
      email: { available: true, message: '' }
    };
    
    console.log('🔍 Validando credenciales múltiples:', { username, email });
    
    // Validar username si se proporciona
    if (username) {
      const normalizedUsername = username.toLowerCase().trim();
      
      if (normalizedUsername.length < 3) {
        validation.username = {
          available: false,
          message: 'El nombre de usuario debe tener al menos 3 caracteres'
        };
      } else {
        const existingUsername = await Usuario.findOne({ 
          nombre_usuario: { $regex: new RegExp(`^${normalizedUsername}$`, 'i') }
        });
        
        validation.username = {
          available: !existingUsername,
          message: existingUsername 
            ? 'Este nombre de usuario ya está en uso'
            : 'Nombre de usuario disponible'
        };
      }
    }
    
    // Validar email si se proporciona
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!emailRegex.test(normalizedEmail)) {
        validation.email = {
          available: false,
          message: 'Ingresa un correo electrónico válido'
        };
      } else {
        const existingEmail = await Usuario.findOne({ 
          correo: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
        });
        
        const existingBeneficiario = await Beneficiario.findOne({
          correo: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
        });
        
        validation.email = {
          available: !existingEmail && !existingBeneficiario,
          message: (existingEmail || existingBeneficiario)
            ? 'Este correo ya está registrado'
            : 'Correo electrónico disponible'
        };
      }
    }
    
    console.log('✅ Resultado validación múltiple:', validation);
    
    res.json(validation);
    
  } catch (error) {
    console.error('❌ Error validando credenciales:', error);
    res.status(500).json({
      error: 'Error al validar credenciales'
    });
  }
});

// @route   GET /api/usuarios/beneficiarios-sin-fondo   
// @desc    Obtener beneficiarios que NO tienen fondo activo
// @access  Private (EquipoBNP)
router.get('/beneficiarios-sin-fondo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('🔍 === INICIANDO RUTA BENEFICIARIOS SIN FONDO ===');
    console.log('👤 Usuario:', req.usuario?.nombre_usuario);
    console.log('🏢 Tipo:', req.tipo);

    // TEMPORAL: Devolver todos los beneficiarios hasta que se implemente el sistema de fondos
    console.log('📊 Buscando beneficiarios en BD...');
    
    const beneficiarios = await Beneficiario.find({})
      .populate('usuario_id', 'nombre_usuario correo _id')
      .select('nombre apellido correo usuario_id')
      .sort({ nombre: 1, apellido: 1 });

    console.log(`📊 Encontrados ${beneficiarios.length} beneficiarios en total`);

    if (beneficiarios.length === 0) {
      console.log('⚠️ No se encontraron beneficiarios en la BD');
      return res.json([]);
    }

    // Filtrar y formatear
    console.log('🔄 Procesando beneficiarios...');
    
    const beneficiariosSinFondo = beneficiarios
      .filter(beneficiario => {
        const tieneUsuario = beneficiario.usuario_id && beneficiario.usuario_id._id;
        if (!tieneUsuario) {
          console.log(`⚠️ Beneficiario ${beneficiario._id} no tiene usuario asociado`);
          return false;
        }
        return true;
      })
      .map(beneficiario => ({
        _id: beneficiario.usuario_id._id, // ID del usuario
        nombre: beneficiario.nombre || '',
        apellido: beneficiario.apellido || '',
        nombre_completo: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim(),
        correo: beneficiario.correo || beneficiario.usuario_id.correo || '',
        nombre_usuario: beneficiario.usuario_id.nombre_usuario || '',
        tipo: 'beneficiario',
        beneficiario_id: beneficiario._id // ID del beneficiario (para crear el fondo)
      }));

    console.log(`✅ Procesados ${beneficiariosSinFondo.length} beneficiarios válidos`);
    console.log('📋 Primer beneficiario procesado:', beneficiariosSinFondo[0]);

    res.json(beneficiariosSinFondo);

  } catch (error) {
    console.error('❌ === ERROR EN BENEFICIARIOS SIN FONDO ===');
    console.error('Error completo:', error);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de beneficiarios sin fondo',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/usuarios/beneficiarios
// @desc    Obtener todos los beneficiarios
// @access  Private (EquipoBNP)
router.get('/beneficiarios', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('✅ Ruta /beneficiarios ejecutándose correctamente');
    console.log('👤 Usuario autenticado:', req.usuario?.nombre_usuario, req.tipo);

    // Obtener todos los beneficiarios con sus usuarios asociados
    const beneficiarios = await Beneficiario.find({})
      .populate('usuario_id', 'nombre_usuario correo _id')
      .select('nombre apellido correo usuario_id')
      .sort({ nombre: 1, apellido: 1 });

    console.log(`📊 Encontrados ${beneficiarios.length} beneficiarios en total`);

    // Filtrar solo los que tienen usuario_id válido y formatear la respuesta
    const beneficiariosFormateados = beneficiarios
      .filter(beneficiario => {
        const tieneUsuario = beneficiario.usuario_id && beneficiario.usuario_id._id;
        if (!tieneUsuario) {
          console.log(`⚠️ Beneficiario ${beneficiario._id} no tiene usuario asociado`);
        }
        return tieneUsuario;
      })
      .map(beneficiario => ({
        _id: beneficiario.usuario_id._id, // ID del usuario (para enviar mensaje)
        nombre: beneficiario.nombre || '',
        apellido: beneficiario.apellido || '',
        nombre_completo: `${beneficiario.nombre || ''} ${beneficiario.apellido || ''}`.trim(),
        correo: beneficiario.correo || beneficiario.usuario_id.correo || '',
        nombre_usuario: beneficiario.usuario_id.nombre_usuario || '',
        tipo: 'beneficiario',
        beneficiario_id: beneficiario._id // Agregar referencia al beneficiario
      }));

    console.log(`✅ Devolviendo ${beneficiariosFormateados.length} beneficiarios válidos`);
    console.log('📋 Primer beneficiario:', beneficiariosFormateados[0]);

    res.json(beneficiariosFormateados);

  } catch (error) {
    console.error('❌ Error al obtener beneficiarios:', error);
    res.status(500).json({
      mensaje: 'Error al obtener la lista de beneficiarios',
      error: error.message
    });
  }
});

// Buscar por usuario 
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    console.log('Término de búsqueda recibido:', q);

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const users = await Usuario.find({
      $or: [
        { nombre_usuario: { $regex: q, $options: 'i' } },
        { correo: { $regex: q, $options: 'i' } }
      ]
    }).select('_id nombre_usuario tipo correo');

    console.log('Usuarios encontrados:', users);
    
    res.setHeader('Content-Type', 'application/json');
    res.json(users);

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ message: 'Error searching users', error: error.message });
  }
});

// @route   GET /api/usuarios/usuario/:id
// @desc    Obtener un usuario específico por ID (para fallback)
// @access  Private (EquipoBNP)
router.get('/usuario/:id', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Solicitud individual para usuario:', id);
    
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ 
        mensaje: 'ID de usuario no válido',
        id_recibido: id 
      });
    }
    
    const usuario = await Usuario.findById(id).select('_id nombre_usuario correo tipo');
    
    if (!usuario) {
      console.log('❌ Usuario no encontrado:', id);
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    console.log('✅ Usuario encontrado:', { 
      id: usuario._id, 
      nombre_usuario: usuario.nombre_usuario 
    });
    
    res.json(usuario);
    
  } catch (error) {
    console.error('❌ Error al obtener usuario individual:', error);
    res.status(500).json({
      mensaje: 'Error al obtener usuario',
      error: error.message
    });
  }
});
router.get('/test-usuario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🧪 TEST - Buscando usuario:', id);
    
    const usuario = await Usuario.findById(id);
    console.log('🧪 TEST - Usuario encontrado:', usuario);
    
    res.json({
      encontrado: !!usuario,
      usuario: usuario ? {
        _id: usuario._id,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        tipo: usuario.tipo
      } : null
    });
  } catch (error) {
    console.error('🧪 TEST - Error:', error);
    res.status(500).json({ error: error.message });
  }
});
// IMPORTANTE: Esta ruta DEBE ir AL FINAL porque usa un parámetro dinámico (:id)
// Obtener un usuario específico por ID 
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Buscando usuario por ID:', id);
    
    if (!id) {
      return res.status(400).json({ message: 'ID de usuario no proporcionado' });
    }
    
    // Verificar que el ID tiene el formato correcto de MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ 
        message: 'ID de usuario no válido',
        provided_id: id 
      });
    }
    
    const usuario = await Usuario.findById(id).select('_id nombre_usuario tipo correo');
    
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
});

export default router;