import express from "express";
import { Servicio } from "../models/Servicio.js";
import { BeneficioBeneficiario } from "../models/BeneficioBeneficiario.js";
import { HistorialServicio } from "../models/HistorialServicio.js";
import { Beneficiario } from "../models/Beneficiario.js";
import mongoose from "mongoose";
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

// Agregar esta ruta ANTES de la ruta GET '/'
router.get("/por-tipo/beneficiario", async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("[SERVICIOS] Obteniendo servicios tipo beneficiario");

    // Buscar servicios para beneficiarios
    const servicios = await Servicio.find({
      tipoUsuario: { $in: ["beneficiario", "ambos"] },
      estado: "activo",
    }).populate("creado_por", "nombre_usuario");

    const serviciosFormateados = servicios.map((servicio) => ({
      _id: servicio._id.toString(),
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      tipoUsuario: servicio.tipoUsuario || "ambos",
      estado: servicio.estado || "activo",
      configuracion: servicio.configuracion || {},
      fecha_creacion: servicio.fecha_creacion,
      creado_por: servicio.creado_por?.nombre_usuario || "Sistema",
    }));

    console.log(
      `[SERVICIOS] Servicios beneficiario encontrados: ${serviciosFormateados.length}`
    );

    res.json(serviciosFormateados);
  } catch (error) {
    console.error(
      "[SERVICIOS] Error al obtener servicios beneficiario:",
      error
    );
    res.status(500).json({
      error: "Error al obtener servicios",
      mensaje: error.message,
    });
  }
});

// Obtener todos los servicios
router.get("/", async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    const servicios = await Servicio.find().populate(
      "creado_por",
      "nombre_usuario"
    );

    const serviciosFormateados = servicios.map((servicio) => ({
      _id: servicio._id.toString(),
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      tipoUsuario: servicio.tipoUsuario || "ambos",
      estado: servicio.estado || "activo",
      configuracion: servicio.configuracion || {},
      fecha_creacion: servicio.fecha_creacion,
      creado_por: servicio.creado_por?.nombre_usuario || "Sistema",
      __v: servicio.__v,
    }));

    console.log(
      "Enviando servicios al cliente:",
      serviciosFormateados.map((s) => ({
        id: s._id,
        nombre: s.nombre,
        estado: s.estado,
      }))
    );

    res.json(serviciosFormateados);
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    res
      .status(500)
      .json({ error: "Error al obtener servicios", mensaje: error.message });
  }
});

// beneficios específicos de un usuario

router.get(
  "/beneficiario/:usuarioId/beneficios",
  checkAuth,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      console.log(`[DEBUG] === BENEFICIOS COMPLETOS ===`);
      console.log(`[DEBUG] Usuario ID recibido: ${usuarioId}`);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({
          success: false,
          error: "ID de usuario inválido",
        });
      }

      // Buscar beneficiario por usuario_id primero, luego por _id
      let beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
      console.log(`[DEBUG] Encontrado por usuario_id:`, !!beneficiario);

      if (!beneficiario) {
        console.log(`[DEBUG] Buscando por _id: ${usuarioId}`);
        beneficiario = await Beneficiario.findById(usuarioId);
        console.log(`[DEBUG] Encontrado por _id:`, !!beneficiario);
      }

      if (!beneficiario) {
        console.log(`[DEBUG] ❌ Beneficiario NO encontrado`);
        return res.status(404).json({
          success: false,
          error: "Beneficiario no encontrado",
        });
      }

      console.log(`[DEBUG] ✅ Beneficiario encontrado: ${beneficiario._id}`);

      // Buscar todos los beneficios del beneficiario
      const beneficios = await BeneficioBeneficiario.find({
        beneficiarioId: beneficiario._id,
      }).populate("servicioId", "nombre descripcion configuracion");

      console.log(`[DEBUG] Beneficios encontrados: ${beneficios.length}`);

      // Formatear beneficios con toda la información necesaria
      const beneficiosFormateados = beneficios.map((beneficio) => {
        const beneficioObj = beneficio.toObject();

        // Información básica
        const resultado = {
          _id: beneficioObj._id,
          beneficiarioId: beneficioObj.beneficiarioId,
          servicioId: beneficioObj.servicioId?._id || beneficioObj.servicioId,
          servicioNombre:
            beneficioObj.servicioNombre ||
            beneficioObj.servicioId?.nombre ||
            "Servicio desconocido",

          // Estados y fechas
          estado: beneficioObj.estado || "pendiente_activacion",
          fecha_activacion: beneficioObj.fecha_activacion,
          fecha_desactivacion: beneficioObj.fecha_desactivacion,
          fecha_reactivacion: beneficioObj.fecha_reactivacion,

          // Información de desactivación
          motivo_desactivacion: beneficioObj.motivo_desactivacion,
          razon_personalizada: beneficioObj.razon_personalizada,
          volveria_contratar: beneficioObj.volveria_contratar,
          notas_adicionales: beneficioObj.notas_adicionales,
          puede_reactivar: beneficioObj.puede_reactivar !== false, // Por defecto true

          // Datos específicos por tipo de servicio
          voucher_info: null,
          reembolso_info: null,
          financiamiento_info: null,
        };

        // Información específica para vouchers
        if (
          beneficioObj.servicioNombre === "Vouchers Flyback" ||
          beneficioObj.servicioNombre === "Certificado de boletos aéreos"
        ) {
          resultado.voucher_info = {
            saldo_actual: beneficioObj.voucher_data?.saldo_actual || 500,
            vouchers_usados: beneficioObj.voucher_data?.vouchers_usados || 0,
            renovaciones_utilizadas:
              beneficioObj.voucher_data?.renovaciones_utilizadas || 0,
            renovaciones_disponibles:
              10 - (beneficioObj.voucher_data?.renovaciones_utilizadas || 0),
            proxima_renovacion_disponible:
              beneficioObj.voucher_data?.proxima_renovacion_disponible,
            historial_uso: beneficioObj.voucher_data?.historial_uso || [],
          };
        }

        // Información específica para reembolsos
        if (beneficioObj.servicioNombre === "Reembolso de costos") {
          resultado.reembolso_info = {
            monto_a_reembolsar: beneficioObj.reembolso_data?.monto_a_reembolsar,
            prima_pagada: beneficioObj.reembolso_data?.prima_pagada,
            fecha_reembolso: beneficioObj.reembolso_data?.fecha_reembolso,
            estado_prima:
              beneficioObj.reembolso_data?.estado_prima || "pendiente",
          };
        }

        // Información específica para financiamiento
        if (beneficioObj.servicioNombre === "Financiamiento de seña") {
          resultado.financiamiento_info = {
            monto_financiado:
              beneficioObj.financiamiento_data?.monto_financiado,
            monto_con_intereses:
              beneficioObj.financiamiento_data?.monto_con_intereses,
            saldo_actual: beneficioObj.financiamiento_data?.saldo_actual,
            mensualidades_pagadas:
              beneficioObj.financiamiento_data?.mensualidades_pagadas || 0,
            valor_mensualidad:
              beneficioObj.financiamiento_data?.valor_mensualidad,
            proxima_mensualidad:
              beneficioObj.financiamiento_data?.proxima_mensualidad,
            esta_liquidado:
              (beneficioObj.financiamiento_data?.saldo_actual || 0) <= 0,
            contrato_numero:
              beneficioObj.financiamiento_data?.contrato_firmado
                ?.numero_contrato,
          };
        }

        return resultado;
      });

      res.json({
        success: true,
        beneficios: beneficiosFormateados,
        total: beneficiosFormateados.length,
        debug: {
          beneficiario_id: beneficiario._id,
          usuario_id: beneficiario.usuario_id,
        },
      });
    } catch (error) {
      console.error("[DEBUG] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Activar un beneficio específico
router.post(
  "/beneficiario/:usuarioId/activar-beneficio",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const { servicioId, datos_activacion } = req.body;

      console.log(`[ACTIVAR-API] === INICIANDO ACTIVACIÓN ===`);
      console.log(`[ACTIVAR-API] Usuario: ${usuarioId}`);
      console.log(`[ACTIVAR-API] Servicio: ${servicioId}`);
      console.log(`[ACTIVAR-API] Datos:`, datos_activacion);

      // Validaciones básicas
      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({
          success: false,
          mensaje: "ID de usuario inválido",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(servicioId)) {
        return res.status(400).json({
          success: false,
          mensaje: "ID de servicio inválido",
        });
      }

      // PASO 1: Buscar beneficiario
      let beneficiario;
      try {
        beneficiario = await Beneficiario.findById(usuarioId);
        if (!beneficiario) {
          beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
        }

        if (!beneficiario) {
          return res.status(404).json({
            success: false,
            mensaje: "Beneficiario no encontrado",
          });
        }

        console.log(
          `[ACTIVAR-API] ✅ Beneficiario encontrado: ${beneficiario._id}`
        );
      } catch (beneficiarioError) {
        console.error(
          `[ACTIVAR-API] ❌ Error buscando beneficiario:`,
          beneficiarioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficiario",
          error: beneficiarioError.message,
        });
      }

      // PASO 2: Buscar beneficio pendiente
      let beneficio;
      try {
        beneficio = await BeneficioBeneficiario.findOne({
          beneficiarioId: beneficiario._id,
          servicioId: servicioId,
          estado: "pendiente_activacion",
        });

        if (!beneficio) {
          console.log(
            `[ACTIVAR-API] ❌ Beneficio no encontrado o ya está activado`
          );

          // Verificar si existe pero en otro estado
          const beneficioAnyState = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicioId,
          });

          if (beneficioAnyState) {
            return res.status(400).json({
              success: false,
              mensaje: `El beneficio existe pero está en estado: ${beneficioAnyState.estado}. Solo se pueden activar beneficios pendientes.`,
            });
          }

          return res.status(404).json({
            success: false,
            mensaje: "Beneficio no encontrado o ya está activado",
          });
        }

        console.log(
          `[ACTIVAR-API] ✅ Beneficio encontrado: ${beneficio.servicioNombre}`
        );
      } catch (beneficioError) {
        console.error(
          `[ACTIVAR-API] ❌ Error buscando beneficio:`,
          beneficioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficio",
          error: beneficioError.message,
        });
      }

      // PASO 3: Activar el beneficio usando el método del modelo
      try {
        await beneficio.activar(req.usuario._id, datos_activacion);
        console.log(`[ACTIVAR-API] ✅ Beneficio activado en modelo`);
      } catch (activarError) {
        console.error(
          `[ACTIVAR-API] ❌ Error activando beneficio:`,
          activarError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error activando beneficio",
          error: activarError.message,
        });
      }

      // PASO 4: SINCRONIZACIÓN MANUAL
      const sincronizacionResultados = {
        codigo_activado: false,
        fondo_creado_activado: false,
        errores_sincronizacion: [],
      };

      try {
        console.log(`[ACTIVAR-API] Iniciando sincronización manual...`);

        // Normalizar nombre del servicio
        const servicioNormalizado = mapearNombreServicio(
          beneficio.servicioNombre
        );
        console.log(
          `[ACTIVAR-API] Servicio normalizado: ${servicioNormalizado}`
        );

        // Ejecutar sincronización según el tipo de servicio
        if (
          servicioNormalizado === "Refund360" ||
          servicioNormalizado === "Reembolso de costos"
        ) {
          console.log(`[ACTIVAR-API] Activando código único...`);

          try {
            // Procesar datos de activación
            let montoParaCodigo = 0;
            let primaCalculada = 0;

            if (
              datos_activacion &&
              datos_activacion.monto_a_reembolsar &&
              datos_activacion.monto_a_reembolsar > 0
            ) {
              montoParaCodigo = parseFloat(datos_activacion.monto_a_reembolsar);
              primaCalculada = montoParaCodigo * 0.0575; // 5.75%
            }

            // Inicializar código si no existe
            if (!beneficiario.codigo) {
              beneficiario.codigo = {
                value: beneficiario.llave_unica,
                fecha_creacion: new Date(),
                activo: false,
                estado_activacion: "PENDIENTE",
                monto: { valor: 0, moneda: "USD" },
                primaPagada: 0,
                historial: [],
              };
            }

            // Activar el código
            beneficiario.codigo.activo = true;
            beneficiario.codigo.estado_activacion = "ACTIVO";
            beneficiario.codigo.fecha_activacion = new Date();

            // Actualizar monto y prima
            beneficiario.codigo.monto.valor = montoParaCodigo;
            beneficiario.codigo.monto.moneda = "USD";
            beneficiario.codigo.primaPagada = primaCalculada;

            // Agregar al historial del código
            beneficiario.codigo.historial.push({
              motivo: "ACTIVACION",
              fecha_cambio: new Date(),
              detalles: `Código activado por sincronización. Monto: $${montoParaCodigo} USD, Prima: $${primaCalculada.toFixed(
                2
              )} USD`,
              codigo_anterior: null,
            });

            await beneficiario.save();
            sincronizacionResultados.codigo_activado = true;
            console.log(`[ACTIVAR-API] ✅ Código único activado`);
          } catch (codigoError) {
            console.error(
              `[ACTIVAR-API] ⚠️ Error activando código:`,
              codigoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en código: ${codigoError.message}`
            );
          }
        } else if (
          servicioNormalizado === "Voucher Fly Back" ||
          servicioNormalizado === "Vouchers Flyback" ||
          servicioNormalizado === "Certificado de boletos aéreos"
        ) {
          console.log(`[ACTIVAR-API] Activando fondo...`);

          try {
            // Importar modelo de fondo
            const { Fondo } = await import("../models/Fondo.js");

            // Buscar fondo existente
            let fondo = await Fondo.findOne({
              beneficiarioId: beneficiario._id,
            });

            if (fondo) {
              // Si el fondo existe pero no está activo, reactivarlo
              if (fondo.estado !== "activo") {
                console.log(
                  `[ACTIVAR-API] Reactivando fondo existente con estado: ${fondo.estado}`
                );

                fondo.estado = "activo";
                fondo.historial_movimientos.push({
                  tipo: "reactivacion",
                  monto_anterior: fondo.saldo_actual.valor,
                  monto_nuevo: fondo.saldo_actual.valor,
                  descripcion: `Fondo reactivado por sincronización. Servicio: ${servicioNormalizado}`,
                  realizado_por: req.usuario._id,
                  fecha: new Date(),
                });
                await fondo.save();

                console.log(`[ACTIVAR-API] ✅ Fondo reactivado`);
              } else {
                console.log(`[ACTIVAR-API] ℹ️ Fondo ya está activo`);
              }
            } else {
              // Crear nuevo fondo
              console.log(`[ACTIVAR-API] Creando nuevo fondo`);

              const fechaVencimiento = new Date();
              fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);

              fondo = new Fondo({
                beneficiarioId: beneficiario._id,
                monto_inicial: { valor: 500, moneda: "USD" },
                saldo_actual: { valor: 500, moneda: "USD" },
                estado: "activo",
                fecha_vencimiento: fechaVencimiento,
                creado_por: req.usuario._id,
                actualizado_por: req.usuario._id,
                historial_movimientos: [
                  {
                    tipo: "creacion",
                    monto_anterior: 0,
                    monto_nuevo: 500,
                    descripcion: `Fondo creado por sincronización. Servicio: ${servicioNormalizado}`,
                    realizado_por: req.usuario._id,
                    fecha: new Date(),
                  },
                ],
              });

              await fondo.save();
              console.log(`[ACTIVAR-API] ✅ Fondo creado con $500 USD`);
            }

            sincronizacionResultados.fondo_creado_activado = true;
          } catch (fondoError) {
            console.error(
              `[ACTIVAR-API] ⚠️ Error con fondo:`,
              fondoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en fondo: ${fondoError.message}`
            );
          }
        } else {
          console.log(
            `[ACTIVAR-API] ℹ️ Servicio sin sincronización: ${servicioNormalizado}`
          );
        }
      } catch (syncError) {
        console.error(
          `[ACTIVAR-API] ⚠️ Error en sincronización general:`,
          syncError
        );
        sincronizacionResultados.errores_sincronizacion.push(
          `Error general: ${syncError.message}`
        );
      }

      // PASO 5: Respuesta exitosa
      console.log(`[ACTIVAR-API] ✅ Activación completa finalizada`);

      res.json({
        success: true,
        mensaje: "Beneficio activado correctamente",
        beneficio: {
          _id: beneficio._id,
          servicioNombre: beneficio.servicioNombre,
          estado: beneficio.estado,
          fecha_activacion: beneficio.fecha_activacion,
        },
        sincronizacion: sincronizacionResultados,
      });
    } catch (error) {
      console.error("[ACTIVAR-API] ❌ Error crítico no controlado:", error);
      console.error("[ACTIVAR-API] Stack trace:", error.stack);

      res.status(500).json({
        success: false,
        mensaje: "Error interno del servidor",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);
// Desactivar un beneficio

router.post(
  "/beneficiario/:usuarioId/desactivar-beneficio",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const {
        servicioId,
        motivo_desactivacion,
        razon_personalizada,
        notas_adicionales,
        volveria_contratar,
      } = req.body;

      console.log(`[DESACTIVAR-API] === INICIANDO DESACTIVACIÓN ===`);
      console.log(`[DESACTIVAR-API] Usuario: ${usuarioId}`);
      console.log(`[DESACTIVAR-API] Servicio: ${servicioId}`);
      console.log(`[DESACTIVAR-API] Motivo: ${motivo_desactivacion}`);
      console.log(`[DESACTIVAR-API] Body completo:`, req.body);
      console.log(
        `[DESACTIVAR-API] volveria_contratar recibido:`,
        volveria_contratar
      );
      console.log(`[DESACTIVAR-API] Tipo:`, typeof volveria_contratar);

      // Validaciones básicas
      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        console.log(`[DESACTIVAR-API] ❌ ID de usuario inválido: ${usuarioId}`);
        return res.status(400).json({
          success: false,
          mensaje: "ID de usuario inválido",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(servicioId)) {
        console.log(
          `[DESACTIVAR-API] ❌ ID de servicio inválido: ${servicioId}`
        );
        return res.status(400).json({
          success: false,
          mensaje: "ID de servicio inválido",
        });
      }

      if (!motivo_desactivacion) {
        console.log(`[DESACTIVAR-API] ❌ Motivo de desactivación requerido`);
        return res.status(400).json({
          success: false,
          mensaje: "Motivo de desactivación es requerido",
        });
      }

      // PASO 1: Buscar beneficiario
      let beneficiario;
      try {
        beneficiario = await Beneficiario.findById(usuarioId);
        if (!beneficiario) {
          beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
        }

        if (!beneficiario) {
          console.log(
            `[DESACTIVAR-API] ❌ Beneficiario no encontrado: ${usuarioId}`
          );
          return res.status(404).json({
            success: false,
            mensaje: "Beneficiario no encontrado",
          });
        }

        console.log(
          `[DESACTIVAR-API] ✅ Beneficiario encontrado: ${beneficiario._id}`
        );
      } catch (beneficiarioError) {
        console.error(
          `[DESACTIVAR-API] ❌ Error buscando beneficiario:`,
          beneficiarioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficiario",
          error: beneficiarioError.message,
        });
      }

      // PASO 2: Buscar beneficio activo
      let beneficio;
      try {
        beneficio = await BeneficioBeneficiario.findOne({
          beneficiarioId: beneficiario._id,
          servicioId: servicioId,
          estado: "activo",
        });

        if (!beneficio) {
          console.log(
            `[DESACTIVAR-API] ❌ Beneficio no encontrado o no está activo`
          );
          console.log(
            `[DESACTIVAR-API] Búsqueda: beneficiarioId=${beneficiario._id}, servicioId=${servicioId}, estado=activo`
          );

          // Verificar si existe pero en otro estado
          const beneficioAnyState = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicioId,
          });

          if (beneficioAnyState) {
            console.log(
              `[DESACTIVAR-API] ❌ Beneficio existe pero con estado: ${beneficioAnyState.estado}`
            );
            return res.status(400).json({
              success: false,
              mensaje: `El beneficio existe pero está en estado: ${beneficioAnyState.estado}. Solo se pueden desactivar beneficios activos.`,
            });
          }

          return res.status(404).json({
            success: false,
            mensaje: "Beneficio no encontrado o no está activo",
          });
        }

        console.log(
          `[DESACTIVAR-API] ✅ Beneficio encontrado: ${beneficio.servicioNombre} (Estado: ${beneficio.estado})`
        );
      } catch (beneficioError) {
        console.error(
          `[DESACTIVAR-API] ❌ Error buscando beneficio:`,
          beneficioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficio",
          error: beneficioError.message,
        });
      }

      // PASO 3: Desactivar el beneficio usando el método del modelo
      try {
        const datosDesactivacion = {
          motivo: motivo_desactivacion, // Para compatibilidad del modelo
          motivo_desactivacion: motivo_desactivacion, // ✅ Campo correcto
          razon_personalizada: razon_personalizada || "",
          notas_adicionales: notas_adicionales || "",
          volveria_contratar: volveria_contratar,
        };

        console.log(
          `[DESACTIVAR-API] Ejecutando desactivación con datos:`,
          datosDesactivacion
        );

        await beneficio.desactivar(req.usuario._id, datosDesactivacion);
        console.log(`[DESACTIVAR-API] ✅ Beneficio desactivado en modelo`);
      } catch (desactivarError) {
        console.error(
          `[DESACTIVAR-API] ❌ Error desactivando beneficio:`,
          desactivarError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error desactivando beneficio",
          error: desactivarError.message,
        });
      }

      // PASO 4: SINCRONIZACIÓN MANUAL
      const sincronizacionResultados = {
        codigo_desactivado: false,
        fondo_desactivado: false,
        errores_sincronizacion: [],
      };

      try {
        console.log(`[DESACTIVAR-API] Iniciando sincronización manual...`);

        // Normalizar nombre del servicio
        const servicioNormalizado = mapearNombreServicio(
          beneficio.servicioNombre
        );
        console.log(
          `[DESACTIVAR-API] Servicio normalizado: ${servicioNormalizado}`
        );

        // Ejecutar sincronización según el tipo de servicio
        if (
          servicioNormalizado === "Refund360" ||
          servicioNormalizado === "Reembolso de costos"
        ) {
          console.log(`[DESACTIVAR-API] Desactivando código único...`);

          try {
            // Desactivar código directamente en el beneficiario
            if (beneficiario.codigo && beneficiario.codigo.activo) {
              beneficiario.codigo.activo = false;
              beneficiario.codigo.estado_activacion = "SUSPENDIDO";

              if (!beneficiario.codigo.historial) {
                beneficiario.codigo.historial = [];
              }

              beneficiario.codigo.historial.push({
                motivo: "CANCELACION",
                fecha_cambio: new Date(),
                detalles: `Código desactivado por sincronización. Motivo: ${
                  razon_personalizada || motivo_desactivacion
                }`,
                codigo_anterior: null,
              });

              await beneficiario.save();
              sincronizacionResultados.codigo_desactivado = true;
              console.log(`[DESACTIVAR-API] ✅ Código único desactivado`);
            } else {
              console.log(
                `[DESACTIVAR-API] ℹ️ Código único ya estaba inactivo o no existe`
              );
            }
          } catch (codigoError) {
            console.error(
              `[DESACTIVAR-API] ⚠️ Error desactivando código:`,
              codigoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en código: ${codigoError.message}`
            );
          }
        } else if (
          servicioNormalizado === "Voucher Fly Back" ||
          servicioNormalizado === "Vouchers Flyback" ||
          servicioNormalizado === "Certificado de boletos aéreos"
        ) {
          console.log(`[DESACTIVAR-API] Desactivando fondo...`);

          try {
            // Importar modelo de fondo
            const { Fondo } = await import("../models/Fondo.js");

            // Buscar fondo del beneficiario
            const fondo = await Fondo.findOne({
              beneficiarioId: beneficiario._id,
            });

            if (fondo && fondo.estado === "activo") {
              // Mapear motivo de desactivación
              const motivoFondo =
                mapearMotivoDesactivacionFondo(motivo_desactivacion);

              // Desactivar fondo
              fondo.estado = "desactivado";
              fondo.motivo_desactivacion = motivoFondo;
              fondo.razon_desactivacion =
                razon_personalizada || `Desactivado por sincronización`;
              fondo.fecha_desactivacion = new Date();
              fondo.actualizado_por = req.usuario._id;

              // Agregar al historial
              fondo.historial_movimientos.push({
                tipo: "desactivacion",
                monto_anterior: fondo.saldo_actual.valor,
                monto_nuevo: fondo.saldo_actual.valor,
                descripcion: `Fondo desactivado por sincronización. Motivo: ${motivoFondo}`,
                realizado_por: req.usuario._id,
                fecha: new Date(),
              });

              await fondo.save();
              sincronizacionResultados.fondo_desactivado = true;
              console.log(`[DESACTIVAR-API] ✅ Fondo desactivado`);
            } else {
              console.log(
                `[DESACTIVAR-API] ℹ️ Fondo no encontrado o ya estaba inactivo`
              );
            }
          } catch (fondoError) {
            console.error(
              `[DESACTIVAR-API] ⚠️ Error desactivando fondo:`,
              fondoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en fondo: ${fondoError.message}`
            );
          }
        } else {
          console.log(
            `[DESACTIVAR-API] ℹ️ Servicio sin sincronización: ${servicioNormalizado}`
          );
        }
      } catch (syncError) {
        console.error(
          `[DESACTIVAR-API] ⚠️ Error en sincronización general:`,
          syncError
        );
        sincronizacionResultados.errores_sincronizacion.push(
          `Error general: ${syncError.message}`
        );
      }

      // PASO 5: Respuesta exitosa
      console.log(`[DESACTIVAR-API] ✅ Desactivación completa finalizada`);

      res.json({
        success: true,
        mensaje: "Beneficio desactivado correctamente",
        beneficio: {
          _id: beneficio._id,
          servicioNombre: beneficio.servicioNombre,
          estado: beneficio.estado,
          fecha_desactivacion: beneficio.fecha_desactivacion,
          motivo_desactivacion: beneficio.motivo_desactivacion,
        },
        sincronizacion: sincronizacionResultados,
      });
    } catch (error) {
      console.error("[DESACTIVAR-API] ❌ Error crítico no controlado:", error);
      console.error("[DESACTIVAR-API] Stack trace:", error.stack);

      res.status(500).json({
        success: false,
        mensaje: "Error interno del servidor",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

// FUNCIÓN AUXILIAR PARA MAPEAR NOMBRES DE SERVICIOS
function mapearNombreServicio(servicioNombre) {
  const mapeoNombres = {
    "Reembolso de costos": "Refund360",
    "Certificado de boletos aéreos": "Voucher Fly Back",
    "Vouchers Flyback": "Voucher Fly Back",
    "Financiamiento de seña": "Entrada Flex",
  };

  return mapeoNombres[servicioNombre] || servicioNombre;
}

// FUNCIÓN AUXILIAR PARA MAPEAR MOTIVOS DE DESACTIVACIÓN PARA FONDOS
function mapearMotivoDesactivacionFondo(motivoServicio) {
  const mapeoMotivos = {
    incumplimiento_pagos: "decision_administrativa",
    decision_administrativa: "decision_administrativa",
    solicitud_beneficiario: "solicitud_beneficiario",
    inactividad_prolongada: "inactividad_prolongada",
    finalizacion_contrato: "finalizacion_contrato",
    cambio_programa: "cambio_programa",
    otros: "otros",
  };

  return mapeoMotivos[motivoServicio] || "otros";
}

// Reactivar un beneficio
router.post(
  "/beneficiario/:usuarioId/reactivar-beneficio",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const { servicioId } = req.body;

      console.log(`[REACTIVAR-API] === INICIANDO REACTIVACIÓN ===`);
      console.log(`[REACTIVAR-API] Usuario: ${usuarioId}`);
      console.log(`[REACTIVAR-API] Servicio: ${servicioId}`);

      // Validaciones básicas
      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({
          success: false,
          mensaje: "ID de usuario inválido",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(servicioId)) {
        return res.status(400).json({
          success: false,
          mensaje: "ID de servicio inválido",
        });
      }

      // PASO 1: Buscar beneficiario
      let beneficiario;
      try {
        beneficiario = await Beneficiario.findById(usuarioId);
        if (!beneficiario) {
          beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
        }

        if (!beneficiario) {
          return res.status(404).json({
            success: false,
            mensaje: "Beneficiario no encontrado",
          });
        }

        console.log(
          `[REACTIVAR-API] ✅ Beneficiario encontrado: ${beneficiario._id}`
        );
      } catch (beneficiarioError) {
        console.error(
          `[REACTIVAR-API] ❌ Error buscando beneficiario:`,
          beneficiarioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficiario",
          error: beneficiarioError.message,
        });
      }

      // PASO 2: Buscar beneficio inactivo y reactivable
      let beneficio;
      try {
        beneficio = await BeneficioBeneficiario.findOne({
          beneficiarioId: beneficiario._id,
          servicioId: servicioId,
          estado: "inactivo",
          puede_reactivar: true,
        });

        if (!beneficio) {
          console.log(
            `[REACTIVAR-API] ❌ Beneficio no encontrado o no puede ser reactivado`
          );

          // Verificar si existe pero no es reactivable
          const beneficioNoReactivable = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicioId,
            estado: "inactivo",
          });

          if (
            beneficioNoReactivable &&
            !beneficioNoReactivable.puede_reactivar
          ) {
            return res.status(400).json({
              success: false,
              mensaje: `El beneficio no puede ser reactivado debido al motivo de desactivación: ${beneficioNoReactivable.motivo_desactivacion}`,
            });
          }

          // Verificar si existe pero en otro estado
          const beneficioOtroEstado = await BeneficioBeneficiario.findOne({
            beneficiarioId: beneficiario._id,
            servicioId: servicioId,
          });

          if (beneficioOtroEstado) {
            return res.status(400).json({
              success: false,
              mensaje: `El beneficio está en estado: ${beneficioOtroEstado.estado}. Solo se pueden reactivar beneficios inactivos.`,
            });
          }

          return res.status(404).json({
            success: false,
            mensaje: "Beneficio no encontrado o no puede ser reactivado",
          });
        }

        console.log(
          `[REACTIVAR-API] ✅ Beneficio encontrado: ${beneficio.servicioNombre}`
        );
      } catch (beneficioError) {
        console.error(
          `[REACTIVAR-API] ❌ Error buscando beneficio:`,
          beneficioError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error buscando beneficio",
          error: beneficioError.message,
        });
      }

      // PASO 3: Reactivar usando el método del modelo (que internamente usa activar)
      try {
        await beneficio.reactivar(req.usuario._id);
        console.log(`[REACTIVAR-API] ✅ Beneficio reactivado en modelo`);
      } catch (reactivarError) {
        console.error(
          `[REACTIVAR-API] ❌ Error reactivando beneficio:`,
          reactivarError
        );
        return res.status(500).json({
          success: false,
          mensaje: "Error reactivando beneficio",
          error: reactivarError.message,
        });
      }

      // PASO 4: SINCRONIZACIÓN MANUAL
      const sincronizacionResultados = {
        codigo_reactivado: false,
        fondo_reactivado: false,
        errores_sincronizacion: [],
      };

      try {
        console.log(`[REACTIVAR-API] Iniciando sincronización manual...`);

        // Normalizar nombre del servicio
        const servicioNormalizado = mapearNombreServicio(
          beneficio.servicioNombre
        );
        console.log(
          `[REACTIVAR-API] Servicio normalizado: ${servicioNormalizado}`
        );

        // Ejecutar sincronización según el tipo de servicio
        if (
          servicioNormalizado === "Refund360" ||
          servicioNormalizado === "Reembolso de costos"
        ) {
          console.log(`[REACTIVAR-API] Reactivando código único...`);

          try {
            if (beneficiario.codigo && !beneficiario.codigo.activo) {
              // Reactivar el código
              beneficiario.codigo.activo = true;
              beneficiario.codigo.estado_activacion = "ACTIVO";
              beneficiario.codigo.fecha_activacion = new Date();

              // Agregar al historial del código
              if (!beneficiario.codigo.historial) {
                beneficiario.codigo.historial = [];
              }

              beneficiario.codigo.historial.push({
                motivo: "REACTIVACION",
                fecha_cambio: new Date(),
                detalles: `Código reactivado por sincronización`,
                codigo_anterior: null,
              });

              await beneficiario.save();
              sincronizacionResultados.codigo_reactivado = true;
              console.log(`[REACTIVAR-API] ✅ Código único reactivado`);
            } else {
              console.log(
                `[REACTIVAR-API] ℹ️ Código único ya estaba activo o no existe`
              );
            }
          } catch (codigoError) {
            console.error(
              `[REACTIVAR-API] ⚠️ Error reactivando código:`,
              codigoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en código: ${codigoError.message}`
            );
          }
        } else if (
          servicioNormalizado === "Voucher Fly Back" ||
          servicioNormalizado === "Vouchers Flyback" ||
          servicioNormalizado === "Certificado de boletos aéreos"
        ) {
          console.log(`[REACTIVAR-API] Reactivando fondo...`);

          try {
            // Importar modelo de fondo
            const { Fondo } = await import("../models/Fondo.js");

            // Buscar fondo del beneficiario
            const fondo = await Fondo.findOne({
              beneficiarioId: beneficiario._id,
            });

            if (fondo) {
              if (fondo.estado !== "activo") {
                // Reactivar fondo
                fondo.estado = "activo";
                fondo.fecha_reactivacion = new Date();
                fondo.actualizado_por = req.usuario._id;

                // Agregar al historial
                fondo.historial_movimientos.push({
                  tipo: "reactivacion",
                  monto_anterior: fondo.saldo_actual.valor,
                  monto_nuevo: fondo.saldo_actual.valor,
                  descripcion: `Fondo reactivado por sincronización`,
                  realizado_por: req.usuario._id,
                  fecha: new Date(),
                });

                await fondo.save();
                sincronizacionResultados.fondo_reactivado = true;
                console.log(`[REACTIVAR-API] ✅ Fondo reactivado`);
              } else {
                console.log(`[REACTIVAR-API] ℹ️ Fondo ya estaba activo`);
              }
            } else {
              console.log(
                `[REACTIVAR-API] ⚠️ Fondo no encontrado, creando nuevo...`
              );

              // Si no existe fondo, crear uno nuevo
              const fechaVencimiento = new Date();
              fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);

              const nuevoFondo = new Fondo({
                beneficiarioId: beneficiario._id,
                monto_inicial: { valor: 500, moneda: "USD" },
                saldo_actual: { valor: 500, moneda: "USD" },
                estado: "activo",
                fecha_vencimiento: fechaVencimiento,
                creado_por: req.usuario._id,
                actualizado_por: req.usuario._id,
                historial_movimientos: [
                  {
                    tipo: "creacion",
                    monto_anterior: 0,
                    monto_nuevo: 500,
                    descripcion: `Fondo creado por reactivación`,
                    realizado_por: req.usuario._id,
                    fecha: new Date(),
                  },
                ],
              });

              await nuevoFondo.save();
              sincronizacionResultados.fondo_reactivado = true;
              console.log(`[REACTIVAR-API] ✅ Fondo creado en reactivación`);
            }
          } catch (fondoError) {
            console.error(
              `[REACTIVAR-API] ⚠️ Error reactivando fondo:`,
              fondoError.message
            );
            sincronizacionResultados.errores_sincronizacion.push(
              `Error en fondo: ${fondoError.message}`
            );
          }
        } else {
          console.log(
            `[REACTIVAR-API] ℹ️ Servicio sin sincronización: ${servicioNormalizado}`
          );
        }
      } catch (syncError) {
        console.error(
          `[REACTIVAR-API] ⚠️ Error en sincronización general:`,
          syncError
        );
        sincronizacionResultados.errores_sincronizacion.push(
          `Error general: ${syncError.message}`
        );
      }

      // PASO 5: Respuesta exitosa
      console.log(`[REACTIVAR-API] ✅ Reactivación completa finalizada`);

      res.json({
        success: true,
        mensaje: "Beneficio reactivado correctamente",
        beneficio: {
          _id: beneficio._id,
          servicioNombre: beneficio.servicioNombre,
          estado: beneficio.estado,
          fecha_reactivacion: beneficio.fecha_reactivacion,
        },
        sincronizacion: sincronizacionResultados,
      });
    } catch (error) {
      console.error("[REACTIVAR-API] ❌ Error crítico no controlado:", error);
      console.error("[REACTIVAR-API] Stack trace:", error.stack);

      res.status(500).json({
        success: false,
        mensaje: "Error interno del servidor",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

router.post(
  "/beneficiario/:usuarioId/asignar-beneficio",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const { servicioId, servicioNombre } = req.body;

      console.log(
        `[ASIGNAR] Asignando servicio ${servicioId} a usuario ${usuarioId}`
      );

      if (
        !mongoose.Types.ObjectId.isValid(usuarioId) ||
        !mongoose.Types.ObjectId.isValid(servicioId)
      ) {
        return res.status(400).json({
          success: false,
          mensaje: "IDs inválidos",
        });
      }

      let beneficiario = await Beneficiario.findById(usuarioId);
      if (!beneficiario) {
        beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
      }

      if (!beneficiario) {
        return res.status(404).json({
          success: false,
          mensaje: "Beneficiario no encontrado",
        });
      }

      const servicio = await Servicio.findById(servicioId);
      if (!servicio) {
        return res.status(404).json({
          success: false,
          mensaje: "Servicio no encontrado",
        });
      }

      const beneficioExistente = await BeneficioBeneficiario.findOne({
        beneficiarioId: beneficiario._id,
        servicioId: servicioId,
      });

      if (beneficioExistente) {
        return res.status(400).json({
          success: false,
          mensaje: "El servicio ya está asignado a este beneficiario",
        });
      }

      // CREAR EL BENEFICIO SIN HISTORIAL INICIAL
      const nuevoBeneficio = new BeneficioBeneficiario({
        beneficiarioId: beneficiario._id,
        servicioId: servicioId,
        servicioNombre: servicioNombre || servicio.nombre,
        estado: "pendiente_activacion",
        creado_por: req.usuario._id,
        actualizado_por: req.usuario._id,
        // NO incluir historial_estados aquí - se agregará después de guardar
      });

      // Guardar primero el beneficio
      await nuevoBeneficio.save();

      // DESPUÉS agregar al historial manualmente - SIN estado_anterior
      nuevoBeneficio.historial_estados.push({
        estado_nuevo: "pendiente_activacion",
        fecha_cambio: new Date(),
        motivo: "Servicio asignado manualmente desde perfil de beneficiario",
        procesado_por: req.usuario._id,
        // NO incluir estado_anterior
      });

      // Guardar con el historial agregado
      await nuevoBeneficio.save();

      // También agregar al campo servicios del beneficiario (para compatibilidad)
      if (!beneficiario.servicios.includes(servicioId.toString())) {
        beneficiario.servicios.push(servicioId.toString());
        await beneficiario.save();
      }

      console.log(
        `[ASIGNAR] ✅ Servicio asignado exitosamente: ${servicio.nombre}`
      );

      res.json({
        success: true,
        mensaje: "Servicio asignado correctamente",
        beneficio: {
          _id: nuevoBeneficio._id,
          servicioId: nuevoBeneficio.servicioId,
          servicioNombre: nuevoBeneficio.servicioNombre,
          estado: nuevoBeneficio.estado,
          fecha_creacion: nuevoBeneficio.createdAt,
        },
      });
    } catch (error) {
      console.error("[ASIGNAR] Error:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error interno del servidor",
        error: error.message,
      });
    }
  }
);
// Renovar voucher
router.post(
  "/beneficiario/:usuarioId/renovar-voucher/:beneficioId",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId, beneficioId } = req.params;

      console.log(
        "🔄 Renovando voucher:",
        beneficioId,
        "para usuario:",
        usuarioId
      );

      if (!mongoose.Types.ObjectId.isValid(beneficioId)) {
        return res.status(400).json({
          error: "ID inválido",
          mensaje: "El ID del beneficio no tiene un formato válido",
        });
      }

      // CORRECCIÓN: Buscar beneficiario por _id O por usuario_id
      let beneficiario = await Beneficiario.findById(usuarioId);
      if (!beneficiario) {
        beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
      }

      if (!beneficiario) {
        return res.status(404).json({
          error: "Beneficiario no encontrado",
        });
      }

      // Buscar el beneficio
      const beneficio = await BeneficioBeneficiario.findOne({
        _id: beneficioId,
        beneficiarioId: beneficiario._id,
      });

      if (!beneficio) {
        return res.status(404).json({
          error: "Beneficio no encontrado",
        });
      }

      // Verificar que sea un voucher y se pueda renovar
      if (!beneficio.puedeRenovarVoucher()) {
        return res.status(400).json({
          error: "No se puede renovar",
          mensaje: "El voucher no cumple con los requisitos para renovación",
          detalles: {
            renovaciones_utilizadas:
              beneficio.voucher_data?.renovaciones_utilizadas || 0,
            renovaciones_maximas: 10,
            proxima_renovacion:
              beneficio.voucher_data?.proxima_renovacion_disponible,
          },
        });
      }

      // Renovar voucher
      await beneficio.renovarVoucher(req.usuario._id);

      console.log("✅ Voucher renovado exitosamente");

      res.json({
        success: true,
        mensaje: "Voucher renovado exitosamente",
        voucher: {
          saldo_actual: beneficio.voucher_data.saldo_actual,
          renovaciones_utilizadas:
            beneficio.voucher_data.renovaciones_utilizadas,
          renovaciones_restantes:
            10 - beneficio.voucher_data.renovaciones_utilizadas,
          proxima_renovacion_disponible:
            beneficio.voucher_data.proxima_renovacion_disponible,
        },
      });
    } catch (error) {
      console.error("Error al renovar voucher:", error);
      res.status(500).json({
        error: "Error al renovar voucher",
        mensaje: error.message,
      });
    }
  }
);
// Ruta para desactivar manualmente solo el código único
router.post(
  "/debug/desactivar-codigo/:usuarioId",
  checkAuth,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      console.log(
        `[DESACTIVAR-CODIGO] Desactivando código manualmente para usuario: ${usuarioId}`
      );

      // Buscar beneficiario
      const { Beneficiario } = await import("../models/Beneficiario.js");
      const beneficiario = await Beneficiario.findById(usuarioId);

      if (!beneficiario) {
        return res.status(404).json({ error: "Beneficiario no encontrado" });
      }

      if (!beneficiario.codigo || !beneficiario.codigo.activo) {
        return res.json({
          success: true,
          mensaje: "Código ya estaba inactivo o no existe",
          estado_anterior: beneficiario.codigo?.activo || false,
        });
      }

      // Desactivar código
      beneficiario.codigo.activo = false;
      beneficiario.codigo.estado_activacion = "SUSPENDIDO";

      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }

      beneficiario.codigo.historial.push({
        motivo: "CANCELACION",
        fecha_cambio: new Date(),
        detalles: "Código desactivado manualmente desde debug",
        codigo_anterior: null,
      });

      await beneficiario.save();

      console.log(`[DESACTIVAR-CODIGO] ✅ Código desactivado exitosamente`);

      res.json({
        success: true,
        mensaje: "Código desactivado manualmente",
        estado_nuevo: {
          activo: beneficiario.codigo.activo,
          estado_activacion: beneficiario.codigo.estado_activacion,
        },
      });
    } catch (error) {
      console.error("[DESACTIVAR-CODIGO] Error:", error);
      res.status(500).json({
        error: "Error desactivando código",
        mensaje: error.message,
      });
    }
  }
);

// Obtener beneficios reactivables
router.get(
  "/beneficiario/:usuarioId/reactivables",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({
          success: false,
          error: "ID inválido",
          mensaje: "El ID de usuario no tiene un formato válido",
        });
      }

      // CORRECCIÓN: Buscar beneficiario por _id O por usuario_id
      let beneficiario = await Beneficiario.findById(usuarioId);
      if (!beneficiario) {
        beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
      }

      if (!beneficiario) {
        return res.status(404).json({
          success: false,
          error: "Beneficiario no encontrado",
          mensaje: "No se encontró un beneficiario asociado a este usuario",
        });
      }

      // Obtener beneficios reactivables
      const beneficiosReactivables =
        await BeneficioBeneficiario.getBeneficiosReactivables(beneficiario._id);

      res.json({
        success: true,
        beneficios_reactivables: beneficiosReactivables,
        total: beneficiosReactivables.length,
      });
    } catch (error) {
      console.error("❌ Error al obtener beneficios reactivables:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        mensaje: "No se pudieron obtener los beneficios reactivables",
      });
    }
  }
);

// Obtener historial de servicios de un usuario
// REEMPLAZAR completamente el endpoint GET /usuario/:usuarioId en serviciosRoutes.js

router.get("/usuario/:usuarioId", async (req, res) => {
  try {
    const { usuarioId } = req.params;

    console.log(`[HISTORIAL] === INICIO CONSULTA ===`);
    console.log(`[HISTORIAL] Buscando historial para usuario: ${usuarioId}`);

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      console.log(`[HISTORIAL] ❌ ID inválido: ${usuarioId}`);
      return res.status(400).json({
        error: "ID de usuario inválido",
        mensaje: "El ID proporcionado no tiene un formato válido",
      });
    }

    // Buscar TODOS los registros de historial para este usuario
    const historialServicios = await HistorialServicio.find({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
    })
      .sort({ fecha: -1 }) // Ordenar por fecha descendente
      .lean(); // Para mejor performance

    console.log(
      `[HISTORIAL] 📊 REGISTROS ENCONTRADOS: ${historialServicios.length}`
    );

    // Log detallado de cada registro encontrado
    historialServicios.forEach((registro, index) => {
      console.log(`[HISTORIAL] Registro ${index + 1}:`, {
        _id: registro._id?.toString().substring(0, 8) + "...",
        servicioNombre: registro.servicioNombre,
        accion: registro.accion,
        estado_actual: registro.estado_actual,
        fecha: registro.fecha,
        usuario: registro.usuario,
      });
    });

    // Formatear respuesta SIN FILTROS - devolver TODO
    const historialFormateado = historialServicios.map((registro, index) => {
      const formateado = {
        _id: registro._id?.toString() || null,
        usuarioId: registro.usuarioId?.toString() || null,
        servicioId: registro.servicioId?.toString() || null,
        servicioNombre: registro.servicioNombre || null,
        accion: registro.accion || "desconocida",
        estado_actual: registro.estado_actual || "desconocido",
        tipo_usuario: registro.tipo_usuario || "beneficiario",
        fecha: registro.fecha || new Date(),
        fecha_asignacion: registro.fecha_asignacion || registro.fecha,
        fecha_activacion: registro.fecha_activacion || null,
        usuario: registro.usuario || "Sistema",
        notas: registro.notas || "",
      };

      console.log(`[HISTORIAL] Formateado ${index + 1}:`, {
        servicioNombre: formateado.servicioNombre,
        accion: formateado.accion,
        estado_actual: formateado.estado_actual,
        fecha: formateado.fecha,
      });

      return formateado;
    });

    // Completar nombres de servicios faltantes o incorrectos
    const serviciosSinNombre = historialFormateado.filter(
      (r) =>
        !r.servicioNombre ||
        r.servicioNombre.startsWith("Servicio #") ||
        r.servicioNombre === "Servicio sin nombre"
    );

    if (serviciosSinNombre.length > 0) {
      console.log(
        `[HISTORIAL] 🔍 Completando ${serviciosSinNombre.length} nombres de servicios...`
      );

      const servicioIds = [
        ...new Set(serviciosSinNombre.map((r) => r.servicioId).filter(Boolean)),
      ];

      if (servicioIds.length > 0) {
        try {
          const servicios = await Servicio.find({
            _id: {
              $in: servicioIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          });

          const servicioMap = Object.fromEntries(
            servicios.map((s) => [s._id.toString(), s.nombre])
          );

          console.log(`[HISTORIAL] 📝 Servicios encontrados:`, servicioMap);

          historialFormateado.forEach((registro) => {
            if (
              (!registro.servicioNombre ||
                registro.servicioNombre.startsWith("Servicio #") ||
                registro.servicioNombre === "Servicio sin nombre") &&
              registro.servicioId &&
              servicioMap[registro.servicioId]
            ) {
              const nombreAnterior = registro.servicioNombre;
              registro.servicioNombre = servicioMap[registro.servicioId];

              console.log(
                `[HISTORIAL] ✅ Nombre actualizado: "${nombreAnterior}" -> "${registro.servicioNombre}"`
              );
            }
          });
        } catch (servicioError) {
          console.warn(
            `[HISTORIAL] ⚠️ Error al buscar nombres de servicios:`,
            servicioError.message
          );
        }
      }
    }

    console.log(`[HISTORIAL] === RESULTADO FINAL ===`);
    console.log(
      `[HISTORIAL] Total registros devueltos: ${historialFormateado.length}`
    );

    // Resumen por acción
    const resumenPorAccion = historialFormateado.reduce((acc, reg) => {
      acc[reg.accion] = (acc[reg.accion] || 0) + 1;
      return acc;
    }, {});
    console.log(`[HISTORIAL] Resumen por acción:`, resumenPorAccion);

    // Resumen por estado
    const resumenPorEstado = historialFormateado.reduce((acc, reg) => {
      acc[reg.estado_actual] = (acc[reg.estado_actual] || 0) + 1;
      return acc;
    }, {});
    console.log(`[HISTORIAL] Resumen por estado:`, resumenPorEstado);

    // DEVOLVER TODOS LOS REGISTROS
    res.json(historialFormateado);
  } catch (error) {
    console.error("[HISTORIAL] ❌ ERROR CRÍTICO:", error);
    console.error("[HISTORIAL] Stack trace:", error.stack);

    res.status(500).json({
      error: "Error al obtener historial",
      mensaje: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Registrar historial

router.post("/batch", async (req, res) => {
  try {
    console.log("[BATCH] 🔄 Iniciando registro batch");
    console.log("[BATCH] Datos recibidos:", JSON.stringify(req.body, null, 2));

    const { usuarioId, cambios } = req.body;

    // === VALIDACIONES BÁSICAS ===
    if (!usuarioId || !mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({
        error: "usuarioId inválido o faltante",
        usuarioId: usuarioId,
      });
    }

    if (!Array.isArray(cambios) || cambios.length === 0) {
      return res.status(400).json({
        error: "Se requiere un array de cambios no vacío",
        cambios: cambios,
      });
    }

    // === VALIDAR CAMBIOS Y COMPLETAR NOMBRES DE SERVICIOS ===
    const servicioIds = [
      ...new Set(cambios.map((c) => c.servicioId).filter(Boolean)),
    ];
    let serviciosMap = {};

    if (servicioIds.length > 0) {
      try {
        const servicios = await Servicio.find({
          _id: {
            $in: servicioIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        });
        serviciosMap = Object.fromEntries(
          servicios.map((s) => [s._id.toString(), s.nombre])
        );
        console.log("[BATCH] Servicios encontrados:", serviciosMap);
      } catch (servicioError) {
        console.warn(
          "[BATCH] Error al buscar servicios:",
          servicioError.message
        );
      }
    }

    // === PROCESAR CADA CAMBIO ===
    const documentos = [];
    const errores = [];

    for (let i = 0; i < cambios.length; i++) {
      const cambio = cambios[i];

      try {
        // Validaciones del cambio
        if (
          !cambio.servicioId ||
          !mongoose.Types.ObjectId.isValid(cambio.servicioId)
        ) {
          errores.push(`Cambio ${i + 1}: servicioId inválido`);
          continue;
        }

        if (!cambio.accion) {
          errores.push(`Cambio ${i + 1}: acción requerida`);
          continue;
        }

        const accionesValidas = [
          "activado",
          "desactivado",
          "asignado",
          "suspendido",
          "reactivado",
          "pendiente_activacion",
        ];
        if (!accionesValidas.includes(cambio.accion)) {
          errores.push(`Cambio ${i + 1}: acción inválida (${cambio.accion})`);
          continue;
        }

        // Obtener nombre del servicio
        const servicioIdStr = cambio.servicioId.toString();
        let servicioNombre = cambio.servicioNombre;

        if (!servicioNombre || servicioNombre.startsWith("Servicio #")) {
          servicioNombre =
            serviciosMap[servicioIdStr] ||
            servicioNombre ||
            `Servicio #${servicioIdStr.substring(0, 8)}`;
        }

        // Fechas
        const fechaCambio = cambio.fecha ? new Date(cambio.fecha) : new Date();
        if (isNaN(fechaCambio.getTime())) {
          fechaCambio = new Date();
        }

        // Crear documento
        const documento = {
          usuarioId: new mongoose.Types.ObjectId(usuarioId),
          servicioId: new mongoose.Types.ObjectId(cambio.servicioId),
          servicioNombre: servicioNombre,
          accion: cambio.accion,

          // Fechas
          fecha: fechaCambio,
          fecha_asignacion: cambio.fecha_asignacion
            ? new Date(cambio.fecha_asignacion)
            : fechaCambio,
          fecha_activacion:
            cambio.accion === "activado" || cambio.accion === "reactivado"
              ? cambio.fecha_activacion
                ? new Date(cambio.fecha_activacion)
                : fechaCambio
              : null,

          // Estados
          estado_actual:
            cambio.estado_actual ||
            (() => {
              switch (cambio.accion) {
                case "activado":
                case "reactivado":
                  return "activo";
                case "desactivado":
                  return "inactivo";
                case "suspendido":
                  return "suspendido";
                case "pendiente_activacion":
                  return "pendiente_activacion";
                case "asignado":
                  return "asignado";
                default:
                  return "asignado";
              }
            })(),

          // Otros campos
          tipo_usuario: cambio.tipo_usuario || "beneficiario",
          usuario: cambio.usuario || "Sistema",
          notas: cambio.notas || "",
        };

        // Validar fechas convertidas
        if (
          documento.fecha_asignacion &&
          isNaN(documento.fecha_asignacion.getTime())
        ) {
          documento.fecha_asignacion = fechaCambio;
        }
        if (
          documento.fecha_activacion &&
          isNaN(documento.fecha_activacion.getTime())
        ) {
          documento.fecha_activacion = fechaCambio;
        }

        documentos.push(documento);

        console.log(`[BATCH] ✅ Documento ${i + 1} preparado:`, {
          servicioNombre: documento.servicioNombre,
          accion: documento.accion,
          estado_actual: documento.estado_actual,
          usuario: documento.usuario,
          fecha: documento.fecha.toISOString(),
        });
      } catch (docError) {
        console.error(`[BATCH] ❌ Error procesando cambio ${i + 1}:`, docError);
        errores.push(`Cambio ${i + 1}: ${docError.message}`);
      }
    }

    // Si hay errores, devolver
    if (errores.length > 0) {
      return res.status(400).json({
        error: "Errores de validación",
        errores: errores,
        documentos_validos: documentos.length,
      });
    }

    if (documentos.length === 0) {
      return res.status(400).json({
        error: "No hay documentos válidos para insertar",
      });
    }

    console.log(
      `[BATCH] 📝 Insertando ${documentos.length} documentos en BD...`
    );

    // === VERIFICAR DUPLICADOS ANTES DE INSERTAR ===
    const documentosSinDuplicados = [];

    for (const doc of documentos) {
      // Buscar duplicados recientes (último minuto)
      const fechaLimite = new Date(doc.fecha.getTime() - 60000); // 1 minuto antes

      const duplicado = await HistorialServicio.findOne({
        usuarioId: doc.usuarioId,
        servicioId: doc.servicioId,
        accion: doc.accion,
        fecha: {
          $gte: fechaLimite,
          $lte: new Date(doc.fecha.getTime() + 60000), // 1 minuto después
        },
      });

      if (!duplicado) {
        documentosSinDuplicados.push(doc);
        console.log(
          `[BATCH] ✅ Documento único: ${doc.servicioNombre} - ${doc.accion}`
        );
      } else {
        console.log(
          `[BATCH] ⚠️ Duplicado evitado: ${doc.servicioNombre} - ${doc.accion}`
        );
      }
    }

    if (documentosSinDuplicados.length === 0) {
      console.log("[BATCH] ℹ️ Todos los documentos eran duplicados");
      return res.status(200).json({
        mensaje: "Todos los registros ya existían, no se insertaron duplicados",
        duplicados_evitados: documentos.length,
      });
    }

    // === INSERTAR DOCUMENTOS ===
    let resultado;
    try {
      resultado = await HistorialServicio.insertMany(documentosSinDuplicados, {
        ordered: false,
      });
      console.log(
        `[BATCH] ✅ Insertados exitosamente: ${resultado.length} registros`
      );
    } catch (insertError) {
      console.error("[BATCH] ❌ Error en insertMany:", insertError);

      // Si es error de duplicados de MongoDB, intentar inserción individual
      if (
        insertError.code === 11000 ||
        insertError.message.includes("duplicate")
      ) {
        console.log(
          "[BATCH] 🔄 Intentando inserción individual para evitar duplicados..."
        );
        resultado = [];

        for (const doc of documentosSinDuplicados) {
          try {
            const nuevoDoc = new HistorialServicio(doc);
            const guardado = await nuevoDoc.save();
            resultado.push(guardado);
            console.log(
              `[BATCH] ✅ Insertado individualmente: ${doc.servicioNombre}`
            );
          } catch (individualError) {
            if (individualError.code !== 11000) {
              console.error(
                `[BATCH] ❌ Error individual:`,
                individualError.message
              );
            }
          }
        }
      } else {
        throw insertError;
      }
    }

    if (!resultado || resultado.length === 0) {
      return res.status(500).json({
        error: "No se pudo insertar ningún registro",
        documentos_intentados: documentosSinDuplicados.length,
      });
    }

    // === FORMATEAR RESPUESTA ===
    const resultadoFormateado = resultado.map((item) => ({
      _id: item._id?.toString() || null,
      usuarioId: item.usuarioId?.toString() || null,
      servicioId: item.servicioId?.toString() || null,
      servicioNombre: item.servicioNombre || null,
      accion: item.accion,
      estado_actual: item.estado_actual,
      tipo_usuario: item.tipo_usuario,
      fecha: item.fecha,
      fecha_asignacion: item.fecha_asignacion,
      fecha_activacion: item.fecha_activacion,
      usuario: item.usuario,
      notas: item.notas,
    }));

    console.log(
      `[BATCH] ✅ Respuesta preparada con ${resultadoFormateado.length} registros`
    );

    res.status(201).json(resultadoFormateado);
  } catch (error) {
    console.error("[BATCH] ❌ Error crítico:", error);
    res.status(500).json({
      error: "Error crítico al registrar historial",
      mensaje: error.message,
      tipo: error.name,
    });
  }
});
// Debug route
router.get("/debug", (req, res) => {
  res.json({
    message: "Rutas de servicios funcionando correctamente",
    available_routes: [
      "GET /",
      "GET /beneficiario/:usuarioId/beneficios",
      "POST /beneficiario/:usuarioId/activar-beneficio",
      "POST /beneficiario/:usuarioId/renovar-voucher/:beneficioId",
      "GET /usuario/:usuarioId",
      "POST /batch",
    ],
  });
});

router.get("/beneficiario/:usuarioId/beneficios-test", (req, res) => {
  console.log("TEST ROUTE HIT:", req.params);
  res.json({
    message: "Test route working!",
    usuarioId: req.params.usuarioId,
  });
});

// Agregar esta ruta de diagnóstico súper completa en serviciosRoutes.js

router.get("/debug/historial-completo/:usuarioId", async (req, res) => {
  try {
    const { usuarioId } = req.params;

    console.log(`[DIAGNÓSTICO] === ANÁLISIS SÚPER COMPLETO ===`);
    console.log(`[DIAGNÓSTICO] Usuario ID: ${usuarioId}`);

    const diagnostico = {
      usuario_id_recibido: usuarioId,
      usuario_id_valido: mongoose.Types.ObjectId.isValid(usuarioId),
      timestamp: new Date().toISOString(),
      busquedas: {},
    };

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.json({ error: "ID inválido", diagnostico });
    }

    // 1. Buscar por usuarioId exacto
    console.log("[DIAGNÓSTICO] 1. Buscando por usuarioId exacto...");
    const porUsuarioId = await HistorialServicio.find({
      usuarioId: new mongoose.Types.ObjectId(usuarioId),
    }).lean();

    diagnostico.busquedas.por_usuario_id = {
      total: porUsuarioId.length,
      registros: porUsuarioId.map((r) => ({
        _id: r._id?.toString(),
        servicioId: r.servicioId?.toString(),
        servicioNombre: r.servicioNombre,
        accion: r.accion,
        estado_actual: r.estado_actual,
        fecha: r.fecha,
        usuario: r.usuario,
      })),
    };

    // 2. Buscar TODOS los registros de HistorialServicio para ver qué hay
    console.log("[DIAGNÓSTICO] 2. Buscando TODOS los registros...");
    const todosLosRegistros = await HistorialServicio.find({}).limit(20).lean();

    diagnostico.busquedas.todos_los_registros = {
      total_en_db: await HistorialServicio.countDocuments(),
      muestra: todosLosRegistros.map((r) => ({
        _id: r._id?.toString(),
        usuarioId: r.usuarioId?.toString(),
        servicioId: r.servicioId?.toString(),
        servicioNombre: r.servicioNombre,
        accion: r.accion,
        estado_actual: r.estado_actual,
        fecha: r.fecha,
      })),
    };

    // 3. Buscar registros que contengan el userId como string
    console.log("[DIAGNÓSTICO] 3. Buscando por userId como string...");
    const porUsuarioString = await HistorialServicio.find({
      usuarioId: usuarioId, // Sin convertir a ObjectId
    }).lean();

    diagnostico.busquedas.por_usuario_string = {
      total: porUsuarioString.length,
      registros: porUsuarioString,
    };

    // 4. Buscar registros con acciones específicas
    console.log("[DIAGNÓSTICO] 4. Buscando por acciones específicas...");
    const porAcciones = {};
    const acciones = [
      "pendiente_activacion",
      "asignado",
      "activado",
      "desactivado",
    ];

    for (const accion of acciones) {
      const registros = await HistorialServicio.find({ accion }).lean();
      porAcciones[accion] = {
        total: registros.length,
        con_este_usuario: registros.filter(
          (r) =>
            r.usuarioId?.toString() === usuarioId || r.usuarioId === usuarioId
        ).length,
      };
    }

    diagnostico.busquedas.por_acciones = porAcciones;

    // 5. Verificar si existe el usuario en otras colecciones
    console.log("[DIAGNÓSTICO] 5. Verificando usuario en otras colecciones...");

    // Verificar en Usuario
    const usuario = await mongoose.connection.db
      .collection("usuarios")
      .findOne({
        _id: new mongoose.Types.ObjectId(usuarioId),
      });

    diagnostico.usuario_existe = {
      en_usuarios: !!usuario,
      datos_usuario: usuario
        ? {
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            tipo: usuario.tipo,
            servicios: usuario.servicios,
          }
        : null,
    };

    // Verificar en Beneficiario si existe
    try {
      const beneficiario = await mongoose.connection.db
        .collection("beneficiarios")
        .findOne({
          usuario_id: new mongoose.Types.ObjectId(usuarioId),
        });

      diagnostico.usuario_existe.en_beneficiarios = !!beneficiario;
      if (beneficiario) {
        diagnostico.usuario_existe.beneficiario_id =
          beneficiario._id?.toString();
      }
    } catch (e) {
      diagnostico.usuario_existe.en_beneficiarios = "colección no existe";
    }

    // 6. Buscar por diferentes variantes del ID
    console.log("[DIAGNÓSTICO] 6. Buscando variantes del ID...");
    const variantes = [
      usuarioId,
      new mongoose.Types.ObjectId(usuarioId),
      usuarioId.toString(),
    ];

    diagnostico.busquedas.variantes = {};
    for (let i = 0; i < variantes.length; i++) {
      const variante = variantes[i];
      try {
        const resultados = await HistorialServicio.find({
          $or: [{ usuarioId: variante }, { usuarioId: variante.toString() }],
        }).lean();

        diagnostico.busquedas.variantes[`variante_${i}`] = {
          valor: variante.toString(),
          tipo: typeof variante,
          resultados: resultados.length,
        };
      } catch (e) {
        diagnostico.busquedas.variantes[`variante_${i}`] = {
          valor: variante.toString(),
          error: e.message,
        };
      }
    }

    // 7. Estadísticas generales
    diagnostico.estadisticas = {
      total_registros_historial: await HistorialServicio.countDocuments(),
      registros_por_accion: {},
      usuarios_unicos: [],
    };

    const estadisticasAccion = await HistorialServicio.aggregate([
      { $group: { _id: "$accion", count: { $sum: 1 } } },
    ]);

    estadisticasAccion.forEach((stat) => {
      diagnostico.estadisticas.registros_por_accion[stat._id] = stat.count;
    });

    const usuariosUnicos = await HistorialServicio.aggregate([
      { $group: { _id: "$usuarioId" } },
      { $limit: 10 },
    ]);

    diagnostico.estadisticas.usuarios_unicos = usuariosUnicos.map((u) =>
      u._id?.toString()
    );

    console.log("[DIAGNÓSTICO] Diagnóstico completo generado");

    res.json({
      success: true,
      diagnostico: diagnostico,
    });
  } catch (error) {
    console.error("[DIAGNÓSTICO] Error:", error);
    res.status(500).json({
      error: "Error en diagnóstico completo",
      mensaje: error.message,
      stack: error.stack,
    });
  }
});
// Agregar esta ruta específica para limpiar los duplicados que tienes

router.post(
  "/admin/limpiar-duplicados-usuario/:usuarioId",
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      console.log(`[LIMPIEZA] Limpiando duplicados para usuario: ${usuarioId}`);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // Buscar todos los registros del usuario
      const registros = await HistorialServicio.find({
        usuarioId: new mongoose.Types.ObjectId(usuarioId),
      }).sort({ fecha: -1 });

      console.log(`[LIMPIEZA] Registros encontrados: ${registros.length}`);

      // Agrupar por servicioId y acción
      const grupos = {};
      registros.forEach((registro) => {
        const key = `${registro.servicioId}-${registro.accion}`;
        if (!grupos[key]) {
          grupos[key] = [];
        }
        grupos[key].push(registro);
      });

      let eliminados = 0;
      let mantenidos = 0;

      console.log(
        `[LIMPIEZA] Grupos encontrados: ${Object.keys(grupos).length}`
      );

      for (const [key, grupoRegistros] of Object.entries(grupos)) {
        if (grupoRegistros.length > 1) {
          console.log(
            `[LIMPIEZA] Procesando grupo ${key}: ${grupoRegistros.length} registros`
          );

          // Ordenar por fecha, mantener el más reciente
          const ordenados = grupoRegistros.sort(
            (a, b) => new Date(b.fecha) - new Date(a.fecha)
          );
          const mantener = ordenados[0];
          const aEliminar = ordenados.slice(1);

          console.log(
            `[LIMPIEZA] Manteniendo: ${mantener._id} (${mantener.fecha})`
          );

          for (const registro of aEliminar) {
            try {
              await HistorialServicio.findByIdAndDelete(registro._id);
              eliminados++;
              console.log(
                `[LIMPIEZA] Eliminado: ${registro._id} (${registro.fecha})`
              );
            } catch (deleteError) {
              console.error(
                `[LIMPIEZA] Error eliminando ${registro._id}:`,
                deleteError.message
              );
            }
          }

          mantenidos++;
        } else {
          mantenidos++;
          console.log(`[LIMPIEZA] Grupo ${key}: único registro, no se toca`);
        }
      }

      console.log(`[LIMPIEZA] ✅ Limpieza completada:`);
      console.log(`[LIMPIEZA] - Registros eliminados: ${eliminados}`);
      console.log(`[LIMPIEZA] - Grupos únicos mantenidos: ${mantenidos}`);

      res.json({
        success: true,
        mensaje: "Duplicados eliminados exitosamente",
        estadisticas: {
          registros_eliminados: eliminados,
          grupos_mantenidos: mantenidos,
          total_grupos_procesados: Object.keys(grupos).length,
        },
      });
    } catch (error) {
      console.error("[LIMPIEZA] Error:", error);
      res.status(500).json({
        error: "Error limpiando duplicados",
        mensaje: error.message,
      });
    }
  }
);

router.post(
  "/admin/recrear-historial/:usuarioId",
  checkAuth,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      console.log(`[RECREAR] Recreando historial para usuario: ${usuarioId}`);

      if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // 1. Eliminar registros existentes del usuario
      const eliminados = await HistorialServicio.deleteMany({
        usuarioId: new mongoose.Types.ObjectId(usuarioId),
      });

      console.log(`[RECREAR] Registros eliminados: ${eliminados.deletedCount}`);

      // 2. Buscar usuario real (puede estar en diferentes colecciones)
      let usuario = null;
      let serviciosAsignados = [];

      // Buscar en colección usuarios
      try {
        usuario = await mongoose.connection.db.collection("usuarios").findOne({
          _id: new mongoose.Types.ObjectId(usuarioId),
        });

        if (usuario && usuario.servicios) {
          serviciosAsignados = usuario.servicios;
        }
      } catch (e) {
        console.log("[RECREAR] Usuario no encontrado en usuarios");
      }

      // Buscar en colección beneficiarios si existe
      if (!usuario) {
        try {
          const beneficiario = await mongoose.connection.db
            .collection("beneficiarios")
            .findOne({
              $or: [
                { _id: new mongoose.Types.ObjectId(usuarioId) },
                { usuario_id: new mongoose.Types.ObjectId(usuarioId) },
              ],
            });

          if (beneficiario) {
            usuario = beneficiario;
            if (beneficiario.servicios) {
              serviciosAsignados = beneficiario.servicios;
            }
          }
        } catch (e) {
          console.log("[RECREAR] Usuario no encontrado en beneficiarios");
        }
      }

      if (!usuario) {
        return res.status(404).json({
          error: "Usuario no encontrado en ninguna colección",
          mensaje: "Verifica que el usuario existe y está correctamente creado",
        });
      }

      console.log(`[RECREAR] Usuario encontrado:`, {
        nombre: usuario.nombre,
        servicios: serviciosAsignados,
      });

      // 3. Obtener servicios de beneficiario disponibles
      const serviciosBeneficiario = await Servicio.find({
        nombre: {
          $in: [
            "Financiamiento de seña",
            "Certificado de boletos aéreos",
            "Reembolso de costos",
          ],
        },
      });

      const serviciosMap = Object.fromEntries(
        serviciosBeneficiario.map((s) => [s._id.toString(), s.nombre])
      );

      console.log(
        `[RECREAR] Servicios de beneficiario disponibles:`,
        serviciosMap
      );

      // 4. Crear historial inicial correcto
      const fechaInicial = new Date();
      const registrosIniciales = [];

      for (const servicio of serviciosBeneficiario) {
        const servicioIdStr = servicio._id.toString();
        const estaAsignado = serviciosAsignados.some(
          (s) => s.toString() === servicioIdStr
        );

        if (estaAsignado) {
          // Crear registro de asignación inicial
          registrosIniciales.push({
            usuarioId: new mongoose.Types.ObjectId(usuarioId),
            servicioId: servicio._id,
            servicioNombre: servicio.nombre,
            accion: "pendiente_activacion",
            estado_actual: "pendiente_activacion",
            tipo_usuario: "beneficiario",
            usuario: "Sistema (Historial inicial)",
            fecha: fechaInicial,
            fecha_asignacion: fechaInicial,
            fecha_activacion: null,
            notas: "Servicio asignado - pendiente de activación por el equipo",
          });

          console.log(`[RECREAR] Agregado como PENDIENTE: ${servicio.nombre}`);
        }
      }

      // 5. Insertar registros iniciales
      if (registrosIniciales.length > 0) {
        const resultado = await HistorialServicio.insertMany(
          registrosIniciales
        );
        console.log(
          `[RECREAR] ✅ Historial inicial creado: ${resultado.length} registros`
        );

        res.json({
          success: true,
          mensaje: "Historial recreado exitosamente",
          estadisticas: {
            registros_eliminados: eliminados.deletedCount,
            registros_creados: resultado.length,
            servicios_pendientes: resultado.length,
          },
          historial_inicial: resultado.map((r) => ({
            _id: r._id.toString(),
            servicioNombre: r.servicioNombre,
            accion: r.accion,
            estado_actual: r.estado_actual,
            fecha: r.fecha,
          })),
        });
      } else {
        res.json({
          success: true,
          mensaje: "Usuario no tiene servicios asignados",
          estadisticas: {
            registros_eliminados: eliminados.deletedCount,
            registros_creados: 0,
          },
        });
      }
    } catch (error) {
      console.error("[RECREAR] Error:", error);
      res.status(500).json({
        error: "Error recreando historial",
        mensaje: error.message,
      });
    }
  }
);

// 3. RUTA PARA ACTIVAR SERVICIOS CORRECTAMENTE
router.post(
  "/admin/activar-servicio-historial",
  checkAuth,
  async (req, res) => {
    try {
      const { usuarioId, servicioId, nombreUsuario } = req.body;

      console.log(
        `[ACTIVAR] Activando servicio ${servicioId} para usuario ${usuarioId}`
      );

      if (
        !mongoose.Types.ObjectId.isValid(usuarioId) ||
        !mongoose.Types.ObjectId.isValid(servicioId)
      ) {
        return res.status(400).json({ error: "IDs inválidos" });
      }

      // Buscar el servicio
      const servicio = await Servicio.findById(servicioId);
      if (!servicio) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      // Buscar registro pendiente
      const registroPendiente = await HistorialServicio.findOne({
        usuarioId: new mongoose.Types.ObjectId(usuarioId),
        servicioId: new mongoose.Types.ObjectId(servicioId),
        estado_actual: "pendiente_activacion",
      });

      if (!registroPendiente) {
        return res.status(404).json({
          error: "No hay registro pendiente de activación para este servicio",
        });
      }

      // Crear registro de activación
      const registroActivacion = new HistorialServicio({
        usuarioId: new mongoose.Types.ObjectId(usuarioId),
        servicioId: new mongoose.Types.ObjectId(servicioId),
        servicioNombre: servicio.nombre,
        accion: "activado",
        estado_actual: "activo",
        tipo_usuario: "beneficiario",
        usuario: nombreUsuario || "Equipo BNP",
        fecha: new Date(),
        fecha_activacion: new Date(),
        notas: `Servicio activado por ${nombreUsuario || "Equipo BNP"}`,
      });

      await registroActivacion.save();

      console.log(`[ACTIVAR] ✅ Servicio activado: ${servicio.nombre}`);

      res.json({
        success: true,
        mensaje: "Servicio activado exitosamente",
        registro: {
          _id: registroActivacion._id.toString(),
          servicioNombre: registroActivacion.servicioNombre,
          accion: registroActivacion.accion,
          estado_actual: registroActivacion.estado_actual,
          usuario: registroActivacion.usuario,
          fecha: registroActivacion.fecha,
        },
      });
    } catch (error) {
      console.error("[ACTIVAR] Error:", error);
      res.status(500).json({
        error: "Error activando servicio",
        mensaje: error.message,
      });
    }
  }
);
console.log("✅ serviciosRoutes.js cargado completamente");
// AGREGAR ESTAS RUTAS AL FINAL DE tu serviciosRoutes.js

// Ruta para verificar manualmente el estado de sincronización
router.get(
  "/debug/estado-sincronizacion/:usuarioId",
  checkAuth,
  async (req, res) => {
    try {
      const { usuarioId } = req.params;

      console.log(
        `[DEBUG-MANUAL] === VERIFICANDO ESTADO DE SINCRONIZACIÓN ===`
      );
      console.log(`[DEBUG-MANUAL] Usuario ID: ${usuarioId}`);

      // Buscar beneficiario
      const beneficiario = await mongoose.connection.db
        .collection("beneficiarios")
        .findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(usuarioId) },
            { usuario_id: new mongoose.Types.ObjectId(usuarioId) },
          ],
        });

      if (!beneficiario) {
        return res.status(404).json({
          error: "Beneficiario no encontrado",
          usuarioId,
        });
      }

      console.log(
        `[DEBUG-MANUAL] Beneficiario encontrado: ${beneficiario._id}`
      );

      // Verificar beneficios
      const beneficios = await BeneficioBeneficiario.find({
        beneficiarioId: beneficiario._id,
      });

      // Verificar fondo
      const { Fondo } = await import("../models/Fondo.js");
      const fondo = await Fondo.findOne({ beneficiarioId: beneficiario._id });

      // Compilar estado completo
      const estadoCompleto = {
        usuario_id: usuarioId,
        beneficiario: {
          _id: beneficiario._id.toString(),
          nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
          llave_unica: beneficiario.llave_unica,
          codigo_unico: {
            existe: !!beneficiario.codigo,
            value: beneficiario.codigo?.value || "N/A",
            activo: beneficiario.codigo?.activo || false,
            estado_activacion: beneficiario.codigo?.estado_activacion || "N/A",
            fecha_activacion: beneficiario.codigo?.fecha_activacion || null,
            monto: {
              valor: beneficiario.codigo?.monto?.valor || 0,
              moneda: beneficiario.codigo?.monto?.moneda || "USD",
            },
            prima_pagada: beneficiario.codigo?.primaPagada || 0,
            historial_entries: beneficiario.codigo?.historial?.length || 0,
          },
        },
        fondo: fondo
          ? {
              existe: true,
              _id: fondo._id.toString(),
              estado: fondo.estado,
              saldo_actual: fondo.saldo_actual,
              fecha_vencimiento: fondo.fecha_vencimiento,
              puede_desactivar: fondo.puedeDesactivar(),
              puede_reactivar: fondo.puedeReactivar(),
              historial_movimientos: fondo.historial_movimientos.length,
            }
          : {
              existe: false,
            },
        beneficios: beneficios.map((b) => ({
          _id: b._id.toString(),
          servicio_nombre: b.servicioNombre,
          estado: b.estado,
          fecha_activacion: b.fecha_activacion,
          fecha_desactivacion: b.fecha_desactivacion,
          puede_reactivar: b.puede_reactivar,
          motivo_desactivacion: b.motivo_desactivacion,
        })),
        servicios_con_sincronizacion: [
          "Refund360",
          "Reembolso de costos",
          "Voucher Fly Back",
          "Vouchers Flyback",
          "Certificado de boletos aéreos",
        ],
        timestamp: new Date().toISOString(),
      };

      console.log(`[DEBUG-MANUAL] Estado compilado:`, estadoCompleto);

      res.json({
        success: true,
        estado: estadoCompleto,
      });
    } catch (error) {
      console.error("[DEBUG-MANUAL] Error:", error);
      res.status(500).json({
        error: "Error verificando estado",
        mensaje: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

// Ruta para forzar manualmente la sincronización
router.post("/debug/forzar-sincronizacion", checkAuth, async (req, res) => {
  try {
    const { beneficiarioId, servicioNombre, accion, datosExtra } = req.body;

    console.log(`[FORZAR-SYNC] === FORZANDO SINCRONIZACIÓN MANUAL ===`);
    console.log(`[FORZAR-SYNC] Beneficiario: ${beneficiarioId}`);
    console.log(`[FORZAR-SYNC] Servicio: ${servicioNombre}`);
    console.log(`[FORZAR-SYNC] Acción: ${accion}`);
    console.log(`[FORZAR-SYNC] Datos extra:`, datosExtra);

    // Importar el controlador
    const { ServiciosSincronizacionController } = await import(
      "../controllers/ServiciosSincronizacionController.js"
    );

    let resultado;
    const usuarioId = req.usuario._id;

    switch (accion) {
      case "activar":
        resultado =
          await ServiciosSincronizacionController.activarServicioCompleto(
            beneficiarioId,
            servicioNombre,
            datosExtra || {},
            usuarioId
          );
        break;

      case "desactivar":
        resultado =
          await ServiciosSincronizacionController.desactivarServicioCompleto(
            beneficiarioId,
            servicioNombre,
            datosExtra || {
              motivo_desactivacion: "otros",
              razon_personalizada: "Sincronización manual forzada",
            },
            usuarioId
          );
        break;

      case "reactivar":
        resultado =
          await ServiciosSincronizacionController.reactivarServicioCompleto(
            beneficiarioId,
            servicioNombre,
            usuarioId
          );
        break;

      default:
        return res.status(400).json({
          error: "Acción inválida",
          acciones_validas: ["activar", "desactivar", "reactivar"],
        });
    }

    console.log(`[FORZAR-SYNC] ✅ Resultado:`, resultado);

    res.json({
      success: true,
      accion,
      servicioNombre,
      resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[FORZAR-SYNC] Error:", error);
    res.status(500).json({
      error: "Error forzando sincronización",
      mensaje: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

router.get("/public-debug/activar-codigo/:usuarioId", async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { monto = 0 } = req.query;

    console.log(
      `[PUBLIC-DEBUG] Activando código para: ${usuarioId}, monto: ${monto}`
    );

    let beneficiario = await Beneficiario.findById(usuarioId);
    if (!beneficiario) {
      beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    }

    if (!beneficiario) {
      return res.status(404).json({ error: "Beneficiario no encontrado" });
    }

    const montoParaCodigo = parseFloat(monto) || 0;
    const primaCalculada = montoParaCodigo * 0.0575;

    // Estado anterior para comparación
    const estadoAnterior = {
      existe: !!beneficiario.codigo,
      activo: beneficiario.codigo?.activo || false,
      estado: beneficiario.codigo?.estado_activacion || "N/A",
      estructura_completa: !!beneficiario.codigo?.historial,
    };

    console.log(`[PUBLIC-DEBUG] Estado anterior:`, estadoAnterior);

    // CORRECCIÓN: Inicializar TODA la estructura del código correctamente
    if (!beneficiario.codigo) {
      console.log(`[PUBLIC-DEBUG] Creando estructura completa de código...`);
      beneficiario.codigo = {
        value: beneficiario.llave_unica,
        fecha_creacion: new Date(),
        activo: false,
        estado_activacion: "PENDIENTE",
        monto: {
          valor: 0,
          moneda: "USD",
        },
        primaPagada: 0,
        historial: [], // IMPORTANTE: Inicializar como array vacío
      };
    } else {
      // CORRECCIÓN: Si existe código pero no tiene historial, agregarlo
      if (!beneficiario.codigo.historial) {
        console.log(`[PUBLIC-DEBUG] Agregando historial faltante...`);
        beneficiario.codigo.historial = [];
      }

      // CORRECCIÓN: Si existe código pero no tiene estructura de monto, agregarla
      if (!beneficiario.codigo.monto) {
        console.log(`[PUBLIC-DEBUG] Agregando estructura de monto faltante...`);
        beneficiario.codigo.monto = { valor: 0, moneda: "USD" };
      }
    }

    console.log(`[PUBLIC-DEBUG] Estructura validada. Activando código...`);

    // Activar el código
    beneficiario.codigo.activo = true;
    beneficiario.codigo.estado_activacion = "ACTIVO";
    beneficiario.codigo.fecha_activacion = new Date();

    // Actualizar monto y prima
    beneficiario.codigo.monto.valor = montoParaCodigo;
    beneficiario.codigo.monto.moneda = "USD";
    beneficiario.codigo.primaPagada = primaCalculada;

    // CORRECCIÓN: Validar que historial existe antes de hacer push
    if (!Array.isArray(beneficiario.codigo.historial)) {
      console.log(`[PUBLIC-DEBUG] Historial no es array, reinicializando...`);
      beneficiario.codigo.historial = [];
    }

    // Agregar al historial
    beneficiario.codigo.historial.push({
      motivo: "ACTIVACION_DEBUG_PUBLIC",
      fecha_cambio: new Date(),
      detalles: `Código activado desde debug público. Monto: $${montoParaCodigo} USD, Prima: $${primaCalculada.toFixed(
        2
      )} USD`,
      codigo_anterior: null,
    });

    console.log(
      `[PUBLIC-DEBUG] Historial actualizado. Total entradas: ${beneficiario.codigo.historial.length}`
    );

    // Guardar beneficiario
    await beneficiario.save();
    console.log(`[PUBLIC-DEBUG] Beneficiario guardado exitosamente`);

    const estadoNuevo = {
      activo: beneficiario.codigo.activo,
      estado: beneficiario.codigo.estado_activacion,
      monto: beneficiario.codigo.monto,
      fecha_activacion: beneficiario.codigo.fecha_activacion,
      historial_count: beneficiario.codigo.historial.length,
    };

    console.log(`[PUBLIC-DEBUG] Estado nuevo:`, estadoNuevo);

    // Respuesta HTML mejorada
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Código Activado - Debug</title>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 20px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container { 
          background: white; 
          padding: 30px; 
          border-radius: 12px; 
          max-width: 800px; 
          margin: 20px auto; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .success { 
          background: #d4edda; 
          border: 2px solid #28a745; 
          padding: 20px; 
          border-radius: 8px; 
          color: #155724;
          margin: 20px 0;
        }
        .comparison { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
          margin: 20px 0; 
        }
        .before { 
          background: #f8d7da; 
          border: 2px solid #dc3545; 
          padding: 20px; 
          border-radius: 8px;
          color: #721c24;
        }
        .after { 
          background: #d4edda; 
          border: 2px solid #28a745; 
          padding: 20px; 
          border-radius: 8px;
          color: #155724;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 20px 0;
        }
        .info-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #007bff;
        }
        button { 
          padding: 12px 24px; 
          background: #007bff; 
          color: white; 
          border: none; 
          border-radius: 6px; 
          cursor: pointer; 
          margin: 8px; 
          font-size: 14px;
          transition: all 0.3s ease;
        }
        button:hover { 
          background: #0056b3; 
          transform: translateY(-2px);
        }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #218838; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        h1, h2, h3 { color: #333; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
        .badge { 
          display: inline-block; 
          padding: 4px 8px; 
          border-radius: 4px; 
          font-size: 0.8em; 
          font-weight: bold;
        }
        .badge-success { background: #28a745; color: white; }
        .badge-danger { background: #dc3545; color: white; }
        .json-preview {
          background: #2d3748;
          color: #e2e8f0;
          padding: 15px;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
          overflow-x: auto;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Código Único Activado Exitosamente</h1>
        <p class="timestamp">Procesado: ${new Date().toLocaleString()}</p>
        
        <div class="success">
          <h3>🎉 Resultado de la Activación</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Estado:</strong> <span class="badge badge-success">${
                estadoNuevo.estado
              }</span>
            </div>
            <div class="info-item">
              <strong>Activo:</strong> <span class="badge badge-success">${
                estadoNuevo.activo ? "SÍ" : "NO"
              }</span>
            </div>
            <div class="info-item">
              <strong>Monto:</strong> $${estadoNuevo.monto.valor.toLocaleString()} ${
      estadoNuevo.monto.moneda
    }
            </div>
            <div class="info-item">
              <strong>Prima:</strong> $${primaCalculada.toFixed(2)}
            </div>
          </div>
          <p><strong>Fecha Activación:</strong> ${new Date(
            estadoNuevo.fecha_activacion
          ).toLocaleString()}</p>
          <p><strong>Entradas en Historial:</strong> ${
            estadoNuevo.historial_count
          }</p>
        </div>

        <h3>📊 Comparación: Antes vs Después</h3>
        <div class="comparison">
          <div class="before">
            <h4>❌ Estado Anterior</h4>
            <p><strong>Existía:</strong> <span class="badge ${
              estadoAnterior.existe ? "badge-success" : "badge-danger"
            }">${estadoAnterior.existe ? "SÍ" : "NO"}</span></p>
            <p><strong>Activo:</strong> <span class="badge ${
              estadoAnterior.activo ? "badge-success" : "badge-danger"
            }">${estadoAnterior.activo ? "SÍ" : "NO"}</span></p>
            <p><strong>Estado:</strong> ${estadoAnterior.estado}</p>
            <p><strong>Estructura OK:</strong> <span class="badge ${
              estadoAnterior.estructura_completa
                ? "badge-success"
                : "badge-danger"
            }">${estadoAnterior.estructura_completa ? "SÍ" : "NO"}</span></p>
          </div>
          <div class="after">
            <h4>✅ Estado Actual</h4>
            <p><strong>Existe:</strong> <span class="badge badge-success">SÍ</span></p>
            <p><strong>Activo:</strong> <span class="badge badge-success">SÍ</span></p>
            <p><strong>Estado:</strong> ACTIVO</p>
            <p><strong>Estructura OK:</strong> <span class="badge badge-success">SÍ</span></p>
          </div>
        </div>

        <h3>🔧 Datos de Depuración</h3>
        <div class="json-preview">
{
  "usuario_id": "${usuarioId}",
  "beneficiario_id": "${beneficiario._id}",
  "llave_unica": "${beneficiario.llave_unica}",
  "codigo_activado": ${estadoNuevo.activo},
  "monto_configurado": ${estadoNuevo.monto.valor},
  "prima_calculada": ${primaCalculada.toFixed(2)},
  "fecha_activacion": "${estadoNuevo.fecha_activacion}",
  "historial_entradas": ${estadoNuevo.historial_count}
}
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <button class="btn-success" onclick="window.location.href='/api/servicios/public-debug/estado/${usuarioId}'">
            🔍 Ver Estado Completo
          </button>
          <button onclick="location.reload()">
            🔄 Reactivar Código
          </button>
          <button class="btn-danger" onclick="window.close()">
            ❌ Cerrar Ventana
          </button>
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #e9ecef; border-radius: 6px;">
          <h4>📋 Próximos Pasos:</h4>
          <ol>
            <li>Verifica el estado completo haciendo clic en "Ver Estado Completo"</li>
            <li>Regresa a tu aplicación y prueba la reactivación del beneficio</li>
            <li>El código único ahora debería sincronizarse correctamente</li>
          </ol>
        </div>
      </div>
    </body>
    </html>`;

    res.send(html);
  } catch (error) {
    console.error("[PUBLIC-DEBUG] Error activando código:", error);

    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Error - Debug</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { background: white; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; }
        .error { background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; color: #721c24; }
        pre { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 6px; overflow-x: auto; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>❌ Error en Activación de Código</h1>
        
        <div class="error">
          <h3>Error:</h3>
          <p><strong>Mensaje:</strong> ${error.message}</p>
          <p><strong>Tipo:</strong> ${error.name}</p>
        </div>

        <h3>Stack Trace:</h3>
        <pre>${error.stack}</pre>

        <div style="text-align: center; margin-top: 30px;">
          <button onclick="history.back()">⬅️ Volver</button>
          <button onclick="window.location.href='/api/servicios/public-debug/estado/${usuarioId}'">🔍 Ver Estado</button>
        </div>
      </div>
    </body>
    </html>`;

    res.status(500).send(errorHtml);
  }
});
// Agregar esta ruta en serviciosRoutes.js junto con la de activación

router.get("/public-debug/estado/:usuarioId", async (req, res) => {
  try {
    const { usuarioId } = req.params;

    console.log(`[PUBLIC-DEBUG] Verificando estado para: ${usuarioId}`);

    let beneficiario = await Beneficiario.findById(usuarioId);
    if (!beneficiario) {
      beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
    }

    if (!beneficiario) {
      return res.status(404).json({
        error: "Beneficiario no encontrado",
        usuarioId: usuarioId,
      });
    }

    // Buscar beneficios
    const beneficios = await BeneficioBeneficiario.find({
      beneficiarioId: beneficiario._id,
    });

    // Buscar fondo
    let fondo = null;
    try {
      const { Fondo } = await import("../models/Fondo.js");
      fondo = await Fondo.findOne({ beneficiarioId: beneficiario._id });
    } catch (e) {
      console.log("No se pudo cargar modelo Fondo");
    }

    const estado = {
      timestamp: new Date().toISOString(),
      beneficiario: {
        _id: beneficiario._id.toString(),
        nombre: `${beneficiario.nombre} ${beneficiario.apellido}`,
        llave_unica: beneficiario.llave_unica,
        codigo: {
          existe: !!beneficiario.codigo,
          activo: beneficiario.codigo?.activo || false,
          estado_activacion: beneficiario.codigo?.estado_activacion || "N/A",
          value: beneficiario.codigo?.value || "N/A",
          monto: beneficiario.codigo?.monto || { valor: 0, moneda: "USD" },
          prima_pagada: beneficiario.codigo?.primaPagada || 0,
          fecha_activacion: beneficiario.codigo?.fecha_activacion || null,
          fecha_creacion: beneficiario.codigo?.fecha_creacion || null,
          historial_count: beneficiario.codigo?.historial?.length || 0,
          ultimo_cambio:
            beneficiario.codigo?.historial?.[
              beneficiario.codigo.historial.length - 1
            ] || null,
        },
      },
      beneficios: beneficios.map((b) => ({
        _id: b._id.toString(),
        servicio_nombre: b.servicioNombre,
        estado: b.estado,
        fecha_activacion: b.fecha_activacion,
        fecha_desactivacion: b.fecha_desactivacion,
        fecha_reactivacion: b.fecha_reactivacion,
        puede_reactivar: b.puede_reactivar,
        motivo_desactivacion: b.motivo_desactivacion,
      })),
      fondo: fondo
        ? {
            existe: true,
            _id: fondo._id.toString(),
            estado: fondo.estado,
            saldo_actual: fondo.saldo_actual,
            fecha_vencimiento: fondo.fecha_vencimiento,
            historial_movimientos_count: fondo.historial_movimientos.length,
          }
        : {
            existe: false,
          },
    };

    // Respuesta HTML bonita
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Debug Estado - ${beneficiario.nombre}</title>
      <style>
        body { font-family: monospace; margin: 20px; background: #f5f5f5; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .codigo-activo { border-left-color: #28a745; }
        .codigo-inactivo { border-left-color: #dc3545; }
        .status-good { color: #28a745; font-weight: bold; }
        .status-bad { color: #dc3545; font-weight: bold; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
        h1, h2 { color: #333; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Estado del Usuario</h1>
        <p class="timestamp">Generado: ${new Date().toLocaleString()}</p>
        
        <div class="section">
          <h2>Beneficiario</h2>
          <p><strong>Nombre:</strong> ${estado.beneficiario.nombre}</p>
          <p><strong>ID:</strong> ${estado.beneficiario._id}</p>
          <p><strong>Llave Única:</strong> ${
            estado.beneficiario.llave_unica
          }</p>
        </div>

        <div class="section ${
          estado.beneficiario.codigo.activo
            ? "codigo-activo"
            : "codigo-inactivo"
        }">
          <h2>Código Único</h2>
          <p><strong>Existe:</strong> <span class="${
            estado.beneficiario.codigo.existe ? "status-good" : "status-bad"
          }">${estado.beneficiario.codigo.existe ? "SÍ" : "NO"}</span></p>
          <p><strong>Activo:</strong> <span class="${
            estado.beneficiario.codigo.activo ? "status-good" : "status-bad"
          }">${estado.beneficiario.codigo.activo ? "SÍ" : "NO"}</span></p>
          <p><strong>Estado:</strong> ${
            estado.beneficiario.codigo.estado_activacion
          }</p>
          <p><strong>Value:</strong> ${estado.beneficiario.codigo.value}</p>
          <p><strong>Monto:</strong> $${
            estado.beneficiario.codigo.monto.valor
          } ${estado.beneficiario.codigo.monto.moneda}</p>
          <p><strong>Prima:</strong> $${
            estado.beneficiario.codigo.prima_pagada
          }</p>
          <p><strong>Fecha Activación:</strong> ${
            estado.beneficiario.codigo.fecha_activacion || "N/A"
          }</p>
          <p><strong>Historial:</strong> ${
            estado.beneficiario.codigo.historial_count
          } entradas</p>
          ${
            estado.beneficiario.codigo.ultimo_cambio
              ? `
            <p><strong>Último Cambio:</strong> ${estado.beneficiario.codigo.ultimo_cambio.motivo} - ${estado.beneficiario.codigo.ultimo_cambio.fecha_cambio}</p>
          `
              : ""
          }
        </div>

        <div class="section">
          <h2>Beneficios (${estado.beneficios.length})</h2>
          ${estado.beneficios
            .map(
              (b) => `
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
              <strong>${b.servicio_nombre}</strong> - Estado: <span class="${
                b.estado === "activo" ? "status-good" : "status-bad"
              }">${b.estado}</span><br>
              ${
                b.fecha_activacion
                  ? `Activado: ${new Date(b.fecha_activacion).toLocaleString()}`
                  : ""
              }
              ${
                b.fecha_reactivacion
                  ? `<br>Reactivado: ${new Date(
                      b.fecha_reactivacion
                    ).toLocaleString()}`
                  : ""
              }
              ${
                b.motivo_desactivacion
                  ? `<br>Motivo desactivación: ${b.motivo_desactivacion}`
                  : ""
              }
              <br>Puede reactivar: ${b.puede_reactivar ? "SÍ" : "NO"}
            </div>
          `
            )
            .join("")}
        </div>

        <div class="section">
          <h2>Fondo</h2>
          <p><strong>Existe:</strong> <span class="${
            estado.fondo.existe ? "status-good" : "status-bad"
          }">${estado.fondo.existe ? "SÍ" : "NO"}</span></p>
          ${
            estado.fondo.existe
              ? `
            <p><strong>Estado:</strong> ${estado.fondo.estado}</p>
            <p><strong>Saldo:</strong> $${estado.fondo.saldo_actual.valor} ${
                  estado.fondo.saldo_actual.moneda
                }</p>
            <p><strong>Vencimiento:</strong> ${new Date(
              estado.fondo.fecha_vencimiento
            ).toLocaleDateString()}</p>
            <p><strong>Movimientos:</strong> ${
              estado.fondo.historial_movimientos_count
            }</p>
          `
              : ""
          }
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <button onclick="location.reload()">Recargar</button>
          <button onclick="window.open('/api/servicios/public-debug/activar-codigo/${usuarioId}', '_blank')">Activar Código</button>
        </div>
      </div>
    </body>
    </html>`;

    res.send(html);
  } catch (error) {
    console.error("[PUBLIC-DEBUG] Error:", error);
    res
      .status(500)
      .send(`<h1>Error</h1><pre>${error.message}\n\n${error.stack}</pre>`);
  }
});
export default router;
