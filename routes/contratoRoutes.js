// Actualización del servicio de contratos para obtener correos de beneficiarios

import express from "express";
import mongoose from "mongoose";
import { Contrato } from "../models/Contrato.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Usuario } from "../models/Usuario.js"; // Importar Usuario para obtener correos
import { checkAuth, isAliado, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

// Obtener todos los contratos del aliado
router.get("/", checkAuth, isAliado, async (req, res) => {
  try {
    // Obtener el ID del aliado desde el middleware de autenticación
    const aliado_id = req.aliado._id;

    // Buscar todos los contratos asociados a este aliado
    const contratos = await Contrato.find({ aliado_id })
      .sort({ fecha_creacion: -1 })
      .populate("beneficiario_id", "nombre apellido telefono correo")
      .select("-url_documento -firma_electronica.id_sesion");

    res.json(contratos);
  } catch (error) {
    console.error("Error al obtener contratos:", error);
    res.status(500).json({
      mensaje: "Error al obtener contratos",
      error: error.message,
    });
  }
});

// Obtener un contrato específico por ID
router.get("/:id", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    // Buscar el contrato específico asegurando que pertenezca al aliado
    const contrato = await Contrato.findOne({
      _id: id,
      aliado_id,
    }).populate(
      "beneficiario_id",
      "nombre apellido telefono correo nacionalidad direccion"
    );

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    res.json(contrato);
  } catch (error) {
    console.error("Error al obtener contrato:", error);
    res.status(500).json({
      mensaje: "Error al obtener contrato",
      error: error.message,
    });
  }
});

// Crear un nuevo contrato
router.post("/", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;
    const {
      beneficiario_id,
      beneficiario_datos,
      monto,
      servicios_incluidos,
      enganche_pagado,
      metodo_pago,
      notas,
    } = req.body;

    // Validar datos requeridos
    if (!monto || !monto.valor) {
      return res.status(400).json({
        mensaje: "El monto del contrato es requerido",
      });
    }

    // Si no se proporciona ID de beneficiario, verificar que se proporcionen datos manuales
    if (
      !beneficiario_id &&
      (!beneficiario_datos || !beneficiario_datos.nombre)
    ) {
      return res.status(400).json({
        mensaje:
          "Se requiere un beneficiario existente o datos de un nuevo beneficiario",
      });
    }

    // Crear el nuevo contrato
    const nuevoContrato = new Contrato({
      aliado_id,
      beneficiario_id: beneficiario_id || null,
      beneficiario_datos: beneficiario_id ? null : beneficiario_datos,
      monto,
      servicios_incluidos: servicios_incluidos || [],
      enganche_pagado: enganche_pagado || { valor: 0, moneda: monto.moneda },
      metodo_pago: metodo_pago || { tipo: "Efectivo" },
      notas,
      historial: [
        {
          accion: "CREACION",
          fecha: new Date(),
          usuario_id: req.usuario._id,
          detalles: "Contrato creado",
        },
      ],
    });

    // Guardar el contrato
    const contratoGuardado = await nuevoContrato.save();

    res.status(201).json({
      mensaje: "Contrato creado exitosamente",
      contrato: contratoGuardado,
    });
  } catch (error) {
    console.error("Error al crear contrato:", error);
    res.status(500).json({
      mensaje: "Error al crear contrato",
      error: error.message,
    });
  }
});

// Actualizar un contrato existente
router.put("/:id", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;
    const {
      beneficiario_id,
      beneficiario_datos,
      monto,
      servicios_incluidos,
      enganche_pagado,
      metodo_pago,
      notas,
      estado,
    } = req.body;

    // Verificar que el contrato exista y pertenezca al aliado
    const contrato = await Contrato.findOne({
      _id: id,
      aliado_id,
    });

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    // Solo permitir actualizar si el contrato está en estado borrador o enviado
    if (contrato.estado !== "BORRADOR" && contrato.estado !== "ENVIADO") {
      return res.status(400).json({
        mensaje:
          "No se puede modificar un contrato que ya ha sido firmado, cancelado o expirado",
      });
    }

    // Actualizar los campos según lo proporcionado
    if (monto && monto.valor) contrato.monto = monto;
    if (servicios_incluidos) contrato.servicios_incluidos = servicios_incluidos;
    if (enganche_pagado) contrato.enganche_pagado = enganche_pagado;
    if (metodo_pago) contrato.metodo_pago = metodo_pago;
    if (notas !== undefined) contrato.notas = notas;

    // Solo permitir cambiar beneficiario si el contrato está en estado BORRADOR
    if (contrato.estado === "BORRADOR") {
      if (beneficiario_id) {
        contrato.beneficiario_id = beneficiario_id;
        contrato.beneficiario_datos = null;
      } else if (beneficiario_datos && beneficiario_datos.nombre) {
        contrato.beneficiario_id = null;
        contrato.beneficiario_datos = beneficiario_datos;
      }
    }

    // Actualizar estado si se proporciona
    if (estado && ["BORRADOR", "ENVIADO", "CANCELADO"].includes(estado)) {
      // Solo permitir ciertos cambios de estado
      if (
        estado === "CANCELADO" ||
        (contrato.estado === "BORRADOR" && estado === "ENVIADO") ||
        (contrato.estado === "ENVIADO" && estado === "BORRADOR")
      ) {
        contrato.estado = estado;

        // Registrar en historial
        contrato.historial.push({
          accion:
            estado === "CANCELADO"
              ? "CANCELACION"
              : estado === "ENVIADO"
              ? "ENVIO"
              : "MODIFICACION",
          fecha: new Date(),
          usuario_id: req.usuario._id,
          detalles: `Contrato ${
            estado === "CANCELADO"
              ? "cancelado"
              : estado === "ENVIADO"
              ? "enviado para firma"
              : "vuelto a borrador"
          }`,
        });
      } else {
        return res.status(400).json({
          mensaje: "Cambio de estado no permitido",
        });
      }
    }

    // Registrar modificación en historial si no es cambio de estado
    if (!estado) {
      contrato.historial.push({
        accion: "MODIFICACION",
        fecha: new Date(),
        usuario_id: req.usuario._id,
        detalles: "Contrato modificado",
      });
    }

    // Guardar cambios
    const contratoActualizado = await contrato.save();

    res.json({
      mensaje: "Contrato actualizado exitosamente",
      contrato: contratoActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar contrato:", error);
    res.status(500).json({
      mensaje: "Error al actualizar contrato",
      error: error.message,
    });
  }
});

// Actualizar firma electrónica
router.put("/:id/firma", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;
    const { id_sesion, url_firma, completado } = req.body;

    const contrato = await Contrato.findOne({
      _id: id,
      aliado_id,
    });

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    // Actualizar información de firma
    contrato.firma_electronica = {
      id_sesion: id_sesion || contrato.firma_electronica?.id_sesion,
      url_firma: url_firma || contrato.firma_electronica?.url_firma,
      completado: completado || contrato.firma_electronica?.completado || false,
      fecha_completado: completado
        ? new Date()
        : contrato.firma_electronica?.fecha_completado,
    };

    // Si la firma se completó, actualizar estado del contrato
    if (completado && contrato.estado !== "FIRMADO") {
      contrato.estado = "FIRMADO";
      contrato.fecha_firma = new Date();

      // Registrar en historial
      contrato.historial.push({
        accion: "FIRMA",
        fecha: new Date(),
        usuario_id: req.usuario._id,
        detalles: "Contrato firmado electrónicamente",
      });

      // Si hay términos, marcarlos como aceptados
      contrato.terminos_aceptados = true;
    }

    const contratoActualizado = await contrato.save();

    res.json({
      mensaje: "Información de firma actualizada",
      contrato: contratoActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar firma:", error);
    res.status(500).json({
      mensaje: "Error al actualizar información de firma",
      error: error.message,
    });
  }
});

// Buscar un beneficiario para el contrato - RUTA ACTUALIZADA
router.get("/buscar/beneficiario", checkAuth, isAliado, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        mensaje: "Se requieren al menos 2 caracteres para buscar",
      });
    }

    // Buscar beneficiarios por nombre, apellido, código, llave única o correo
    const beneficiarios = await Beneficiario.find({
      $or: [
        { nombre: { $regex: q, $options: "i" } },
        { apellido: { $regex: q, $options: "i" } },
        { "codigo.value": { $regex: q, $options: "i" } },
        { llave_unica: { $regex: q, $options: "i" } },
        { correo: { $regex: q, $options: "i" } }, // Buscar también por correo directo
      ],
    })
      .select(
        "_id nombre apellido telefono correo nacionalidad direccion codigo llave_unica usuario_id"
      )
      .populate("usuario_id", "correo") // Importante: Traer el correo del usuario
      .limit(10);

    // Procesar los resultados para asegurar que tengan correo
    const beneficiariosConCorreo = await Promise.all(
      beneficiarios.map(async (beneficiario) => {
        const beneficiarioObj = beneficiario.toObject();

        // Si ya tiene correo directo, lo usamos
        if (beneficiarioObj.correo) {
          return beneficiarioObj;
        }

        // Si tiene usuario_id con correo, usamos ese
        if (beneficiarioObj.usuario_id && beneficiarioObj.usuario_id.correo) {
          beneficiarioObj.correo = beneficiarioObj.usuario_id.correo;
          return beneficiarioObj;
        }

        // Si tiene usuario_id pero no tiene correo, buscamos el usuario
        if (beneficiarioObj.usuario_id && beneficiarioObj.usuario_id._id) {
          try {
            const usuario = await Usuario.findById(
              beneficiarioObj.usuario_id._id
            );
            if (usuario && usuario.correo) {
              beneficiarioObj.correo = usuario.correo;
            }
          } catch (error) {
            console.error("Error al buscar correo de usuario:", error);
          }
        }

        return beneficiarioObj;
      })
    );

    res.status(200).json({
      success: true,
      beneficiarios: beneficiariosConCorreo,
    });
  } catch (error) {
    console.error("Error al buscar beneficiarios:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al buscar beneficiarios",
      error: error.message,
    });
  }
});

// Verificar estado de firma
router.get("/:id/estado-firma", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await Contrato.findById(id).select(
      "estado firma_electronica numero_contrato"
    );

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    res.json({
      estado: contrato.estado,
      firma_completada: contrato.firma_electronica?.completado || false,
      numero_contrato: contrato.numero_contrato,
    });
  } catch (error) {
    console.error("Error al verificar estado de firma:", error);
    res.status(500).json({
      mensaje: "Error al verificar estado de firma",
      error: error.message,
    });
  }
});

// Registrar términos y condiciones aceptados
router.put("/:id/terminos", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { aceptados } = req.body;

    if (aceptados === undefined) {
      return res.status(400).json({
        mensaje: "Se requiere especificar si los términos fueron aceptados",
      });
    }

    const contrato = await Contrato.findById(id);

    if (!contrato) {
      return res.status(404).json({ mensaje: "Contrato no encontrado" });
    }

    contrato.terminos_aceptados = aceptados;

    // Registrar en historial
    contrato.historial.push({
      accion: "MODIFICACION",
      fecha: new Date(),
      usuario_id: req.usuario._id,
      detalles: aceptados
        ? "Términos y condiciones aceptados"
        : "Términos y condiciones rechazados",
    });

    await contrato.save();

    res.json({
      mensaje: aceptados
        ? "Términos y condiciones aceptados"
        : "Términos y condiciones rechazados",
      terminos_aceptados: aceptados,
    });
  } catch (error) {
    console.error("Error al actualizar términos y condiciones:", error);
    res.status(500).json({
      mensaje: "Error al actualizar términos y condiciones",
      error: error.message,
    });
  }
});

export default router;
