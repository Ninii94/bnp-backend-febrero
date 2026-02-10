// routes/AvisoRoutes.js
import express from "express";
import { Aviso } from "../models/Aviso.js";
import { Usuario } from "../models/Usuario.js"; // Importar Usuario directamente
import { Aliado } from "../models/Aliado.js"; // Importar Aliado directamente
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Obtener todos los aliados para el selector (solo equipo BNP)
router.get("/aliados", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    // Buscar todos los usuarios con tipo 'aliado'
    const aliadosUsuarios = await Usuario.find({
      tipo: "aliado",
      activo: true,
    }).select("_id nombre_usuario correo");

    // Obtener información adicional de los aliados
    const aliados = await Promise.all(
      aliadosUsuarios.map(async (usuario) => {
        // Buscar si existe información adicional del aliado
        const aliadoInfo = await Aliado.findOne({ usuario_id: usuario._id });

        return {
          _id: usuario._id,
          nombre: aliadoInfo?.nombre || usuario.nombre_usuario,
          email: usuario.correo,
        };
      })
    );

    res.json(aliados);
  } catch (error) {
    console.error("Error al obtener aliados:", error);
    res.status(500).json({ message: "Error del servidor al obtener aliados" });
  }
});

// Obtener todos los avisos (accesible para todos los usuarios autenticados)
router.get("/", checkAuth, async (req, res) => {
  try {
    const avisos = await Aviso.find()
      .sort({ fijado: -1, fechaCreacion: -1 })
      .populate({
        path: "autorId",
        select: "nombre_usuario correo tipo",
      })
      .exec();

    // Transformar los avisos para incluir información completa del autor
    const avisosConInfo = await Promise.all(
      avisos.map(async (aviso) => {
        let autorFoto = "/default-profile.jpg";
        let nombreCompleto = aviso.autor; // Usar el campo autor como prioridad

        // Si el aviso es de un aliado, buscar información adicional
        if (aviso.autorTipo === "aliado" && aviso.autorId) {
          try {
            const aliado = await Aliado.findOne({
              usuario_id: aviso.autorId._id,
            });
            autorFoto = aliado?.foto || "/default-profile.jpg";

            // Si no hay nombre en el campo autor, usar el nombre del aliado
            if (!nombreCompleto && aliado?.nombre) {
              nombreCompleto = aliado.nombre;
            }
          } catch (error) {
            console.error(
              `Error al buscar info para aliado ${aviso.autorId._id}:`,
              error
            );
          }
        }

        return {
          ...aviso.toObject(),
          autorId: aviso.autorId,
          autor: nombreCompleto || aviso.autorId?.nombre_usuario || "Usuario", // Asegurar que siempre hay un nombre
          autorFoto: autorFoto,
        };
      })
    );

    res.json(avisosConInfo);
  } catch (error) {
    console.error("Error al obtener avisos:", error);
    res.status(500).json({
      message: "Error del servidor al obtener avisos",
      detalle: error.message,
    });
  }
});

// Crear un nuevo aviso (solo equipo BNP)
router.post("/", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const {
      titulo,
      contenido,
      videoUrl,
      fijado,
      imagen,
      autor,
      autorId,
      autorTipo,
    } = req.body;

    console.log("Datos recibidos:", {
      titulo,
      contenido,
      videoUrl,
      fijado,
      imagen,
      autor,
      autorId,
      autorTipo,
    });

    // Verificar si se proporcionó un autorId cuando autorTipo es 'aliado'
    if (autorTipo === "aliado" && !autorId) {
      return res
        .status(400)
        .json({ message: "Se requiere seleccionar un aliado" });
    }

    let finalAutor = autor || req.usuario?.nombre || "Equipo BNP";
    let finalAutorId = autorId || req.usuario?._id || req.usuario?.id;

    // Si es un aliado, obtener el nombre correcto del aliado
    if (autorTipo === "aliado") {
      const usuarioAliado = await Usuario.findOne({
        _id: autorId,
        tipo: "aliado",
      });

      if (!usuarioAliado) {
        return res
          .status(400)
          .json({ message: "Aliado no encontrado o inválido" });
      }

      // Buscar información adicional del aliado
      const aliadoInfo = await Aliado.findOne({ usuario_id: autorId });

      // Usar el nombre del aliado si está disponible, sino usar nombre_usuario
      finalAutor = aliadoInfo?.nombre || usuarioAliado.nombre_usuario;
      finalAutorId = autorId;
    }

    // Crear el aviso
    const nuevoAviso = new Aviso({
      titulo,
      contenido,
      videoUrl: videoUrl || null,
      fijado: fijado === true || fijado === "true",
      autor: finalAutor,
      autorId: finalAutorId,
      autorTipo: autorTipo || "equipo_bnp",
      imagen,
    });

    await nuevoAviso.save();

    res.status(201).json(nuevoAviso);
  } catch (error) {
    console.error("Error al crear aviso:", error);
    res.status(500).json({ message: "Error del servidor al crear aviso" });
  }
});

// Obtener un aviso específico - DEBE IR DESPUÉS de rutas específicas
router.get("/:id", checkAuth, async (req, res) => {
  try {
    const aviso = await Aviso.findById(req.params.id);

    if (!aviso) {
      return res.status(404).json({ message: "Aviso no encontrado" });
    }

    res.json(aviso);
  } catch (error) {
    console.error("Error al obtener aviso:", error);
    res.status(500).json({ message: "Error del servidor al obtener aviso" });
  }
});

// Actualizar un aviso (solo equipo BNP)
router.put("/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { titulo, contenido, videoUrl, fijado, imagen } = req.body;

    const aviso = await Aviso.findById(req.params.id);

    if (!aviso) {
      return res.status(404).json({ message: "Aviso no encontrado" });
    }

    // Actualizar campos
    aviso.titulo = titulo;
    aviso.contenido = contenido;
    aviso.videoUrl = videoUrl || null;
    aviso.fijado = fijado === true || fijado === "true";

    // Si hay una nueva imagen, actualizar
    if (imagen !== undefined) {
      aviso.imagen = imagen;
    }

    await aviso.save();

    res.json(aviso);
  } catch (error) {
    console.error("Error al actualizar aviso:", error);
    res.status(500).json({ message: "Error del servidor al actualizar aviso" });
  }
});

// Eliminar un aviso (solo equipo BNP)
router.delete("/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const aviso = await Aviso.findById(req.params.id);

    if (!aviso) {
      return res.status(404).json({ message: "Aviso no encontrado" });
    }

    // Si hay una imagen en Cloudinary, eliminarla
    if (aviso.imagen && aviso.imagen.includes("cloudinary")) {
      try {
        // Extraer el public_id de la URL de Cloudinary
        const publicId = aviso.imagen.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.error(
          "Error al eliminar imagen de Cloudinary:",
          cloudinaryError
        );
      }
    }

    await Aviso.findByIdAndDelete(req.params.id);

    res.json({ message: "Aviso eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar aviso:", error);
    res.status(500).json({ message: "Error del servidor al eliminar aviso" });
  }
});

// Fijar/desfijar un aviso (solo equipo BNP)
router.patch("/:id/toggle-fijado", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const aviso = await Aviso.findById(req.params.id);

    if (!aviso) {
      return res.status(404).json({ message: "Aviso no encontrado" });
    }

    // Cambiar el estado de fijado
    aviso.fijado = !aviso.fijado;
    await aviso.save();

    res.json(aviso);
  } catch (error) {
    console.error("Error al cambiar estado de fijado:", error);
    res
      .status(500)
      .json({ message: "Error del servidor al cambiar estado de fijado" });
  }
});

export default router;
