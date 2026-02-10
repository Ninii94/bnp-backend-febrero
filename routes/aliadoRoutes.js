import express from "express";
import mongoose from "mongoose";
import { Aliado } from "../models/Aliado.js";
import { Sucursal } from "../models/Sucursal.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Servicio } from "../models/Servicio.js";
import { Usuario } from "../models/Usuario.js";
import { HistorialServicio } from "../models/HistorialServicio.js";
import { checkAuth, isAliado, isEquipoBNP} from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configuración de multer para subir imágenes temporalmente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Asegurarse de que el directorio existe
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png)"));
  },
});
router.get('/', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    // Lógica para obtener todos los aliados
    const aliados = await Aliado.find({}).select('nombre_usuario email');
    res.json(aliados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get("/test", (req, res) => {
  res.json({ message: "Aliado funcionando!" });
});

// Obtener la información del aliado autenticado
// Obtener la información del aliado autenticado
router.get("/me", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id })
      .populate("estado_id")
      .populate("sucursales");

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
        requiereLogout: true,
      });
    }

    // ============================================================
    // OBTENER DIRECCIÓN PRINCIPAL
    // ============================================================
    let direccionPrincipal = "No disponible";
    let sucursales = []; // ✅ Declarar ANTES del if

    console.log('📍 === OBTENIENDO DIRECCIÓN ===');
    console.log('📍 Dirección del aliado en BD:', aliado.direccion);

    // PRIORIDAD 1: Dirección directa del aliado
    if (aliado.direccion && aliado.direccion.trim() !== "") {
      direccionPrincipal = aliado.direccion;
      console.log('✅ Usando dirección del aliado:', direccionPrincipal);
    } else {
      // PRIORIDAD 2: Primera sucursal activa (fallback)
      console.log('🏢 Aliado sin dirección, buscando en sucursales...');
      
      sucursales = await Sucursal.find({ // ✅ Sin 'const'
        aliado_id: aliado._id,
        activo: true,
      }).sort({ nombre: 1 });

      console.log('🏢 Sucursales activas encontradas:', sucursales.length);

      if (sucursales.length > 0 && sucursales[0].direccion) {
        direccionPrincipal = sucursales[0].direccion;
        console.log('✅ Usando dirección de primera sucursal:', direccionPrincipal);
      } else {
        console.log('⚠️ Sin dirección disponible');
      }
    }

    console.log('📍 Dirección principal final:', direccionPrincipal);

    // ============================================================
    // CONTAR SUCURSALES Y BENEFICIARIOS
    // ============================================================
    const sucursalesCount = await Sucursal.countDocuments({
      aliado_id: aliado._id,
      activo: true,
    });

    const beneficiariosCount = await Beneficiario.countDocuments({
      aliado_id: aliado._id,
    });

    // ============================================================
    // DEBUG SUCURSALES
    // ============================================================
    console.log('🏢 === DEBUG SUCURSALES ===');
    console.log('🏢 Total sucursales encontradas:', sucursales.length);
    if (sucursales.length > 0) {
      console.log('🏢 Primera sucursal:', {
        nombre: sucursales[0].nombre,
        direccion: sucursales[0].direccion
      });
    }
    console.log('📍 Dirección principal asignada:', direccionPrincipal);

    // ============================================================
    // OBTENER SERVICIOS
    // ============================================================
    let servicios = [];
    if (aliado.servicios && aliado.servicios.length > 0) {
      if (
        typeof aliado.servicios[0] === "string" ||
        aliado.servicios[0] instanceof mongoose.Types.ObjectId
      ) {
        servicios = await Servicio.find({
          _id: { $in: aliado.servicios },
        }).select("nombre descripcion");
      } else {
        servicios = aliado.servicios.map((servicio) => ({
          nombre: servicio,
          descripcion: "",
        }));
      }
    }

    // ============================================================
    // CREAR OBJETO RESPUESTA
    // ============================================================
    const aliadoData = {
      _id: aliado._id,
      nombre: aliado.nombre,
      razon_social: aliado.razon_social,
      ruc: aliado.ruc,
      telefono: aliado.telefono,
      direccion: direccionPrincipal, // ✅ Variable correctamente definida
      correo: aliado.correo || req.usuario.correo,
      nacionalidad: aliado.nacionalidad,
      inicio_contrato: aliado.inicio_contrato,
      fin_contrato: aliado.fin_contrato,
      colaborador_bnp: aliado.colaborador_bnp,
      descripcion: aliado.descripcion,
      departamento: aliado.departamento,
      foto: aliado.foto,
      estado: aliado.estado_id
        ? aliado.estado_id.nombre
        : "Sin estado asignado",
      sucursales_count: sucursalesCount,
      beneficiarios_count: beneficiariosCount,
      servicios: servicios,
    };

    // ============================================================
    // LOGS FINALES
    // ============================================================
    console.log('📤 === RESPUESTA FINAL ===');
    console.log('📤 Dirección:', aliadoData.direccion);
    console.log('📤 Servicios:', aliadoData.servicios.map(s => s.nombre));

    res.json(aliadoData);

  } catch (error) {
    console.error("Error al obtener información del aliado:", error);
    res.status(500).json({
      message: "Error al obtener información del aliado",
      error: error.message,
    });
  }
});

// Obtener las sucursales del aliado
router.get("/sucursales", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    const sucursales = await Sucursal.find({
      aliado_id: aliado._id,
      activo: true,
    }).sort({ nombre: 1 });

    res.json(sucursales);
  } catch (error) {
    console.error("Error al obtener sucursales:", error);
    res.status(500).json({
      message: "Error al obtener sucursales",
      error: error.message,
    });
  }
});

// Obtener los servicios disponibles para el aliado
router.get("/servicios", checkAuth, isAliado, async (req, res) => {
  try {
    // Obtener servicios para aliados
    const servicios = await Servicio.find({
      $or: [{ tipoUsuario: "aliado" }, { tipoUsuario: "ambos" }],
    });

    // Buscar el aliado para obtener sus servicios actuales
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    // Verificar si los servicios del aliado son IDs o nombres
    let serviciosAliado = [];
    if (aliado.servicios && aliado.servicios.length > 0) {
      if (typeof aliado.servicios[0] === "string") {
        // Si son strings, asumir que son nombres de servicios directamente
        serviciosAliado = aliado.servicios;
      } else if (aliado.servicios[0] instanceof mongoose.Types.ObjectId) {
        // Si son ObjectIds, convertir a strings para comparar
        serviciosAliado = aliado.servicios.map((id) => id.toString());
      }
    }

    // Formatear la respuesta
    const serviciosFormateados = servicios.map((servicio) => ({
      _id: servicio._id.toString(),
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      activo:
        serviciosAliado.includes(servicio._id.toString()) ||
        serviciosAliado.includes(servicio.nombre),
    }));

    res.json(serviciosFormateados);
  } catch (error) {
    console.error("Error al obtener servicios del aliado:", error);
    res.status(500).json({
      message: "Error al obtener servicios",
      error: error.message,
    });
  }
});

// Actualizar perfil del aliado
router.put("/actualizar-perfil", checkAuth, isAliado, async (req, res) => {
  try {
    console.log(
      "Recibida solicitud para actualizar perfil de aliado:",
      req.body
    );

    // Campos actualizables
    const camposPermitidos = [
      "telefono",
      "correo",
      "direccion",
      "colaborador_bnp",
    ];

    // Crear objeto con los campos a actualizar
    const actualizaciones = {};
    let actualizarUsuario = false;

    for (const campo of Object.keys(req.body)) {
      if (camposPermitidos.includes(campo)) {
        actualizaciones[campo] = req.body[campo];

        // Si se actualiza el correo, hay que actualizar también el usuario
        if (campo === "correo") {
          actualizarUsuario = true;
        }
      }
    }

    // Validar que hay campos para actualizar
    if (Object.keys(actualizaciones).length === 0) {
      return res.status(400).json({
        message: "No se proporcionaron campos válidos para actualizar",
      });
    }

    // Buscar el aliado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    // Actualizar campos en el aliado
    Object.keys(actualizaciones).forEach((campo) => {
      // Ahora el correo se guarda tanto en aliado como en usuario
      aliado[campo] = actualizaciones[campo];
    });

    await aliado.save();

    // Si es necesario, actualizar el usuario (correo)
    if (actualizarUsuario && actualizaciones.correo) {
      const usuario = await Usuario.findById(req.usuario._id);

      if (usuario) {
        usuario.correo = actualizaciones.correo;
        await usuario.save();
      }
    }

    return res.json({
      message: "Perfil actualizado correctamente",
      actualizaciones,
    });
  } catch (error) {
    console.error("Error al actualizar perfil de aliado:", error);
    res.status(500).json({
      message: "Error al actualizar perfil",
      error: error.message,
    });
  }
});

// Actualizar foto de perfil del aliado
router.post(
  "/actualizar-foto",
  checkAuth,
  isAliado,
  upload.single("imagen"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No se proporcionó ninguna imagen",
        });
      }

      console.log("Archivo recibido:", req.file);

      // Subir a cloudinary
      const resultado = await cloudinary.uploader.upload(req.file.path, {
        folder: "aliados",
        use_filename: true,
        unique_filename: true,
        overwrite: true,
      });

      console.log("Imagen subida a Cloudinary:", resultado.secure_url);

      // Eliminar el archivo temporal
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error al eliminar archivo temporal:", err);
      });

      // Actualizar la URL de la foto en el aliado
      const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

      if (!aliado) {
        return res.status(404).json({
          message: "Aliado no encontrado",
        });
      }

      aliado.foto = resultado.secure_url;
      await aliado.save();

      return res.json({
        message: "Foto actualizada correctamente",
        fotoUrl: resultado.secure_url,
        fotoId: resultado.public_id,
      });
    } catch (error) {
      console.error("Error al actualizar foto de aliado:", error);

      // Si hay un archivo temporal, intentar eliminarlo
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error al eliminar archivo temporal:", err);
        });
      }

      res.status(500).json({
        message: "Error al actualizar foto",
        error: error.message,
      });
    }
  }
);

// Actualizar servicios del aliado
router.post("/actualizar-servicios", checkAuth, isAliado, async (req, res) => {
  try {
    const { servicios } = req.body;

    if (!Array.isArray(servicios)) {
      return res.status(400).json({
        message: "El formato de servicios es inválido",
      });
    }

    // Buscar el aliado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    // Obtener servicios actuales para comparar
    const serviciosActuales = aliado.servicios || [];

    // Guardar los nuevos servicios
    aliado.servicios = servicios;
    await aliado.save();

    // Crear registros en el historial de servicios
    const entriesForHistory = [];

    // Servicios agregados (los que están en servicios pero no en serviciosActuales)
    const serviciosAgregados = servicios.filter(
      (id) => !serviciosActuales.includes(id)
    );

    for (const servicioId of serviciosAgregados) {
      // Obtener el nombre del servicio
      const servicio = await Servicio.findById(servicioId);
      const servicioNombre = servicio ? servicio.nombre : null;

      entriesForHistory.push({
        usuarioId: req.usuario._id,
        servicioId,
        servicioNombre,
        accion: "activado",
        fecha: new Date(),
        usuario: req.usuario.nombre_usuario || "Aliado",
      });
    }

    // Servicios eliminados (los que están en serviciosActuales pero no en servicios)
    const serviciosEliminados = serviciosActuales.filter(
      (id) => !servicios.includes(id)
    );

    for (const servicioId of serviciosEliminados) {
      // Obtener el nombre del servicio
      const servicio = await Servicio.findById(servicioId);
      const servicioNombre = servicio ? servicio.nombre : null;

      entriesForHistory.push({
        usuarioId: req.usuario._id,
        servicioId,
        servicioNombre,
        accion: "desactivado",
        fecha: new Date(),
        usuario: req.usuario.nombre_usuario || "Aliado",
      });
    }

    // Guardar las entradas del historial si hay cambios
    if (entriesForHistory.length > 0) {
      await HistorialServicio.insertMany(entriesForHistory);
      console.log(
        `Se registraron ${entriesForHistory.length} entradas en el historial de servicios`
      );
    }

    return res.json({
      message: "Servicios actualizados correctamente",
      servicios,
      cambios: {
        agregados: serviciosAgregados.length,
        eliminados: serviciosEliminados.length,
      },
    });
  } catch (error) {
    console.error("Error al actualizar servicios del aliado:", error);
    res.status(500).json({
      message: "Error al actualizar servicios",
      error: error.message,
    });
  }
});

// Obtener los beneficiarios vinculados al aliado con paginación
router.get("/beneficiarios", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.q || "";

    // Construir el filtro de búsqueda
    const searchFilter = search
      ? {
          $or: [
            { nombre: { $regex: search, $options: "i" } },
            { apellido: { $regex: search, $options: "i" } },
            { "codigo.value": { $regex: search, $options: "i" } },
            { llave_unica: { $regex: search, $options: "i" } },
            { telefono: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Combinar con el filtro de aliado
    const filter = {
      aliado_id: aliado._id,
      ...searchFilter,
    };

    // Contar el total de registros que coinciden con el filtro
    const total = await Beneficiario.countDocuments(filter);

    // Obtener los beneficiarios con paginación
    const beneficiarios = await Beneficiario.find(filter)
      .select("nombre apellido telefono llave_unica codigo usuario_id")
      .populate("usuario_id", "correo")
      .sort({ fecha_creacion: -1 })
      .skip(skip)
      .limit(limit);

    // Transformar los datos para el frontend
    const beneficiariosData = beneficiarios.map((b) => ({
      _id: b._id,
      nombre: `${b.nombre || ""} ${b.apellido || ""}`.trim(),
      correo: b.usuario_id ? b.usuario_id.correo : null,
      telefono: b.telefono,
      codigo: {
        value: b.codigo ? b.codigo.value : b.llave_unica,
        activo: b.codigo ? b.codigo.activo : false,
      },
      estado: b.codigo && b.codigo.activo ? "Activo" : "Inactivo",
    }));

    res.json({
      beneficiarios: beneficiariosData,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error al obtener beneficiarios:", error);
    res.status(500).json({
      message: "Error al obtener beneficiarios",
      error: error.message,
    });
  }
});

// Obtener la cantidad de beneficiarios vinculados al aliado
router.get("/beneficiarios/count", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    const count = await Beneficiario.countDocuments({ aliado_id: aliado._id });

    res.json({ count });
  } catch (error) {
    console.error("Error al obtener cantidad de beneficiarios:", error);
    res.status(500).json({
      message: "Error al obtener cantidad de beneficiarios",
      error: error.message,
    });
  }
});

// Obtener un beneficiario específico
router.get("/beneficiarios/:id", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    const beneficiarioId = req.params.id;

    const beneficiario = await Beneficiario.findOne({
      _id: beneficiarioId,
      aliado_id: aliado._id,
    }).populate("usuario_id", "correo");

    if (!beneficiario) {
      return res.status(404).json({ message: "Beneficiario no encontrado" });
    }

    // Transformar los datos para el frontend
    const beneficiarioData = {
      _id: beneficiario._id,
      nombre: beneficiario.nombre,
      apellido: beneficiario.apellido,
      nombre_completo: `${beneficiario.nombre || ""} ${
        beneficiario.apellido || ""
      }`.trim(),
      correo: beneficiario.usuario_id ? beneficiario.usuario_id.correo : null,
      telefono: beneficiario.telefono,
      nacionalidad: beneficiario.nacionalidad,
      direccion: beneficiario.direccion,
      codigo: beneficiario.codigo
        ? {
            value: beneficiario.codigo.value,
            activo: beneficiario.codigo.activo,
            fecha_expiracion: beneficiario.codigo.fecha_expiracion,
          }
        : null,
      fecha_creacion: beneficiario.fecha_creacion,
    };

    res.json(beneficiarioData);
  } catch (error) {
    console.error("Error al obtener beneficiario:", error);
    res.status(500).json({
      message: "Error al obtener beneficiario",
      error: error.message,
    });
  }
});

// Obtener métricas y estadísticas del aliado
router.get("/dashboard", checkAuth, isAliado, async (req, res) => {
  try {
    // Buscar el aliado usando el ID del usuario autenticado
    const aliado = await Aliado.findOne({ usuario_id: req.usuario._id });

    if (!aliado) {
      return res.status(404).json({
        message: "Aliado no encontrado",
      });
    }

    // Obtener cantidad de beneficiarios
    const beneficiariosCount = await Beneficiario.countDocuments({
      aliado_id: aliado._id,
    });

    // Obtener cantidad de sucursales
    const sucursalesCount = await Sucursal.countDocuments({
      aliado_id: aliado._id,
      activo: true,
    });

    // Obtener cantidad de beneficiarios activos (con código activo)
    const beneficiariosActivos = await Beneficiario.countDocuments({
      aliado_id: aliado._id,
      "codigo.activo": true,
    });

    // Obtener beneficiarios recientes (últimos 5)
    const beneficiariosRecientes = await Beneficiario.find({
      aliado_id: aliado._id,
    })
      .select("nombre apellido codigo fecha_creacion")
      .sort({ fecha_creacion: -1 })
      .limit(5);

    // NUEVO: Obtener actividades recientes
    const actividadesRecientes = [];

    // 1. Beneficiarios recientes (últimos 3)
    const beneficiariosRecentesActividad = await Beneficiario.find({
      aliado_id: aliado._id,
    })
      .select("nombre apellido fecha_creacion")
      .sort({ fecha_creacion: -1 })
      .limit(3);

    beneficiariosRecentesActividad.forEach((beneficiario) => {
      // Usar fecha_creacion del beneficiario
      const fechaActividad = beneficiario.fecha_creacion || new Date();

      actividadesRecientes.push({
        id: `beneficiario_${beneficiario._id}`,
        tipo: "beneficiario",
        descripcion: `Nuevo beneficiario registrado: ${beneficiario.nombre} ${beneficiario.apellido}`,
        fecha: fechaActividad,
        nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
      });
    });

    // 2. Sucursales recientes (últimas 2)
    const sucursalesRecientes = await Sucursal.find({
      aliado_id: aliado._id,
      activo: true,
    })
      .select("nombre direccion createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(2);

    sucursalesRecientes.forEach((sucursal) => {
      // Usar createdAt si existe, sino usar fecha actual
      const fechaActividad =
        sucursal.createdAt || sucursal.updatedAt || new Date();

      actividadesRecientes.push({
        id: `sucursal_${sucursal._id}`,
        tipo: "sucursal",
        descripcion: `Sucursal registrada: ${sucursal.nombre}`,
        fecha: fechaActividad,
        nombre: sucursal.nombre,
        direccion: sucursal.direccion,
      });
    });

    // 3. Importar modelo de ContratoBeneficiario para contratos recientes
    try {
      // Verificar si existe el modelo ContratoBeneficiario
      const { ContratoBeneficiario } = await import(
        "../models/ContratoBeneficiario.js"
      );

      const contratosRecientes = await ContratoBeneficiario.find({
        aliado_id: aliado._id,
      })
        .select("numero_contrato estado createdAt beneficiario_id")
        .populate("beneficiario_id", "nombre apellido")
        .sort({ createdAt: -1 })
        .limit(3);

      contratosRecientes.forEach((contrato) => {
        const beneficiarioNombre = contrato.beneficiario_id
          ? `${contrato.beneficiario_id.nombre} ${contrato.beneficiario_id.apellido}`
          : "Beneficiario desconocido";

        actividadesRecientes.push({
          id: `contrato_${contrato._id}`,
          tipo: "contract",
          descripcion: `Contrato ${contrato.numero_contrato} - Estado: ${contrato.estado} con ${beneficiarioNombre}`,
          fecha: contrato.createdAt,
          nombre: contrato.numero_contrato,
        });
      });
    } catch (importError) {
      console.log(
        "No se pudo importar ContratoBeneficiario:",
        importError.message
      );
      // Si no existe el modelo, agregar actividad mock
      actividadesRecientes.push({
        id: "system_contracts",
        tipo: "system",
        descripcion: "Sistema de contratos disponible",
        fecha: new Date(),
        nombre: "Sistema",
      });
    }

    const actividadesValidas = actividadesRecientes.filter((actividad) => {
      return actividad.fecha && !isNaN(new Date(actividad.fecha).getTime());
    });

    // Ordenar actividades por fecha (más recientes primero) y limitar a 8
    actividadesValidas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const actividadesLimitadas = actividadesValidas.slice(0, 5);

    console.log(
      "Actividades procesadas:",
      actividadesLimitadas.map((a) => ({
        tipo: a.tipo,
        fecha: a.fecha,
        descripcion: a.descripcion.substring(0, 50) + "...",
      }))
    );

    // Obtener los servicios del aliado
    let serviciosAliado = [];
    if (aliado.servicios && aliado.servicios.length > 0) {
      if (
        typeof aliado.servicios[0] === "string" ||
        aliado.servicios[0] instanceof mongoose.Types.ObjectId
      ) {
        try {
          // Intentar buscar servicios por ID
          serviciosAliado = await Servicio.find({
            _id: { $in: aliado.servicios },
          }).select("nombre descripcion");

          if (serviciosAliado.length === 0) {
            // Si no se encuentran por ID, buscar por nombre (en caso de strings)
            serviciosAliado = await Servicio.find({
              nombre: { $in: aliado.servicios },
            }).select("nombre descripcion");
          }
        } catch (error) {
          console.error("Error al buscar servicios:", error);
          // Si no se pueden obtener los servicios, usar nombres directamente
          serviciosAliado = aliado.servicios.map((servicio) => ({
            nombre: servicio.toString(),
            descripcion: "",
          }));
        }
      } else {
        // Si el campo servicios ya contiene nombres como strings
        serviciosAliado = aliado.servicios.map((servicio) => ({
          nombre: servicio,
          descripcion: "",
        }));
      }
    }

    // Construir las estadísticas completas
    const stats = {
      totalBeneficiarios: beneficiariosCount,
      beneficiariosActivos,
      sucursales: sucursalesCount,
      serviciosActivos: serviciosAliado,
      fechaContrato: {
        inicio: aliado.inicio_contrato,
        fin: aliado.fin_contrato,
      },
      beneficiariosRecientes: beneficiariosRecientes.map((b) => ({
        id: b._id,
        nombre: `${b.nombre || ""} ${b.apellido || ""}`.trim(),
        codigo: b.codigo ? b.codigo.value : null,
        fecha: b.fecha_creacion,
      })),
      // NUEVO: Incluir actividades recientes
      actividadesRecientes: actividadesLimitadas,
    };

    console.log("Dashboard stats enviadas:", {
      totalBeneficiarios: stats.totalBeneficiarios,
      beneficiariosActivos: stats.beneficiariosActivos,
      sucursales: stats.sucursales,
      serviciosActivos: stats.serviciosActivos.length,
      actividadesRecientes: stats.actividadesRecientes.length,
    });

    res.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas del dashboard:", error);
    res.status(500).json({
      message: "Error al obtener estadísticas del dashboard",
      error: error.message,
    });
  }
});

export default router;
