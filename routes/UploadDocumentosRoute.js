import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Documento } from "../models/Documentos.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Usuario } from "../models/Usuario.js";
import verificarToken from "../middleware/verificarToken.js";

// ========================================
// IMPORTAR MIDDLEWARES DE BITﾃ，ORA
// ========================================
import {
  registrarDocumentoViaje,
  registrarActualizacionDocumentoViaje,
  registrarEliminacionDocumentoViaje,
} from "../middleware/Bitacora.js";

const router = express.Router();

// Configuraciﾃｳn de multer para almacenamiento de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crear directorio si no existe
    const uploadDir = path.join(process.cwd(), "uploads/documentos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre ﾃｺnico para el archivo
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Validar tipos de archivo (solo PDF)
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se permiten archivos PDF"), false);
    }
    cb(null, true);
  },
});

// Middleware para verificar permisos de acceso a documentos
const verificarPermisoDocumento = async (req, res, next) => {
  try {
    const documentoId = req.params.id;
    const usuarioId = req.usuario.id;

    console.log("Verificando permiso para documento:", documentoId);
    console.log("Usuario ID:", usuarioId);
    console.log("Tipo de usuario:", req.tipo);

    const documento = await Documento.findById(documentoId);

    if (!documento) {
      console.log("Documento no encontrado");
      return res.status(404).json({ mensaje: "Documento no encontrado." });
    }

    console.log("Documento encontrado:", {
      id: documento._id,
      beneficiario_id: documento.beneficiario_id,
      creado_por: documento.creado_por,
    });

    const usuario = await Usuario.findById(usuarioId);

    if (!usuario) {
      console.log("Usuario no encontrado");
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    console.log("Usuario:", {
      id: usuario._id,
      tipo: usuario.tipo,
      beneficiario_id: usuario.beneficiario_id,
    });

    // CASO 1: Si el usuario es el creador del documento
    if (documento.creado_por && documento.creado_por.toString() === usuarioId) {
      console.log("Acceso permitido - Usuario es creador del documento");
      return next();
    }

    // CASO 2: Si es beneficiario y es dueﾃｱo del documento
    if (usuario.tipo === "beneficiario") {
      // Verificar por usuario.beneficiario_id
      if (
        usuario.beneficiario_id &&
        documento.beneficiario_id &&
        documento.beneficiario_id.toString() ===
          usuario.beneficiario_id.toString()
      ) {
        console.log("Acceso permitido - Beneficiario es dueﾃｱo del documento");
        return next();
      }

      // Si no tiene usuario.beneficiario_id, buscar por usuario_id en Beneficiario
      if (!usuario.beneficiario_id) {
        const beneficiario = await Beneficiario.findOne({
          usuario_id: usuarioId,
        });
        if (
          beneficiario &&
          documento.beneficiario_id &&
          documento.beneficiario_id.toString() === beneficiario._id.toString()
        ) {
          console.log(
            "Acceso permitido - Beneficiario es dueﾃｱo del documento (vﾃｭa usuario_id)"
          );
          return next();
        }
      }
    }

    // CASO 3: Si es miembro de equipo o admin
    if (usuario.tipo === "equipo_bnp" || usuario.tipo === "admin") {
      console.log("Acceso permitido - Usuario es equipo BNP o admin");
      return next();
    }

    console.log("Acceso denegado - No cumple ninguna condiciﾃｳn de permiso");
    return res
      .status(403)
      .json({ mensaje: "No tienes permiso para acceder a este documento." });
  } catch (error) {
    console.error("Error al verificar permisos:", error);
    return res
      .status(500)
      .json({ mensaje: "Error al verificar permisos.", error: error.message });
  }
};

// ========================================
// RUTAS CON MIDDLEWARES DE BITﾃ，ORA
// ========================================


router.post(
  "/",
  verificarToken,
  upload.single("documento"),
  registrarDocumentoViaje, 
  async (req, res) => {
    try {
      const {
        tipo,
        nombre,
        numero,
        fecha_emision,
        fecha_vencimiento,
        pais,
        beneficiario_id,
        equipo_id,
      } = req.body;

      console.log("Subiendo documento:", {
        tipo,
        nombre: tipo === "Otro" ? nombre : undefined,
        beneficiario_id,
        equipo_id: equipo_id || null,
        usuario: req.usuario.id,
      });

      // Validar que el beneficiario existe
      let beneficiarioTarget;
      if (req.tipo === "beneficiario") {
        // Si es beneficiario, buscar su propio perfil
        const usuario = await Usuario.findById(req.usuario.id);
        if (usuario && usuario.beneficiario_id) {
          beneficiarioTarget = await Beneficiario.findById(
            usuario.beneficiario_id
          );
        } else {
          // Si no tiene beneficiario asignado, buscarlo por usuario
          beneficiarioTarget = await Beneficiario.findOne({
            usuario_id: req.usuario.id,
          });
        }

        // Si no se encuentra, devolver error
        if (!beneficiarioTarget) {
          return res
            .status(404)
            .json({
              mensaje:
                "No se encontrﾃｳ un perfil de beneficiario para este usuario.",
            });
        }
      } else {
        // Si es equipo, buscar el beneficiario especificado
        if (!beneficiario_id) {
          return res
            .status(400)
            .json({
              mensaje:
                "Se requiere especificar un beneficiario para el documento.",
            });
        }

        beneficiarioTarget = await Beneficiario.findById(beneficiario_id);
        if (!beneficiarioTarget) {
          return res
            .status(404)
            .json({ mensaje: "Beneficiario no encontrado." });
        }
      }

      // Si no hay archivo
      if (!req.file) {
        return res
          .status(400)
          .json({ mensaje: "No se proporcionﾃｳ ningﾃｺn archivo PDF." });
      }

      // Crear URL base para el archivo
      const urlBase = `${req.protocol}://${req.get("host")}`;

      // Crear nuevo documento
      const nuevoDocumento = new Documento({
        tipo,
        nombre: tipo === "Otro" ? nombre : undefined,
        numero,
        fecha_emision,
        fecha_vencimiento,
        pais,
        archivo: {
          nombre: req.file.originalname,
          mimetype: req.file.mimetype,
          ruta: req.file.path,
          tamano: req.file.size,
          url: `${urlBase}/api/upload/documentos/${req.file.filename}`,
        },
        beneficiario_id: beneficiarioTarget._id,
        equipo_id: equipo_id || null,
        creado_por: req.usuario.id,
      });

      await nuevoDocumento.save();

      // Actualizar beneficiario con el nuevo documento
      if (!beneficiarioTarget.documentos_viaje) {
        beneficiarioTarget.documentos_viaje = [];
      }

      beneficiarioTarget.documentos_viaje.push({
        id: nuevoDocumento._id.toString(),
        tipo: nuevoDocumento.tipo,
        numero: nuevoDocumento.numero,
        nombre: nuevoDocumento.nombre,
        fecha_emision: nuevoDocumento.fecha_emision,
        fecha_vencimiento: nuevoDocumento.fecha_vencimiento,
        pais: nuevoDocumento.pais,
        archivo: {
          nombre: nuevoDocumento.archivo.nombre,
          ruta: nuevoDocumento.archivo.ruta,
          tipo: nuevoDocumento.archivo.mimetype,
        },
        fecha_creacion: new Date(),
      });

      await beneficiarioTarget.save();

      // Preparar respuesta para el frontend
      const documentoRespuesta = {
        id: nuevoDocumento._id,
        tipo: nuevoDocumento.tipo,
        nombre: nuevoDocumento.nombre,
        numero: nuevoDocumento.numero,
        fecha_emision: nuevoDocumento.fecha_emision,
        fecha_vencimiento: nuevoDocumento.fecha_vencimiento,
        pais: nuevoDocumento.pais,
        archivo: {
          nombre: nuevoDocumento.archivo.nombre,
          url: nuevoDocumento.archivo.url,
          view_url: `${urlBase}/api/upload/documentos/${nuevoDocumento._id}?view=true`,
          download_url: `${urlBase}/api/upload/documentos/${nuevoDocumento._id}?download=true`,
        },
      };

      res.status(201).json(documentoRespuesta);
    } catch (error) {
      console.error("Error al subir documento:", error);
      res
        .status(500)
        .json({
          mensaje: "Error al guardar el documento.",
          error: error.message,
        });
    }
  }
);

// 2. Obtener un documento especﾃｭfico CON MIDDLEWARE DE BITﾃ，ORA (visualizaciﾃｳn o descarga)
router.get(
  "/:id",
  verificarToken,
  verificarPermisoDocumento,
  async (req, res) => {
    try {
      const documento = await Documento.findById(req.params.id);

      if (!documento) {
        return res.status(404).json({ mensaje: "Documento no encontrado." });
      }

      const rutaArchivo = documento.archivo.ruta;

      // Verificar que el archivo existe
      if (!fs.existsSync(rutaArchivo)) {
        return res
          .status(404)
          .json({ mensaje: "El archivo no existe en el servidor." });
      }

      // Determinar si es visualizaciﾃｳn o descarga
      if (req.query.download === "true") {
        // Configurar headers para descarga
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${documento.archivo.nombre}"`
        );
      } else {
        // Configurar headers para visualizaciﾃｳn en el navegador
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${documento.archivo.nombre}"`
        );
      }

      res.setHeader("Content-Type", documento.archivo.mimetype);

      // Enviar el archivo
      const fileStream = fs.createReadStream(rutaArchivo);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error al servir documento:", error);
      res
        .status(500)
        .json({
          mensaje: "Error al obtener el documento.",
          error: error.message,
        });
    }
  }
);

// 3. Obtener documentos del beneficiario (para uso del propio beneficiario o de equipos)
router.get("/", verificarToken, async (req, res) => {
  try {
    let beneficiarioId;

    // Si es un beneficiario, obtener sus propios documentos
    if (req.tipo === "beneficiario") {
      const usuario = await Usuario.findById(req.usuario.id);

      if (usuario.beneficiario_id) {
        beneficiarioId = usuario.beneficiario_id;
      } else {
        // Si no tiene ID de beneficiario, intentar encontrar por usuario_id
        const beneficiario = await Beneficiario.findOne({
          usuario_id: req.usuario.id,
        });
        if (beneficiario) {
          beneficiarioId = beneficiario._id;
        } else {
          return res
            .status(404)
            .json({
              mensaje:
                "No se encontrﾃｳ un perfil de beneficiario para este usuario.",
            });
        }
      }
    }
    // Si es equipo y especifica un beneficiario
    else if (
      (req.tipo === "equipo_bnp" || req.tipo === "admin") &&
      req.query.beneficiario_id
    ) {
      beneficiarioId = req.query.beneficiario_id;

      // Verificar que el beneficiario existe
      const beneficiarioExiste = await Beneficiario.exists({
        _id: beneficiarioId,
      });
      if (!beneficiarioExiste) {
        return res.status(404).json({ mensaje: "Beneficiario no encontrado." });
      }
    }
    // Si es equipo y no especifica beneficiario, devolver todos los documentos
    else if (req.tipo === "equipo_bnp" || req.tipo === "admin") {
      // Obtener todos los documentos (con paginaciﾃｳn opcional)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const documentos = await Documento.find({ activo: true })
        .sort({ creado_en: -1 })
        .skip(skip)
        .limit(limit)
        .populate("beneficiario_id", "nombre apellido llave_unica");

      // Formato de respuesta
      const urlBase = `${req.protocol}://${req.get("host")}`;
      const documentosRespuesta = documentos.map((doc) => ({
        id: doc._id,
        tipo: doc.tipo,
        nombre: doc.nombre,
        numero: doc.numero,
        fecha_emision: doc.fecha_emision,
        fecha_vencimiento: doc.fecha_vencimiento,
        pais: doc.pais,
        beneficiario: doc.beneficiario_id
          ? {
              id: doc.beneficiario_id._id,
              nombre: doc.beneficiario_id.nombre,
              apellido: doc.beneficiario_id.apellido,
              codigo: doc.beneficiario_id.llave_unica,
            }
          : null,
        archivo: {
          nombre: doc.archivo.nombre,
          url: doc.archivo.url,
          view_url: `${urlBase}/api/upload/documentos/${doc._id}?view=true`,
          download_url: `${urlBase}/api/upload/documentos/${doc._id}?download=true`,
        },
      }));

      return res.json(documentosRespuesta);
    } else {
      return res
        .status(400)
        .json({ mensaje: "Debes especificar un ID de beneficiario." });
    }

    // Buscar documentos del beneficiario
    const documentos = await Documento.find({
      beneficiario_id: beneficiarioId,
      activo: true,
    }).sort({ creado_en: -1 });

    // Formato de respuesta
    const urlBase = `${req.protocol}://${req.get("host")}`;
    const documentosRespuesta = documentos.map((doc) => ({
      id: doc._id,
      tipo: doc.tipo,
      nombre: doc.nombre,
      numero: doc.numero,
      fecha_emision: doc.fecha_emision,
      fecha_vencimiento: doc.fecha_vencimiento,
      pais: doc.pais,
      archivo: {
        nombre: doc.archivo.nombre,
        url: doc.archivo.url,
        view_url: `${urlBase}/api/upload/documentos/${doc._id}?view=true`,
        download_url: `${urlBase}/api/upload/documentos/${doc._id}?download=true`,
      },
    }));

    res.json(documentosRespuesta);
  } catch (error) {
    console.error("Error al obtener documentos:", error);
    res
      .status(500)
      .json({
        mensaje: "Error al obtener los documentos.",
        error: error.message,
      });
  }
});

// 4. Eliminar documento CON MIDDLEWARE DE BITﾃ，ORA (soft delete)
router.delete(
  "/:id",
  verificarToken,
  verificarPermisoDocumento,
  registrarEliminacionDocumentoViaje, // 櫨 MIDDLEWARE DE BITﾃ，ORA AGREGADO
  async (req, res) => {
    try {
      const documentoId = req.params.id;

      // Marcar como inactivo (soft delete)
      await Documento.findByIdAndUpdate(documentoId, {
        activo: false,
        actualizado_en: new Date(),
      });

      // Tambiﾃｩn actualizar en el beneficiario si es necesario
      const documento = await Documento.findById(documentoId);
      if (documento && documento.beneficiario_id) {
        const beneficiario = await Beneficiario.findById(
          documento.beneficiario_id
        );
        if (
          beneficiario &&
          beneficiario.documentos_viaje &&
          beneficiario.documentos_viaje.length > 0
        ) {
          // Encontrar el ﾃｭndice del documento en el array
          const docIndex = beneficiario.documentos_viaje.findIndex(
            (doc) => doc.id === documentoId.toString()
          );

          if (docIndex !== -1) {
            // Eliminar el documento del array
            beneficiario.documentos_viaje.splice(docIndex, 1);
            await beneficiario.save();
          }
        }
      }

      res.json({ mensaje: "Documento eliminado exitosamente." });
    } catch (error) {
      console.error("Error al eliminar documento:", error);
      res
        .status(500)
        .json({
          mensaje: "Error al eliminar el documento.",
          error: error.message,
        });
    }
  }
);

// 5. Compartir documento con un equipo
router.post(
  "/:id/compartir",
  verificarToken,
  verificarPermisoDocumento,
  async (req, res) => {
    try {
      const documentoId = req.params.id;
      const equipoId = req.body.equipo_id;

      if (!equipoId) {
        return res
          .status(400)
          .json({ mensaje: "Se requiere el ID del equipo." });
      }

      // Verificar que el documento existe
      const documento = await Documento.findById(documentoId);
      if (!documento) {
        return res.status(404).json({ mensaje: "Documento no encontrado." });
      }

      // Compartir documento si no estﾃ｡ ya compartido
      if (!documento.compartido_con.includes(equipoId)) {
        await Documento.findByIdAndUpdate(documentoId, {
          $addToSet: { compartido_con: equipoId },
        });
      }

      res.json({ mensaje: "Documento compartido exitosamente." });
    } catch (error) {
      console.error("Error al compartir documento:", error);
      res
        .status(500)
        .json({
          mensaje: "Error al compartir el documento.",
          error: error.message,
        });
    }
  }
);

// 6. Actualizar documento CON MIDDLEWARE DE BITﾃ，ORA
router.put(
  "/:id",
  verificarToken,
  verificarPermisoDocumento,
  upload.single("documento"),
  registrarActualizacionDocumentoViaje, // 櫨 MIDDLEWARE DE BITﾃ，ORA AGREGADO
  async (req, res) => {
    try {
      const { tipo, nombre, numero, fecha_emision, fecha_vencimiento, pais } =
        req.body;

      const updateData = {
        tipo,
        numero,
        fecha_emision,
        fecha_vencimiento,
        pais,
        actualizado_en: new Date(),
      };

      // Si es de tipo "Otro", incluir el nombre
      if (tipo === "Otro") {
        updateData.nombre = nombre;
      }

      // Si hay un nuevo archivo
      if (req.file) {
        const urlBase = `${req.protocol}://${req.get("host")}`;
        updateData.archivo = {
          nombre: req.file.originalname,
          mimetype: req.file.mimetype,
          ruta: req.file.path,
          tamano: req.file.size,
          url: `${urlBase}/api/upload/documentos/${req.file.filename}`,
          fecha_subida: new Date(),
        };

        // Obtener documento anterior para eliminar el archivo viejo si existe
        const documentoAntiguo = await Documento.findById(req.params.id);
        if (
          documentoAntiguo &&
          documentoAntiguo.archivo &&
          documentoAntiguo.archivo.ruta
        ) {
          try {
            // Eliminar archivo fﾃｭsico si existe
            if (fs.existsSync(documentoAntiguo.archivo.ruta)) {
              fs.unlinkSync(documentoAntiguo.archivo.ruta);
            }
          } catch (err) {
            console.error("Error al eliminar archivo antiguo:", err);
            // No detenemos el proceso por esto
          }
        }
      }

      // Actualizar documento
      const documentoActualizado = await Documento.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!documentoActualizado) {
        return res.status(404).json({ mensaje: "Documento no encontrado." });
      }

      // Actualizar tambiﾃｩn en el beneficiario
      const beneficiario = await Beneficiario.findById(
        documentoActualizado.beneficiario_id
      );
      if (
        beneficiario &&
        beneficiario.documentos_viaje &&
        beneficiario.documentos_viaje.length > 0
      ) {
        const docIndex = beneficiario.documentos_viaje.findIndex(
          (doc) => doc.id === req.params.id.toString()
        );

        if (docIndex !== -1) {
          // Actualizar documento en el array
          beneficiario.documentos_viaje[docIndex] = {
            ...beneficiario.documentos_viaje[docIndex],
            tipo: documentoActualizado.tipo,
            numero: documentoActualizado.numero,
            nombre: documentoActualizado.nombre,
            fecha_emision: documentoActualizado.fecha_emision,
            fecha_vencimiento: documentoActualizado.fecha_vencimiento,
            pais: documentoActualizado.pais,
          };

          // Si hay nuevo archivo, actualizar tambiﾃｩn esa informaciﾃｳn
          if (req.file) {
            beneficiario.documentos_viaje[docIndex].archivo = {
              nombre: documentoActualizado.archivo.nombre,
              ruta: documentoActualizado.archivo.ruta,
              tipo: documentoActualizado.archivo.mimetype,
            };
          }

          await beneficiario.save();
        }
      }

      // Preparar respuesta
      const urlBase = `${req.protocol}://${req.get("host")}`;
      const documentoRespuesta = {
        id: documentoActualizado._id,
        tipo: documentoActualizado.tipo,
        nombre: documentoActualizado.nombre,
        numero: documentoActualizado.numero,
        fecha_emision: documentoActualizado.fecha_emision,
        fecha_vencimiento: documentoActualizado.fecha_vencimiento,
        pais: documentoActualizado.pais,
        archivo: {
          nombre: documentoActualizado.archivo.nombre,
          url: documentoActualizado.archivo.url,
          view_url: `${urlBase}/api/upload/documentos/${documentoActualizado._id}?view=true`,
          download_url: `${urlBase}/api/upload/documentos/${documentoActualizado._id}?download=true`,
        },
      };

      res.json(documentoRespuesta);
    } catch (error) {
      console.error("Error al actualizar documento:", error);
      res
        .status(500)
        .json({
          mensaje: "Error al actualizar el documento.",
          error: error.message,
        });
    }
  }
);

export default router;