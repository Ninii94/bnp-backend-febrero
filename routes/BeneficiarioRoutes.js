//PERFIL INDIVIDUAL DE BENEFICIARIO

import mongoose from "mongoose";
import express from "express";
import { Beneficiario } from "../models/Beneficiario.js";
import { Usuario } from "../models/Usuario.js";
import { checkAuth, isBeneficiario, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

// buscar beneficiarios - mantiene los campos y estructura de tu código original
router.get("/buscar", checkAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Se requieren al menos 2 caracteres para buscar",
      });
    }

    const beneficiarios = await Beneficiario.find({
      $or: [
        { nombre: { $regex: q, $options: "i" } },
        { apellido: { $regex: q, $options: "i" } },
        { "codigo.value": { $regex: q, $options: "i" } },
        { llave_unica: { $regex: q, $options: "i" } },
        { correo: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id nombre apellido codigo llave_unica correo")
      .limit(10);

    res.status(200).json({
      success: true,
      beneficiarios,
    });
  } catch (error) {
    console.error("Error al buscar beneficiarios:", error);
    res.status(500).json({
      success: false,
      message: "Error al buscar beneficiarios",
      error: error.message,
    });
  }
});
// Obtener perfil del beneficiario
router.get("/perfil", checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;

    console.log("Buscando beneficiario para usuario ID:", usuarioId);

    // Obtenemos el beneficiario directamente del req, que ya fue establecido por el middleware
    const beneficiario = req.beneficiario;

    console.log("Beneficiario encontrado:", beneficiario);

    if (!beneficiario) {
      return res.status(404).json({
        message: "Perfil de beneficiario no encontrado",
        usuarioId: usuarioId.toString(),
        requiereLogout: true,
      });
    }

    // Crear objeto con la información necesaria para el frontend
    // Priorizar el correo en el beneficiario, si existe, o usar el del usuario
    const correoMostrar = beneficiario.correo || req.usuario.correo;

    const perfilData = {
      nombre: req.usuario.nombre_usuario,
      correo: correoMostrar,
      llave_unica: beneficiario.llave_unica || beneficiario.codigo?.value,
      llave_unica_activa: beneficiario.codigo?.activo || false,
      fecha_vencimiento: beneficiario.codigo?.fecha_expiracion || null,
      servicios_activos: [],
      // Añadir información del reembolso
      codigo: beneficiario.codigo || {},
    };

    // Si hay información de prima pagada y reembolso, la incluimos
    if (beneficiario.codigo) {
      // Añadir prima pagada si existe
      if (beneficiario.codigo.primaPagada) {
        perfilData.primaPagada = beneficiario.codigo.primaPagada;
      }

      // Añadir monto de reembolso si existe
      if (beneficiario.codigo.monto && beneficiario.codigo.monto.valor) {
        perfilData.monto = beneficiario.codigo.monto;
      } else if (beneficiario.codigo.primaPagada) {
        // Si no hay monto pero sí prima pagada, calculamos el reembolso (5.75%)
        const montoReembolso = beneficiario.codigo.primaPagada * 0.0575;
        perfilData.monto = {
          valor: montoReembolso,
          moneda: "USD",
        };

        // Actualizamos el beneficiario con este monto
        if (!beneficiario.codigo.monto) {
          beneficiario.codigo.monto = {
            valor: montoReembolso,
            moneda: "USD",
          };
        } else {
          beneficiario.codigo.monto.valor = montoReembolso;
        }
        await beneficiario.save();
      }

      // Añadir estado de activación
      if (beneficiario.codigo.estado_activacion) {
        perfilData.estado_activacion = beneficiario.codigo.estado_activacion;
      }
    }

    // Agregar descuentos si existen
    if (beneficiario.codigo && Array.isArray(beneficiario.codigo.descuentos)) {
      perfilData.servicios_activos = [
        ...beneficiario.codigo.descuentos
          .filter(
            (descuento) =>
              !descuento.usado &&
              (!descuento.fecha_expiracion ||
                new Date(descuento.fecha_expiracion) > new Date())
          )
          .map((descuento) => ({
            tipo: "descuento",
            valor: descuento.valor,
            descripcion: descuento.descripcion,
            fecha_expiracion: descuento.fecha_expiracion,
          })),
      ];
    }

    // Datos adicionales que podrían ser útiles
    if (beneficiario.telefono) perfilData.telefono = beneficiario.telefono;
    if (beneficiario.nacionalidad)
      perfilData.nacionalidad = beneficiario.nacionalidad;
    if (beneficiario.estado_id) {
      perfilData.estado =
        beneficiario.estado_id.nombre || "Sin estado asignado";
    }

    // Asegurar que tengamos la información del género y estado civil
    if (beneficiario.genero) perfilData.genero = beneficiario.genero;
    if (beneficiario.estado_civil)
      perfilData.estado_civil = beneficiario.estado_civil;

    // IMPORTANT: Send the profile data back to the client
    res.json(perfilData);
  } catch (error) {
    console.error("Error detallado al obtener perfil de beneficiario:", error);
    res.status(500).json({
      message: "Error al obtener perfil de beneficiario",
      error: error.message,
    });
  }
});

router.get("/perfil-completo", checkAuth, isBeneficiario, async (req, res) => {
  try {
    const usuarioId = req.usuario._id;

    // Buscar al beneficiario con información completa e incluir populate para aliado_id
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId })
      .populate("estado_id")
      .populate("aliado_id", "nombre telefono"); // Añadir populate para aliado_id

    if (!beneficiario) {
      return res.status(404).json({
        message: "Perfil de beneficiario no encontrado",
        requiereLogout: true,
      });
    }

    // Obtener usuario para información completa
    const usuario = await Usuario.findById(usuarioId);

    // Priorizar el correo del beneficiario, si existe
    const correoMostrar =
      beneficiario.correo || (usuario ? usuario.correo : "");

    // Datos combinados para el frontend, incluyendo los nuevos campos
    const perfilData = {
      nombre: beneficiario.nombre || "",
      apellido: beneficiario.apellido || "",
      nombre_completo:
        `${beneficiario.nombre || ""} ${beneficiario.apellido || ""}`.trim(),
      genero: beneficiario.genero || "prefiero no decirlo",
      estado_civil: beneficiario.estado_civil || "no especificado",
      correo: correoMostrar,
      telefono: beneficiario.telefono || "",
      nacionalidad: beneficiario.nacionalidad || "",
      llave_unica_activa: beneficiario.codigo?.activo || false,
      fecha_vencimiento: beneficiario.codigo?.fecha_expiracion || null,
      estado: beneficiario.estado_id
        ? beneficiario.estado_id.nombre
        : "Sin estado asignado",
      // Nuevos campos
      fecha_nacimiento: beneficiario.fecha_nacimiento || null,
      pais: beneficiario.pais || "",
      estado_provincia: beneficiario.estado_provincia || "",
      ciudad: beneficiario.ciudad || "",
      // Información del aliado si existe
      aliado_id: beneficiario.aliado_id ? beneficiario.aliado_id._id : null,
      aliado_nombre: beneficiario.aliado_id
        ? beneficiario.aliado_id.nombre
        : null,
      aliado_telefono: beneficiario.aliado_id
        ? beneficiario.aliado_id.telefono
        : null,
    };

    console.log("Enviando datos de perfil completo con nuevos campos:", {
      ...perfilData,
      aliado_id: perfilData.aliado_id,
      aliado_nombre: perfilData.aliado_nombre,
      fecha_nacimiento: perfilData.fecha_nacimiento ? "presente" : "ausente",
      pais: perfilData.pais || "no especificado",
      estado_provincia: perfilData.estado_provincia || "no especificado",
      ciudad: perfilData.ciudad || "no especificada",
    });

    res.json(perfilData);
  } catch (error) {
    console.error("Error al obtener perfil completo:", error);
    res.status(500).json({
      message: "Error al obtener perfil completo",
      error: error.message,
    });
  }
});

router.get("/perfil/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[GET /perfil/${id}] Solicitando datos de perfil`);

    // Intentar encontrar beneficiario directamente por ID
    let beneficiario = await Beneficiario.findById(id)
      .populate("estado_id")
      .populate("sucursal")
      .populate("aliado_id");

    // Si no se encuentra como ID directo, probar buscando como usuario_id
    if (!beneficiario) {
      console.log(
        `[GET /perfil/${id}] No se encontró beneficiario directo, buscando como usuario_id`
      );
      beneficiario = await Beneficiario.findOne({ usuario_id: id })
        .populate("estado_id")
        .populate("sucursal")
        .populate("aliado_id");
    }

    let usuario = null;

    // Si es un beneficiario
    if (beneficiario) {
      console.log(`[GET /perfil/${id}] Beneficiario encontrado:`, {
        _id: beneficiario._id,
        estado_civil: beneficiario.estado_civil,
        genero: beneficiario.genero,
        pareja: beneficiario.pareja ? "presente" : "no presente", // Log para verificar
      });

      // Obtener el usuario asociado si existe
      if (beneficiario.usuario_id) {
        usuario = await Usuario.findById(beneficiario.usuario_id);
      }

      // Construir la respuesta con datos combinados
      const respuesta = {
        _id: beneficiario._id,
        tipo: "beneficiario",
        nombre: beneficiario.nombre || "",
        apellido: beneficiario.apellido || "",
        nombre_usuario: usuario ? usuario.nombre_usuario : "",
        correo: beneficiario.correo || (usuario ? usuario.correo : ""),
        telefono: beneficiario.telefono || "",
        nacionalidad: beneficiario.nacionalidad || "",
        direccion: beneficiario.direccion || "",
        // IMPORTANTE: Asegurar que estos campos se devuelvan con los valores correctos
        genero: beneficiario.genero || "prefiero no decirlo",
        estado_civil: beneficiario.estado_civil || "no especificado",
        // CAMPOS FALTANTES
        fecha_nacimiento: beneficiario.fecha_nacimiento || null,
        pais: beneficiario.pais || "",
        estado_provincia: beneficiario.estado_provincia || "",
        ciudad: beneficiario.ciudad || "",
        // IMPORTANTE: Incluir la información de pareja en la respuesta
        pareja:
          beneficiario.pareja && typeof beneficiario.pareja === "object"
            ? {
                nombre_completo: beneficiario.pareja.nombre_completo || "",
                telefono: beneficiario.pareja.telefono || "",
                correo: beneficiario.pareja.correo || "",
              }
            : null,
        // Resto de campos
        fecha_creacion: beneficiario.fecha_creacion,
        estado_id: beneficiario.estado_id ? beneficiario.estado_id._id : null,
        estado: beneficiario.estado_id
          ? beneficiario.estado_id.nombre
          : "Sin estado asignado",
        foto: beneficiario.foto || "",
        servicios: beneficiario.servicios || [],
        enganche_pagado: beneficiario.enganche_pagado || {
          valor: 0,
          moneda: "reales",
        },
        aliado_id: beneficiario.aliado_id ? beneficiario.aliado_id._id : null,
        aliado_nombre: beneficiario.aliado_id
          ? beneficiario.aliado_id.nombre
          : null,
        aliado_telefono: beneficiario.aliado_id
          ? beneficiario.aliado_id.telefono
          : null,
        sucursal: beneficiario.sucursal ? beneficiario.sucursal._id : null,
        sucursal_nombre: beneficiario.sucursal
          ? beneficiario.sucursal.nombre
          : null,
        hotel_aliado: beneficiario.hotel_aliado || "",
        aliado_sucursal: beneficiario.aliado_sucursal || "",
      };

      // Verificar que la información de pareja esté incluida antes de enviar la respuesta
      console.log(
        `[GET /perfil/${id}] Información de pareja en respuesta:`,
        respuesta.pareja
      );

      return res.json(respuesta);
    } else {
      return res.status(404).json({
        success: false,
        message: "Beneficiario no encontrado",
      });
    }
  } catch (error) {
    console.error(`[GET /perfil/${id}] Error al obtener perfil:`, error);
    res.status(500).json({
      success: false,
      message: "Error al obtener perfil",
      error: error.message,
    });
  }
});
// @route   GET /api/beneficiario/fondos/metodos-pago
// @desc    Obtener métodos de pago del beneficiario autenticado
// @access  Private (Beneficiario)
router.get(
  "/fondos/metodos-pago",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      console.log(
        "📋 [FONDOS] Obteniendo métodos de pago del beneficiario:",
        req.beneficiario._id
      );

      // Importar modelo MetodoPago
      const { MetodoPago } = await import("../models/MetodoPago.js");

      const metodos = await MetodoPago.find({
        beneficiarioId: req.beneficiario._id,
      }).sort({ fecha_creacion: -1 });

      console.log(`✅ [FONDOS] Encontrados ${metodos.length} métodos de pago`);

      res.json({
        success: true,
        metodos,
        total: metodos.length,
      });
    } catch (error) {
      console.error("❌ [FONDOS] Error al obtener métodos de pago:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
        error: error.message,
      });
    }
  }
);

router.put(
  "/api/perfil/:id/estado-civil",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { estado_civil } = req.body;

      console.log(
        `[PUT /api/perfil/${id}/estado-civil] Actualizando estado civil a: ${estado_civil}`
      );

      // Validación explícita del valor
      const estadosCivilValidos = [
        "soltero",
        "casado",
        "divorciado",
        "viudo",
        "no especificado",
      ];
      if (!estado_civil || !estadosCivilValidos.includes(estado_civil)) {
        console.log(
          `[PUT /api/perfil/${id}/estado-civil] Error: Valor inválido para estado_civil: ${estado_civil}`
        );
        return res.status(400).json({
          success: false,
          message: `Valor para estado_civil no válido. Debe ser uno de: ${estadosCivilValidos.join(", ")}`,
        });
      }

      // Buscar beneficiario
      const beneficiario = await Beneficiario.findById(id);
      if (!beneficiario) {
        console.log(
          `[PUT /api/perfil/${id}/estado-civil] Error: Beneficiario no encontrado`
        );
        return res.status(404).json({
          success: false,
          message: "Beneficiario no encontrado",
        });
      }

      console.log(
        `[PUT /api/perfil/${id}/estado-civil] Beneficiario encontrado. Valor actual: ${beneficiario.estado_civil}`
      );

      // Actualizar estado_civil
      beneficiario.estado_civil = estado_civil;

      // Guardar cambios
      await beneficiario.save();

      console.log(
        `[PUT /api/perfil/${id}/estado-civil] Cambios guardados correctamente. Nuevo valor: ${beneficiario.estado_civil}`
      );

      // Verificar que se guardó correctamente
      const beneficiarioActualizado = await Beneficiario.findById(id);
      console.log(
        `[PUT /api/perfil/${id}/estado-civil] Verificación - Valor en DB: ${beneficiarioActualizado.estado_civil}`
      );

      // Responder con los datos actualizados
      return res.json({
        success: true,
        message: "Estado civil actualizado correctamente",
        estado_civil: beneficiarioActualizado.estado_civil,
      });
    } catch (error) {
      console.error(`[PUT /api/perfil/${id}/estado-civil] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar estado civil",
        error: error.message,
      });
    }
  }
);

// Problema clave: Los campos deben estar expresamente permitidos en las rutas

router.put("/perfil/:id", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const datosActualizacion = req.body;

    console.log(`[PUT /perfil/${id}] Datos recibidos RAW:`, req.body);
    console.log(
      `[PUT /perfil/${id}] Content-Type:`,
      req.headers["content-type"]
    );
    console.log(`[PUT /perfil/${id}] Keys en body:`, Object.keys(req.body));

    // CORRECCIÓN: Verificar si hay datos, incluso si algunos son undefined/null
    const tieneAlgunDato = Object.keys(datosActualizacion).length > 0;

    if (!tieneAlgunDato) {
      console.log(`[PUT /perfil/${id}] Error: No hay keys en el body`);
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron datos para actualizar",
        received_keys: Object.keys(datosActualizacion),
        body_raw: req.body,
      });
    }

    // Buscar beneficiario
    let beneficiario = await Beneficiario.findById(id);

    if (!beneficiario) {
      console.log(`[PUT /perfil/${id}] Error: No se encontró beneficiario`);
      return res.status(404).json({
        success: false,
        message: "Beneficiario no encontrado",
      });
    }

    // CORRECCIÓN: Lista ampliada de campos permitidos
    const camposPermitidos = [
      "nombre",
      "apellido",
      "telefono",
      "nacionalidad",
      "direccion",
      "genero",
      "estado_civil",
      "departamento",
      "aliado_id",
      "sucursal",
      "hotel_aliado",
      "aliado_sucursal",
      "correo",
      "pais",
      "estado_provincia",
      "ciudad",
      "pareja",
      "fecha_nacimiento",
    ];

    let actualizado = false;
    let camposActualizados = [];

    // CORRECCIÓN: Procesar cada campo incluso si el valor es null/empty
    for (const campo of camposPermitidos) {
      if (datosActualizacion.hasOwnProperty(campo)) {
        console.log(
          `[PUT /perfil/${id}] Procesando campo '${campo}': ${beneficiario[campo]} → ${datosActualizacion[campo]}`
        );

        // Validaciones específicas
        if (campo === "estado_civil") {
          const estadosCivilValidos = [
            "soltero",
            "casado",
            "divorciado",
            "viudo",
            "no especificado",
          ];
          if (
            datosActualizacion[campo] &&
            !estadosCivilValidos.includes(datosActualizacion[campo])
          ) {
            return res.status(400).json({
              success: false,
              message: `Valor para estado_civil no válido. Debe ser uno de: ${estadosCivilValidos.join(", ")}`,
            });
          }
        }

        if (campo === "genero") {
          const generosValidos = [
            "masculino",
            "femenino",
            "prefiero no decirlo",
          ];
          if (
            datosActualizacion[campo] &&
            !generosValidos.includes(datosActualizacion[campo])
          ) {
            return res.status(400).json({
              success: false,
              message: `Valor para genero no válido. Debe ser uno de: ${generosValidos.join(", ")}`,
            });
          }
        }

        // CORRECCIÓN: Manejar pareja como objeto especial
        if (campo === "pareja") {
          if (datosActualizacion[campo] === null) {
            beneficiario.pareja = null;
          } else if (typeof datosActualizacion[campo] === "object") {
            if (!beneficiario.pareja) {
              beneficiario.pareja = {};
            }
            Object.assign(beneficiario.pareja, datosActualizacion[campo]);
            beneficiario.markModified("pareja");
          }
        } else {
          // Actualizar campo normal
          beneficiario[campo] = datosActualizacion[campo];
        }

        // CORRECCIÓN: Sincronizar campos relacionados
        if (campo === "aliado_id") {
          beneficiario.hotel_aliado = datosActualizacion[campo];
        } else if (campo === "hotel_aliado") {
          beneficiario.aliado_id = datosActualizacion[campo];
        }

        if (campo === "sucursal") {
          beneficiario.aliado_sucursal = datosActualizacion[campo];
        } else if (campo === "aliado_sucursal") {
          beneficiario.sucursal = datosActualizacion[campo];
        }

        actualizado = true;
        camposActualizados.push(campo);
      }
    }

    // Si se actualizó el correo, también actualizar en Usuario
    if (datosActualizacion.correo && beneficiario.usuario_id) {
      try {
        const usuario = await Usuario.findById(beneficiario.usuario_id);
        if (usuario) {
          usuario.correo = datosActualizacion.correo;
          await usuario.save();
          console.log(`[PUT /perfil/${id}] Correo actualizado en usuario`);
        }
      } catch (err) {
        console.error(
          `[PUT /perfil/${id}] Error al actualizar correo en usuario:`,
          err
        );
      }
    }

    if (actualizado) {
      console.log(
        `[PUT /perfil/${id}] Guardando cambios. Campos actualizados:`,
        camposActualizados
      );

      await beneficiario.save();

      // Verificar cambios
      const beneficiarioActualizado = await Beneficiario.findById(id);

      console.log(`[PUT /perfil/${id}] Cambios guardados exitosamente`);

      return res.json({
        success: true,
        message: "Perfil actualizado correctamente",
        campos_actualizados: camposActualizados,
        // Incluir algunos campos en la respuesta para confirmar
        aliado_id: beneficiarioActualizado.aliado_id,
        hotel_aliado: beneficiarioActualizado.hotel_aliado,
        sucursal: beneficiarioActualizado.sucursal,
        aliado_sucursal: beneficiarioActualizado.aliado_sucursal,
        pareja: beneficiarioActualizado.pareja,
      });
    } else {
      console.log(`[PUT /perfil/${id}] No se realizaron cambios`);
      return res.status(400).json({
        success: false,
        message: "No se realizaron cambios en el perfil",
        received_fields: Object.keys(datosActualizacion),
        allowed_fields: camposPermitidos,
      });
    }
  } catch (error) {
    console.error(`[PUT /perfil/${id}] Error:`, error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar perfil",
      error: error.message,
    });
  }
});
// Obtener información administrativa del beneficiario
router.get("/:beneficiarioId/administrativa", checkAuth, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;

    console.log(
      `[ADMINISTRATIVA] Solicitando info administrativa para: ${beneficiarioId}`
    );

    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      console.log(`[ADMINISTRATIVA] ID inválido: ${beneficiarioId}`);
      return res.status(400).json({
        success: false,
        mensaje: "ID de beneficiario inválido",
      });
    }

    // CORRECCIÓN: Buscar por _id directamente O por usuario_id
    let beneficiario = await Beneficiario.findById(beneficiarioId).lean();

    if (!beneficiario) {
      console.log(
        `[ADMINISTRATIVA] No encontrado por _id, buscando por usuario_id: ${beneficiarioId}`
      );
      // Si no se encuentra por _id, buscar por usuario_id
      beneficiario = await Beneficiario.findOne({
        usuario_id: beneficiarioId,
      }).lean();
    }

    if (!beneficiario) {
      console.log(
        `[ADMINISTRATIVA] Beneficiario no encontrado para ID: ${beneficiarioId}`
      );
      return res.status(404).json({
        success: false,
        mensaje: "Beneficiario no encontrado",
      });
    }

    console.log(
      `[ADMINISTRATIVA] Beneficiario encontrado: ${beneficiario._id}`
    );

    const infoAdministrativa = {
      _id: beneficiario._id,
      director: beneficiario.director || "",
      gerente: beneficiario.gerente || "",
      cerrador: beneficiario.cerrador || "",
      colaborador_bnp: beneficiario.colaborador_bnp || "",
      idioma_preferencia: beneficiario.idioma_preferencia || "esp",
      fecha_registro: beneficiario.fecha_registro,
      monto_venta: beneficiario.monto_venta || 0,
      departamento: beneficiario.departamento || "",
      vigencia_membresia_anos: beneficiario.vigencia_membresia_anos || 1,
    };

    res.json({
      success: true,
      beneficiario: infoAdministrativa,
    });
  } catch (error) {
    console.error(
      "[Beneficiario] Error al obtener información administrativa:",
      error
    );
    res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});

// Obtener información de pareja del beneficiario
router.get("/:beneficiarioId/pareja", checkAuth, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;

    console.log(`[PAREJA] Solicitando info de pareja para: ${beneficiarioId}`);

    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de beneficiario inválido",
      });
    }

    // CORRECCIÓN: Buscar por _id directamente O por usuario_id
    let beneficiario = await Beneficiario.findById(beneficiarioId)
      .select("pareja")
      .lean();

    if (!beneficiario) {
      console.log(
        `[PAREJA] No encontrado por _id, buscando por usuario_id: ${beneficiarioId}`
      );
      beneficiario = await Beneficiario.findOne({ usuario_id: beneficiarioId })
        .select("pareja")
        .lean();
    }

    if (!beneficiario) {
      console.log(
        `[PAREJA] Beneficiario no encontrado para ID: ${beneficiarioId}`
      );
      return res.status(404).json({
        success: false,
        mensaje: "Beneficiario no encontrado",
      });
    }

    console.log(`[PAREJA] Beneficiario encontrado, enviando info de pareja`);

    res.json({
      success: true,
      pareja: beneficiario.pareja || null,
    });
  } catch (error) {
    console.error(
      "[Beneficiario] Error al obtener información de pareja:",
      error
    );
    res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});
// Ruta específica para obtener información del reembolso
router.get(
  "/reembolsos/beneficiarios/perfil-reembolso",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const usuarioId = req.usuario._id;

      // Obtenemos el beneficiario
      const beneficiario =
        req.beneficiario ||
        (await Beneficiario.findOne({ usuario_id: usuarioId }));

      if (!beneficiario) {
        return res.status(404).json({
          exito: false,
          mensaje: "Beneficiario no encontrado",
          requiereLogout: true,
        });
      }

      // Verificar si existe un código
      if (!beneficiario.codigo) {
        return res.status(200).json({
          exito: true,
          mensaje: "El beneficiario no tiene código de reembolso asignado",
          codigo: null,
        });
      }

      // Determinar si el código está expirado
      const fechaExpiracion = beneficiario.codigo.fecha_expiracion;
      const expirado =
        fechaExpiracion && new Date(fechaExpiracion) < new Date();

      // Calcular tiempo restante si hay fecha de expiración y no está expirado
      let tiempoRestante = null;
      if (fechaExpiracion && !expirado) {
        const ahora = new Date();
        const expiracion = new Date(fechaExpiracion);
        const diferencia = expiracion - ahora;

        // Convertir milisegundos a formato legible
        const segundosTotales = Math.floor(diferencia / 1000);
        const dias = Math.floor(segundosTotales / 86400);
        const horas = Math.floor((segundosTotales % 86400) / 3600);
        const minutos = Math.floor((segundosTotales % 3600) / 60);

        tiempoRestante = { dias, horas, minutos };
      }

      // Asegurarse de que haya información de reembolso
      let montoReembolso = beneficiario.codigo.monto;

      // Si no hay monto pero sí prima pagada, calculamos el reembolso (5.75%)
      if (
        (!montoReembolso || !montoReembolso.valor) &&
        beneficiario.codigo.primaPagada
      ) {
        const montoCalculado = beneficiario.codigo.primaPagada * 0.0575;
        montoReembolso = {
          valor: montoCalculado,
          moneda: "USD",
        };

        // Actualizamos el beneficiario con este monto
        if (!beneficiario.codigo.monto) {
          beneficiario.codigo.monto = montoReembolso;
        } else {
          beneficiario.codigo.monto.valor = montoCalculado;
        }
        await beneficiario.save();
      }

      // Preparar respuesta
      const respuesta = {
        exito: true,
        codigo: {
          codigo: beneficiario.codigo.value || beneficiario.llave_unica,
          activo: beneficiario.codigo.activo || false,
          estado: beneficiario.codigo.estado_activacion || "PENDIENTE",
          fecha_creacion: beneficiario.codigo.fecha_creacion,
          fecha_activacion: beneficiario.codigo.fecha_activacion,
          fecha_expiracion: fechaExpiracion,
          primaPagada: beneficiario.codigo.primaPagada || 0,
          monto: montoReembolso || { valor: 0, moneda: "USD" },
          motivoCancelacion: beneficiario.codigo.motivoCancelacion,
        },
        expirado,
        tiempoRestante,
      };

      res.status(200).json(respuesta);
    } catch (error) {
      console.error("Error al obtener información de reembolso:", error);
      res.status(500).json({
        exito: false,
        mensaje: "Error al obtener información de reembolso",
        error: error.message,
      });
    }
  }
);

// Ruta para actualizar el monto de reembolso desde el perfil del beneficiario
router.post(
  "/reembolsos/actualizar-monto",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      const usuarioId = req.usuario._id;
      const { monto, moneda = "USD" } = req.body;

      if (!monto || isNaN(parseFloat(monto))) {
        return res.status(400).json({
          exito: false,
          mensaje: "El monto debe ser un valor numérico válido",
        });
      }

      // Obtenemos el beneficiario
      const beneficiario =
        req.beneficiario ||
        (await Beneficiario.findOne({ usuario_id: usuarioId }));

      if (!beneficiario) {
        return res.status(404).json({
          exito: false,
          mensaje: "Beneficiario no encontrado",
        });
      }

      // Crear estructura de código si no existe
      if (!beneficiario.codigo) {
        beneficiario.codigo = {
          activo: true,
          fecha_creacion: new Date(),
        };
      }

      // Actualizar el monto
      const montoNumerico = parseFloat(monto);

      if (!beneficiario.codigo.monto) {
        beneficiario.codigo.monto = {
          valor: montoNumerico,
          moneda: moneda,
        };
      } else {
        beneficiario.codigo.monto.valor = montoNumerico;
        beneficiario.codigo.monto.moneda = moneda;
      }

      // Guardar cambios
      await beneficiario.save();

      res.status(200).json({
        exito: true,
        mensaje: "Monto de reembolso actualizado correctamente",
        monto: beneficiario.codigo.monto,
      });
    } catch (error) {
      console.error("Error al actualizar monto de reembolso:", error);
      res.status(500).json({
        exito: false,
        mensaje: "Error al actualizar monto de reembolso",
        error: error.message,
      });
    }
  }
);
// @route   PUT /api/beneficiario/fondos/metodos-pago/:id
// @desc    Actualizar un método de pago existente
// @access  Private (Beneficiario)
router.put(
  "/fondos/metodos-pago/:id",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      console.log("📝 [FONDOS] Actualizando método de pago:", req.params.id);
      const { nombre, informacion_bancaria } = req.body;

      // Importar modelo MetodoPago
      const { MetodoPago } = await import("../models/MetodoPago.js");

      const metodo = await MetodoPago.findOne({
        _id: req.params.id,
        beneficiarioId: req.beneficiario._id,
      });

      if (!metodo) {
        return res.status(404).json({
          success: false,
          mensaje: "Método de pago no encontrado",
        });
      }

      if (nombre) metodo.nombre = nombre.trim();
      if (informacion_bancaria) {
        metodo.informacion_bancaria = {
          ...metodo.informacion_bancaria,
          ...informacion_bancaria,
        };
      }
      metodo.actualizado_por = req.usuario._id;
      metodo.fecha_actualizacion = new Date();

      const metodoActualizado = await metodo.save();

      console.log("✅ [FONDOS] Método actualizado exitosamente");

      res.json({
        success: true,
        mensaje: "Método de pago actualizado exitosamente",
        metodo: {
          _id: metodoActualizado._id,
          nombre: metodoActualizado.nombre,
          tipo_cuenta: metodoActualizado.tipo_cuenta,
          informacion_bancaria: metodoActualizado.informacion_bancaria,
          activo: metodoActualizado.activo,
        },
      });
    } catch (error) {
      console.error("❌ [FONDOS] Error al actualizar método de pago:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
        error: error.message,
      });
    }
  }
);
router.put("/:beneficiarioId/administrativa", checkAuth, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const datosActualizacion = req.body;

    console.log(`[ADMINISTRATIVA] Actualizando info para: ${beneficiarioId}`);
    console.log(`[ADMINISTRATIVA] Datos a actualizar:`, datosActualizacion);

    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de beneficiario inválido",
      });
    }

    // Validaciones específicas
    if (datosActualizacion.vigencia_membresia_anos) {
      const vigencia = parseInt(datosActualizacion.vigencia_membresia_anos);
      if (vigencia < 1 || vigencia > 99) {
        return res.status(400).json({
          success: false,
          mensaje: "La vigencia de membresía debe estar entre 1 y 99 años",
        });
      }
      datosActualizacion.vigencia_membresia_anos = vigencia;
    }

    if (datosActualizacion.monto_venta) {
      datosActualizacion.monto_venta =
        parseFloat(datosActualizacion.monto_venta) || 0;
    }

    // CORRECCIÓN: Buscar por _id directamente O por usuario_id y actualizar
    let beneficiarioActualizado = await Beneficiario.findByIdAndUpdate(
      beneficiarioId,
      { $set: datosActualizacion },
      { new: true, runValidators: true }
    );

    if (!beneficiarioActualizado) {
      console.log(
        `[ADMINISTRATIVA] No encontrado por _id, buscando por usuario_id: ${beneficiarioId}`
      );
      // Si no se encuentra por _id, buscar por usuario_id
      beneficiarioActualizado = await Beneficiario.findOneAndUpdate(
        { usuario_id: beneficiarioId },
        { $set: datosActualizacion },
        { new: true, runValidators: true }
      );
    }

    if (!beneficiarioActualizado) {
      console.log(
        `[ADMINISTRATIVA] Beneficiario no encontrado para actualizar: ${beneficiarioId}`
      );
      return res.status(404).json({
        success: false,
        mensaje: "Beneficiario no encontrado",
      });
    }

    console.log(
      `[ADMINISTRATIVA] Información actualizada correctamente para: ${beneficiarioActualizado._id}`
    );

    res.json({
      success: true,
      mensaje: "Información administrativa actualizada correctamente",
      beneficiario: beneficiarioActualizado,
    });
  } catch (error) {
    console.error(
      "[Beneficiario] Error al actualizar información administrativa:",
      error
    );
    res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});
// Actualizar información de pareja
router.put("/:beneficiarioId/pareja", checkAuth, async (req, res) => {
  try {
    const { beneficiarioId } = req.params;
    const datosPareja = req.body;

    console.log(`[PAREJA] Actualizando info de pareja para: ${beneficiarioId}`);
    console.log(`[PAREJA] Datos de pareja:`, datosPareja);

    if (!mongoose.Types.ObjectId.isValid(beneficiarioId)) {
      return res.status(400).json({
        success: false,
        mensaje: "ID de beneficiario inválido",
      });
    }

    // CORRECCIÓN: Buscar por _id directamente O por usuario_id y actualizar
    let beneficiarioActualizado = await Beneficiario.findByIdAndUpdate(
      beneficiarioId,
      { $set: { pareja: datosPareja } },
      { new: true, runValidators: true }
    );

    if (!beneficiarioActualizado) {
      console.log(
        `[PAREJA] No encontrado por _id, buscando por usuario_id: ${beneficiarioId}`
      );
      beneficiarioActualizado = await Beneficiario.findOneAndUpdate(
        { usuario_id: beneficiarioId },
        { $set: { pareja: datosPareja } },
        { new: true, runValidators: true }
      );
    }

    if (!beneficiarioActualizado) {
      console.log(
        `[PAREJA] Beneficiario no encontrado para actualizar: ${beneficiarioId}`
      );
      return res.status(404).json({
        success: false,
        mensaje: "Beneficiario no encontrado",
      });
    }

    console.log(`[PAREJA] Información de pareja actualizada correctamente`);

    res.json({
      success: true,
      mensaje: "Información de pareja actualizada correctamente",
      pareja: beneficiarioActualizado.pareja,
    });
  } catch (error) {
    console.error(
      "[Beneficiario] Error al actualizar información de pareja:",
      error
    );
    res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});

router.put(
  "/api/beneficiario/perfil/:id",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { id } = req.params;
      const datosActualizacion = req.body;

      console.log(
        `[PUT /api/beneficiario/perfil/${id}] Datos recibidos para actualización:`,
        datosActualizacion
      );

      // Buscar el beneficiario
      const beneficiario = await Beneficiario.findById(id);

      if (!beneficiario) {
        return res.status(404).json({
          success: false,
          message: "Beneficiario no encontrado",
        });
      }

      // Lista ampliada de campos para actualizar
      const camposPermitidos = [
        "nombre",
        "apellido",
        "telefono",
        "nacionalidad",
        "direccion",
        "genero",
        "estado_civil",
        "departamento",
        "aliado_id",
        "sucursal",
        "hotel_aliado",
        "aliado_sucursal",
        "correo",
        "pais",
        "estado_provincia",
        "ciudad",
        "pareja",
      ];
      // Actualizar cada campo permitido
      let actualizado = false;

      for (const campo of camposPermitidos) {
        if (datosActualizacion[campo] !== undefined) {
          // Log para depurar
          console.log(
            `[PUT /api/beneficiario/perfil/${id}] Actualizando campo '${campo}': `,
            typeof beneficiario[campo] === "object"
              ? "Objeto complejo"
              : `${beneficiario[campo]} → ${datosActualizacion[campo]}`
          );
          if (campo === "pareja") {
            console.log(
              `[PUT /perfil/${id}] Actualizando campo pareja:`,
              datosActualizacion.pareja
            );
            beneficiario.pareja = datosActualizacion.pareja;
          } else {
            beneficiario[campo] = datosActualizacion[campo];
          }
          actualizado = true;
          // Actualizar el campo
          beneficiario[campo] = datosActualizacion[campo];
          actualizado = true;
        }
      }

      if (actualizado) {
        // Guardar cambios
        await beneficiario.save();

        // Verificar que se guardaron correctamente
        const beneficiarioActualizado = await Beneficiario.findById(id);

        console.log(
          `[PUT /api/beneficiario/perfil/${id}] Verificación de campos actualizados:`,
          {
            fecha_nacimiento: beneficiarioActualizado.fecha_nacimiento,
            pais: beneficiarioActualizado.pais,
            estado_provincia: beneficiarioActualizado.estado_provincia,
            ciudad: beneficiarioActualizado.ciudad,
          }
        );

        return res.json({
          success: true,
          message: "Perfil actualizado correctamente",
          // Incluir en la respuesta los campos actualizados
          fecha_nacimiento: beneficiarioActualizado.fecha_nacimiento,
          pais: beneficiarioActualizado.pais,
          estado_provincia: beneficiarioActualizado.estado_provincia,
          ciudad: beneficiarioActualizado.ciudad,
        });
      }

      return res.status(400).json({
        success: false,
        message: "No se realizaron cambios en el perfil",
      });
    } catch (error) {
      console.error(`[PUT /api/beneficiario/perfil/${id}] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar perfil",
        error: error.message,
      });
    }
  }
);
router.put("/:id/pareja", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;
    const parejaData = req.body;

    console.log(
      `[PUT /beneficiario/${id}/pareja] Actualizando pareja:`,
      parejaData
    );

    // Validar formato del ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de beneficiario inválido",
      });
    }

    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(id);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        message: "Beneficiario no encontrado",
      });
    }

    // CORRECCIÓN: Manejar correctamente los datos de pareja
    if (parejaData === null || parejaData === undefined) {
      console.log(
        `[PUT /beneficiario/${id}/pareja] Eliminando información de pareja`
      );
      beneficiario.pareja = null;
    } else if (typeof parejaData === "object") {
      console.log(
        `[PUT /beneficiario/${id}/pareja] Actualizando pareja con datos:`,
        parejaData
      );

      // CORRECCIÓN: Inicializar pareja como objeto vacío si no existe
      if (!beneficiario.pareja || typeof beneficiario.pareja !== "object") {
        beneficiario.pareja = {};
      }

      // Actualizar solo los campos proporcionados
      if (parejaData.nombre_completo !== undefined) {
        beneficiario.pareja.nombre_completo = parejaData.nombre_completo;
      }
      if (parejaData.telefono !== undefined) {
        beneficiario.pareja.telefono = parejaData.telefono;
      }
      if (parejaData.correo !== undefined) {
        beneficiario.pareja.correo = parejaData.correo;
      }
    }

    // CORRECCIÓN: Marcar el campo como modificado para que MongoDB lo guarde
    beneficiario.markModified("pareja");

    // Guardar los cambios
    await beneficiario.save();

    // CORRECCIÓN: Recuperar el beneficiario actualizado para confirmar los cambios
    const beneficiarioActualizado = await Beneficiario.findById(id);

    console.log(
      `[PUT /beneficiario/${id}/pareja] Datos guardados correctamente:`,
      beneficiarioActualizado.pareja
    );

    return res.json({
      success: true,
      message: "Información de pareja actualizada correctamente",
      pareja: beneficiarioActualizado.pareja || null,
    });
  } catch (error) {
    console.error(`[PUT /beneficiario/${id}/pareja] Error:`, error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar información de pareja",
      error: error.message,
    });
  }
});

// Ruta para verificar si existe un beneficiario
router.get("/verificar", checkAuth, async (req, res) => {
  try {
    // Verificar que el usuario tenga tipo beneficiario
    if (req.usuario.tipo !== "beneficiario") {
      return res.status(403).json({
        message:
          "Solo usuarios de tipo beneficiario pueden acceder a esta ruta",
      });
    }

    const usuarioId = req.usuario._id;

    // Verificar si ya existe un beneficiario para este usuario
    const beneficiarioExistente = await Beneficiario.findOne({
      $or: [{ usuario_id: usuarioId }, { usuario_id: usuarioId.toString() }],
    });

    if (beneficiarioExistente) {
      console.log(
        "Beneficiario encontrado para usuario:",
        req.usuario.nombre_usuario
      );
      return res.status(200).json({
        exists: true,
        message: "Beneficiario encontrado",
        beneficiarioId: beneficiarioExistente._id,
      });
    }

    console.log(
      "Beneficiario NO encontrado para usuario:",
      req.usuario.nombre_usuario
    );

    // Si no existe, devolver false
    res.status(404).json({
      exists: false,
      message: "No se encontró un perfil de beneficiario para este usuario",
      requiereLogout: true,
    });
  } catch (error) {
    console.error("Error al verificar beneficiario:", error);
    res.status(500).json({
      message: "Error al verificar si existe un beneficiario",
      error: error.message,
    });
  }
});

// Obtener lista de certificados aéreos disponibles
router.get("/certificados", checkAuth, isBeneficiario, async (req, res) => {
  try {
    // Obtener ID del usuario autenticado
    const usuarioId = req.usuario._id;

    // Buscar al beneficiario relacionado con este usuario
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });

    if (!beneficiario) {
      return res.status(404).json({ message: "Beneficiario no encontrado" });
    }

    // Aquí puedes definir la lógica para obtener los certificados aéreos
    // Por ahora, enviaremos datos de ejemplo
    const certificados = [
      {
        id: "1",
        tipo: "Certificado Nacional",
        fecha_emision: new Date(),
        fecha_vencimiento: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ),
        estado: "Activo",
      },
      {
        id: "2",
        tipo: "Certificado Internacional",
        fecha_emision: new Date(new Date().setMonth(new Date().getMonth() - 2)),
        fecha_vencimiento: new Date(
          new Date().setMonth(new Date().getMonth() + 10)
        ),
        estado: "Activo",
      },
    ];

    res.json(certificados);
  } catch (error) {
    console.error("Error al obtener certificados:", error);
    res.status(500).json({ message: "Error al obtener certificados" });
  }
});

// Ver lista de beneficios disponibles
router.get("/beneficios", checkAuth, isBeneficiario, async (req, res) => {
  try {
    // Obtener beneficios genéricos o específicos para el beneficiario
    // Estos podrían ser de una colección diferente o hardcoded para empezar

    const beneficios = [
      {
        id: "1",
        titulo: "Pase de movilidad activo",
        descripcion: "Acceso a transporte en hoteles y resorts asociados",
        activo: true,
      },
      {
        id: "2",
        titulo: "Acceso VIP a salones ejecutivos",
        descripcion: "En aeropuertos internacionales seleccionados",
        activo: true,
      },
      {
        id: "3",
        titulo: "Programa de acumulación de puntos",
        descripcion: "Por cada estadía o vuelo reservado a través de aliados",
        activo: true,
      },
    ];

    res.json(beneficios);
  } catch (error) {
    console.error("Error al obtener beneficios:", error);
    res.status(500).json({ message: "Error al obtener beneficios" });
  }
});

router.get("/servicios-activos", checkAuth, async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado
    const usuarioId = req.usuario.id || req.usuario._id;

    console.log("Obteniendo servicios activos para usuario:", usuarioId);

    // Buscar el perfil de beneficiario asociado al usuario
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });

    if (!beneficiario) {
      console.log(
        "No se encontró perfil de beneficiario para usuario ID:",
        usuarioId
      );
      return res.status(404).json({
        mensaje: "Perfil de beneficiario no encontrado",
      });
    }

    console.log("Beneficiario encontrado:", {
      id: beneficiario._id,
      servicios: beneficiario.servicios || [],
    });

    // Verificar si hay servicios en el perfil
    if (!beneficiario.servicios || !Array.isArray(beneficiario.servicios)) {
      return res.json([]);
    }

    // Devolver el array de IDs de servicios
    res.json(beneficiario.servicios);
  } catch (error) {
    console.error("Error al obtener servicios activos:", error);
    res.status(500).json({
      mensaje: "Error al obtener servicios activos",
      error: error.message,
    });
  }
});
// Ruta para solicitar soporte o crear tickets específicos de beneficiario
router.post("/soporte", checkAuth, isBeneficiario, async (req, res) => {
  try {
    // Lógica para crear un nuevo ticket desde la sección del beneficiario
    // Puedes utilizar tu modelo Ticket existente

    res
      .status(201)
      .json({ message: "Solicitud de soporte creada exitosamente" });
  } catch (error) {
    console.error("Error al crear solicitud de soporte:", error);
    res.status(500).json({ message: "Error al crear solicitud de soporte" });
  }
});

// Ruta para actualizar información de contacto del beneficiario
// Actualizar la ruta para manejar la actualización del estado civil
// Actualización de la ruta PUT /actualizar-perfil para incluir los nuevos campos
router.put(
  "/actualizar-perfil",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      // Obtener ID del usuario autenticado del middleware
      const usuarioId = req.usuario._id;

      // Extraer datos del body incluyendo nuevos campos
      const {
        telefono,
        correo,
        estado_civil,
        direccion,
        pais,
        estado_provincia,
        ciudad,
      } = req.body;

      if (
        !telefono &&
        !correo &&
        !estado_civil &&
        !direccion &&
        !pais &&
        !estado_provincia &&
        !ciudad
      ) {
        return res
          .status(400)
          .json({ message: "Se requiere al menos un campo para actualizar" });
      }

      // Buscar al beneficiario asociado con este usuario
      const beneficiario = await Beneficiario.findOne({
        usuario_id: usuarioId,
      });

      if (!beneficiario) {
        return res
          .status(404)
          .json({ message: "Perfil de beneficiario no encontrado" });
      }

      // Actualizar campos si se proporcionan
      if (telefono) {
        beneficiario.telefono = telefono;
      }

      if (direccion) {
        beneficiario.direccion = direccion;
      }

      if (pais) {
        beneficiario.pais = pais;
      }

      if (estado_provincia) {
        beneficiario.estado_provincia = estado_provincia;
      }

      if (ciudad) {
        beneficiario.ciudad = ciudad;
      }

      if (estado_civil) {
        // Validar que el estado civil sea válido
        const estadosCiviles = [
          "soltero",
          "casado",
          "divorciado",
          "viudo",
          "no especificado",
        ];
        if (estadosCiviles.includes(estado_civil)) {
          beneficiario.estado_civil = estado_civil;
        } else {
          return res.status(400).json({
            message:
              "Estado civil no válido. Debe ser: soltero, casado, divorciado, viudo o no especificado",
          });
        }
      }

      // Si se proporciona correo, actualizarlo en ambos modelos
      if (correo) {
        // Actualizar el correo en el beneficiario
        beneficiario.correo = correo;
      }

      // Guardar cambios en el beneficiario
      await beneficiario.save();

      // Actualizar correo en el modelo de Usuario si se proporciona
      if (correo) {
        const usuario = await Usuario.findById(usuarioId);
        if (usuario) {
          usuario.correo = correo;
          await usuario.save();
        }
      }

      // Preparar respuesta con datos actualizados, incluidos los nuevos campos
      const perfilActualizado = {
        nombre: beneficiario.nombre || "",
        apellido: beneficiario.apellido || "",
        correo: correo || req.usuario.correo,
        telefono: beneficiario.telefono,
        llave_unica_activa: beneficiario.codigo?.activo || false,
        fecha_vencimiento: beneficiario.codigo?.fecha_expiracion || null,
        nacionalidad: beneficiario.nacionalidad || "",
        genero: beneficiario.genero || "prefiero no decirlo",
        estado_civil: beneficiario.estado_civil || "no especificado",
        direccion: beneficiario.direccion || "",
        // Nuevos campos
        pais: beneficiario.pais || "",
        estado_provincia: beneficiario.estado_provincia || "",
        ciudad: beneficiario.ciudad || "",
        // Fecha de nacimiento (solo lectura, no se actualiza desde aquí)
        fecha_nacimiento: beneficiario.fecha_nacimiento,
      };

      res.json(perfilActualizado);
    } catch (error) {
      console.error("Error al actualizar perfil de beneficiario:", error);
      res
        .status(500)
        .json({ message: "Error al actualizar perfil de beneficiario" });
    }
  }
);
// GET - Obtener documentos del beneficiario
router.get("/documentos", checkAuth, isBeneficiario, async (req, res) => {
  try {
    // Obtener ID del usuario autenticado del middleware
    const usuarioId = req.usuario._id;

    // Buscar al beneficiario asociado con este usuario
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });

    if (!beneficiario) {
      return res
        .status(404)
        .json({ message: "Perfil de beneficiario no encontrado" });
    }

    // Verificar si existe el modelo DocumentoViaje
    let documentos = [];

    try {
      // Si tienes un modelo separado para DocumentoViaje
      const DocumentoViaje = mongoose.model("DocumentoViaje");
      documentos = await DocumentoViaje.find({
        beneficiario_id: beneficiario._id,
      });
    } catch (error) {
      // Si no existe el modelo, verificar si los documentos están en el modelo de Beneficiario
      if (
        beneficiario.documentos_viaje &&
        Array.isArray(beneficiario.documentos_viaje)
      ) {
        documentos = beneficiario.documentos_viaje;
      } else {
        // Si no hay documentos, devolver array vacío
        documentos = [];
      }
    }

    res.json(documentos);
  } catch (error) {
    console.error("Error al obtener documentos de viaje:", error);
    res.status(500).json({ message: "Error al obtener documentos de viaje" });
  }
});

// POST - Crear nuevo documento de viaje
router.post("/documentos", checkAuth, isBeneficiario, async (req, res) => {
  try {
    // Obtener ID del usuario autenticado del middleware
    const usuarioId = req.usuario._id;

    // Buscar al beneficiario asociado con este usuario
    const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });

    if (!beneficiario) {
      return res
        .status(404)
        .json({ message: "Perfil de beneficiario no encontrado" });
    }

    // Extraer datos del documento
    const { tipo, numero, nombre, fecha_emision, fecha_vencimiento, pais } =
      req.body;

    // Validar datos mínimos requeridos
    if (!tipo) {
      return res
        .status(400)
        .json({ message: "El tipo de documento es requerido" });
    }

    // Validar que si es tipo "Otro", debe tener nombre
    if (tipo === "Otro" && !nombre) {
      return res
        .status(400)
        .json({
          message: 'El nombre del documento es requerido para tipo "Otro"',
        });
    }

    // Validar que si no es tipo "Otro", debe tener número
    if (tipo !== "Otro" && !numero) {
      return res
        .status(400)
        .json({ message: "El número de documento es requerido" });
    }

    // Crear nuevo documento
    let nuevoDocumento;
    let documentoGuardado;

    try {
      // Intentar usar el modelo DocumentoViaje si existe
      const DocumentoViaje = mongoose.model("DocumentoViaje");

      nuevoDocumento = new DocumentoViaje({
        beneficiario_id: beneficiario._id,
        tipo,
        numero: tipo !== "Otro" ? numero : "",
        nombre: tipo === "Otro" ? nombre : "",
        fecha_emision,
        fecha_vencimiento,
        pais,
      });

      documentoGuardado = await nuevoDocumento.save();
    } catch (error) {
      // Si no existe el modelo DocumentoViaje, agregar al array de documentos del beneficiario

      // Asegurarse de que exista el array de documentos
      if (!beneficiario.documentos_viaje) {
        beneficiario.documentos_viaje = [];
      }

      // Crear nuevo documento como objeto simple
      nuevoDocumento = {
        id: new mongoose.Types.ObjectId().toString(), // Generar ID único
        tipo,
        numero: tipo !== "Otro" ? numero : "",
        nombre: tipo === "Otro" ? nombre : "",
        fecha_emision,
        fecha_vencimiento,
        pais,
        fecha_creacion: new Date(),
      };

      // Agregar al array de documentos
      beneficiario.documentos_viaje.push(nuevoDocumento);
      await beneficiario.save();

      documentoGuardado = nuevoDocumento;
    }

    // Enviar respuesta con documento creado
    res.status(201).json(documentoGuardado);
  } catch (error) {
    console.error("Error al crear documento de viaje:", error);
    res.status(500).json({ message: "Error al crear documento de viaje" });
  }
});
// @route   POST /api/beneficiario/fondos/metodos-pago
// @desc    Crear un nuevo método de pago para el beneficiario
// @access  Private (Beneficiario)
router.post(
  "/fondos/metodos-pago",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      console.log(
        "💾 [FONDOS] Creando método de pago para beneficiario:",
        req.beneficiario._id
      );
      console.log(
        "📤 [FONDOS] Datos recibidos:",
        JSON.stringify(req.body, null, 2)
      );

      const { nombre, tipo_cuenta, informacion_bancaria } = req.body;

      // Validaciones básicas
      if (!nombre || !tipo_cuenta || !informacion_bancaria) {
        console.log("❌ [FONDOS] Faltan campos obligatorios");
        return res.status(400).json({
          success: false,
          mensaje:
            "Faltan campos obligatorios: nombre, tipo_cuenta, informacion_bancaria",
        });
      }

      // Validar información del titular
      if (
        !informacion_bancaria.nombre_titular ||
        !informacion_bancaria.apellido_titular ||
        !informacion_bancaria.documento_titular?.numero ||
        !informacion_bancaria.direccion_titular ||
        !informacion_bancaria.ciudad_titular ||
        !informacion_bancaria.pais_titular ||
        !informacion_bancaria.telefono_titular
      ) {
        console.log("❌ [FONDOS] Falta información del titular");
        return res.status(400).json({
          success: false,
          mensaje: "Completa toda la información del titular",
        });
      }

      // Validaciones específicas por tipo
      switch (tipo_cuenta) {
        case "cuenta_bancaria":
          if (
            !informacion_bancaria.nombre_banco ||
            !informacion_bancaria.numero_cuenta
          ) {
            return res.status(400).json({
              success: false,
              mensaje: "Completa la información bancaria",
            });
          }
          break;
        case "paypal":
          if (
            !informacion_bancaria.email_paypal ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              informacion_bancaria.email_paypal
            )
          ) {
            return res.status(400).json({
              success: false,
              mensaje: "Ingresa un email de PayPal válido",
            });
          }
          break;
        case "transferencia_internacional":
          if (
            !informacion_bancaria.codigo_swift ||
            !informacion_bancaria.direccion_banco
          ) {
            return res.status(400).json({
              success: false,
              mensaje: "Completa la información de transferencia internacional",
            });
          }
          break;
        case "zelle":
          if (
            !informacion_bancaria.telefono_zelle &&
            !informacion_bancaria.email_zelle
          ) {
            return res.status(400).json({
              success: false,
              mensaje: "Ingresa teléfono o email para Zelle",
            });
          }
          break;
        case "wise":
          if (!informacion_bancaria.email_wise) {
            return res.status(400).json({
              success: false,
              mensaje: "Ingresa el email de Wise",
            });
          }
          break;
        case "otro":
          if (
            !informacion_bancaria.nombre_metodo_otro ||
            !informacion_bancaria.detalles_metodo_otro
          ) {
            return res.status(400).json({
              success: false,
              mensaje: "Completa el nombre y detalles del método personalizado",
            });
          }
          break;
      }

      // Importar modelo MetodoPago
      const { MetodoPago } = await import("../models/MetodoPago.js");

      const nuevoMetodo = new MetodoPago({
        beneficiarioId: req.beneficiario._id,
        nombre: nombre.trim(),
        tipo_cuenta,
        informacion_bancaria,
        activo: true,
        veces_utilizado: 0,
        creado_por: req.usuario._id,
      });

      console.log("💾 [FONDOS] Guardando método en BD...");
      const metodoGuardado = await nuevoMetodo.save();

      console.log(
        "✅ [FONDOS] Método de pago guardado exitosamente:",
        metodoGuardado._id
      );

      res.status(201).json({
        success: true,
        mensaje: "Método de pago guardado exitosamente",
        metodo: {
          _id: metodoGuardado._id,
          nombre: metodoGuardado.nombre,
          tipo_cuenta: metodoGuardado.tipo_cuenta,
          informacion_bancaria: metodoGuardado.informacion_bancaria,
          activo: metodoGuardado.activo,
          fecha_creacion: metodoGuardado.fecha_creacion,
        },
      });
    } catch (error) {
      console.error("❌ [FONDOS] Error al guardar método de pago:", error);
      console.error("❌ [FONDOS] Stack trace:", error.stack);

      // Manejar errores de validación de Mongoose
      if (error.name === "ValidationError") {
        const mensajes = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          mensaje: "Error de validación: " + mensajes.join(", "),
          detalles: mensajes,
        });
      }

      // Manejar errores de duplicados
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          mensaje: "Ya existe un método con esos datos",
        });
      }

      res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
        error: error.message,
      });
    }
  }
);

router.delete("/:id/pareja", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(
      `[DELETE /beneficiario/${id}/pareja] Eliminando información de pareja`
    );

    // Validar formato del ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de beneficiario inválido",
      });
    }

    // Buscar el beneficiario
    const beneficiario = await Beneficiario.findById(id);

    if (!beneficiario) {
      return res.status(404).json({
        success: false,
        message: "Beneficiario no encontrado",
      });
    }

    // IMPORTANTE: Eliminar explícitamente la información de pareja
    // Establecer el campo a null
    beneficiario.pareja = null;

    // Guardar los cambios de manera explícita
    console.log(
      `[DELETE /beneficiario/${id}/pareja] Guardando cambios con pareja = null`
    );

    await beneficiario.save();

    // Verificar que los cambios se guardaron correctamente
    const beneficiarioActualizado = await Beneficiario.findById(id);
    console.log(
      `[DELETE /beneficiario/${id}/pareja] Verificación - pareja ahora es:`,
      beneficiarioActualizado.pareja
    );

    return res.json({
      success: true,
      message: "Información de pareja eliminada correctamente",
      pareja: null,
    });
  } catch (error) {
    console.error(`[DELETE /beneficiario/${id}/pareja] Error:`, error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar información de pareja",
      error: error.message,
    });
  }
});

router.delete(
  "/documentos/:id",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      // Obtener ID del usuario autenticado del middleware
      const usuarioId = req.usuario._id;
      const documentoId = req.params.id;

      // Buscar al beneficiario asociado con este usuario
      const beneficiario = await Beneficiario.findOne({
        usuario_id: usuarioId,
      });

      if (!beneficiario) {
        return res
          .status(404)
          .json({ message: "Perfil de beneficiario no encontrado" });
      }

      // Intentar eliminar usando el modelo DocumentoViaje
      let eliminado = false;

      try {
        // Si existe el modelo DocumentoViaje
        const DocumentoViaje = mongoose.model("DocumentoViaje");

        // Verificar que el documento pertenezca a este beneficiario
        const documento = await DocumentoViaje.findOne({
          _id: documentoId,
          beneficiario_id: beneficiario._id,
        });

        if (documento) {
          await DocumentoViaje.deleteOne({ _id: documentoId });
          eliminado = true;
        }
      } catch (error) {
        if (
          beneficiario.documentos_viaje &&
          Array.isArray(beneficiario.documentos_viaje)
        ) {
          const indice = beneficiario.documentos_viaje.findIndex(
            (doc) =>
              doc.id.toString() === documentoId ||
              doc._id.toString() === documentoId
          );

          if (indice !== -1) {
            beneficiario.documentos_viaje.splice(indice, 1);
            await beneficiario.save();
            eliminado = true;
          }
        }
      }

      if (!eliminado) {
        return res
          .status(404)
          .json({
            message:
              "Documento no encontrado o no pertenece a este beneficiario",
          });
      }

      res.json({ message: "Documento eliminado correctamente" });
    } catch (error) {
      console.error("Error al eliminar documento de viaje:", error);
      res.status(500).json({ message: "Error al eliminar documento de viaje" });
    }
  }
);

router.delete(
  "/fondos/metodos-pago/:id",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      console.log("🗑️ [FONDOS] Eliminando método de pago:", req.params.id);

      // Importar modelo MetodoPago
      const { MetodoPago } = await import("../models/MetodoPago.js");

      const metodo = await MetodoPago.findOneAndDelete({
        _id: req.params.id,
        beneficiarioId: req.beneficiario._id,
      });

      if (!metodo) {
        return res.status(404).json({
          success: false,
          mensaje: "Método de pago no encontrado",
        });
      }

      console.log("✅ [FONDOS] Método de pago eliminado exitosamente");

      res.json({
        success: true,
        mensaje: "Método de pago eliminado exitosamente",
      });
    } catch (error) {
      console.error("❌ [FONDOS] Error al eliminar método de pago:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
        error: error.message,
      });
    }
  }
);

router.get(
  "/fondos/metodos-pago/:id",
  checkAuth,
  isBeneficiario,
  async (req, res) => {
    try {
      console.log(
        "🔍 [FONDOS] Obteniendo método de pago específico:",
        req.params.id
      );

      // Importar modelo MetodoPago
      const { MetodoPago } = await import("../models/MetodoPago.js");

      const metodo = await MetodoPago.findOne({
        _id: req.params.id,
        beneficiarioId: req.beneficiario._id,
      });

      if (!metodo) {
        return res.status(404).json({
          success: false,
          mensaje: "Método de pago no encontrado",
        });
      }

      res.json({
        success: true,
        metodo,
      });
    } catch (error) {
      console.error("❌ [FONDOS] Error al obtener método de pago:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
        error: error.message,
      });
    }
  }
);
export default router;
