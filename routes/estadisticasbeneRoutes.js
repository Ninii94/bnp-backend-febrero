import express from "express";
import { Beneficiario } from "../models/Beneficiario.js";
import { Servicio } from "../models/Servicio.js";
import { checkAuth, isEquipoBNP } from "../middleware/auth.js";

const router = express.Router();

// Obtener estadísticas generales de beneficiarios
router.get("/beneficiarios", checkAuth, isEquipoBNP, async (req, res) => {
  try {
    // Contar total de beneficiarios
    const totalBeneficiarios = await Beneficiario.countDocuments();

    // Contar beneficiarios con llave única activa
    const llaveUnicaActiva = await Beneficiario.countDocuments({
      "codigo.activo": true,
    });

    // Calcular inactivos (total - activos)
    const llaveUnicaInactiva = totalBeneficiarios - llaveUnicaActiva;

    // Enviar respuesta
    res.json({
      totalBeneficiarios,
      llaveUnicaActiva,
      llaveUnicaInactiva,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas de beneficiarios:", error);
    res.status(500).json({
      mensaje: "Error al obtener estadísticas de beneficiarios",
      error: error.message,
    });
  }
});

// Obtener estadísticas de servicios activos
router.get(
  "/beneficiarios/servicios-activos",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      // Obtener todos los servicios para identificarlos por ID
      const servicios = await Servicio.find({
        tipoUsuario: { $in: ["beneficiario", "ambos"] },
      });

      // Mapa de servicios por ID para referencia rápida
      const serviciosPorId = {};
      servicios.forEach((servicio) => {
        serviciosPorId[servicio._id.toString()] = servicio.nombre;
      });

      // Inicializar contador por servicio
      const contadoresServicios = {};
      servicios.forEach((servicio) => {
        contadoresServicios[servicio._id.toString()] = 0;
      });

      // Obtener todos los beneficiarios con servicios activos
      const beneficiarios = await Beneficiario.find({
        servicios: { $exists: true, $ne: [] },
      });

      // Contar servicios activos
      beneficiarios.forEach((beneficiario) => {
        if (beneficiario.servicios && Array.isArray(beneficiario.servicios)) {
          beneficiario.servicios.forEach((servicioId) => {
            const servicioIdStr = servicioId.toString();
            if (contadoresServicios[servicioIdStr] !== undefined) {
              contadoresServicios[servicioIdStr]++;
            }
          });
        }
      });

      // Formatear resultados para la respuesta
      const resultados = Object.keys(contadoresServicios).map((servicioId) => ({
        id: servicioId,
        nombre: serviciosPorId[servicioId] || "Servicio desconocido",
        cantidad: contadoresServicios[servicioId],
      }));

      // Ordenar por cantidad (descendente)
      resultados.sort((a, b) => b.cantidad - a.cantidad);

      res.json(resultados);
    } catch (error) {
      console.error(
        "Error al obtener estadísticas de servicios activos:",
        error
      );
      res.status(500).json({
        mensaje: "Error al obtener estadísticas de servicios activos",
        error: error.message,
      });
    }
  }
);

// Estadísticas de reembolsos
router.get(
  "/beneficiarios/reembolsos",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      // Contar beneficiarios con código de reembolso
      const conReembolso = await Beneficiario.countDocuments({
        "codigo.monto.valor": { $gt: 0 },
      });

      // Contar pendientes de activación
      const pendientesActivacion = await Beneficiario.countDocuments({
        "codigo.estado_activacion": "PENDIENTE",
      });

      // Contar activados
      const activados = await Beneficiario.countDocuments({
        "codigo.estado_activacion": "ACTIVADO",
      });

      // Contar cancelados
      const cancelados = await Beneficiario.countDocuments({
        "codigo.estado_activacion": "CANCELADO",
      });

      // Calcular monto total de reembolsos (solo los activados)
      const beneficiariosConMonto = await Beneficiario.find({
        "codigo.monto.valor": { $gt: 0 },
        "codigo.estado_activacion": "ACTIVADO",
      });

      let montoTotalReembolsos = 0;
      beneficiariosConMonto.forEach((beneficiario) => {
        if (
          beneficiario.codigo &&
          beneficiario.codigo.monto &&
          beneficiario.codigo.monto.valor
        ) {
          montoTotalReembolsos += beneficiario.codigo.monto.valor;
        }
      });

      res.json({
        conReembolso,
        pendientesActivacion,
        activados,
        cancelados,
        montoTotalReembolsos,
      });
    } catch (error) {
      console.error("Error al obtener estadísticas de reembolsos:", error);
      res.status(500).json({
        mensaje: "Error al obtener estadísticas de reembolsos",
        error: error.message,
      });
    }
  }
);

// Estadísticas por nacionalidad
router.get(
  "/beneficiarios/nacionalidades",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      console.log(
        "✅ GET /api/estadisticas/beneficiarios/nacionalidades - Endpoint llamado"
      );

      // Obtener TODOS los beneficiarios (incluyendo los que no tienen nacionalidad)
      const beneficiarios = await Beneficiario.find({});

      console.log(
        `📊 Total de beneficiarios encontrados: ${beneficiarios.length}`
      );

      // Agrupar por nacionalidad
      const porNacionalidad = {};
      let sinNacionalidad = 0;

      beneficiarios.forEach((beneficiario) => {
        // Verificar si tiene nacionalidad válida
        if (
          beneficiario.nacionalidad &&
          beneficiario.nacionalidad.trim() !== "" &&
          beneficiario.nacionalidad !== "null" &&
          beneficiario.nacionalidad !== "undefined"
        ) {
          const nacionalidad = beneficiario.nacionalidad.trim();

          if (!porNacionalidad[nacionalidad]) {
            porNacionalidad[nacionalidad] = 0;
          }
          porNacionalidad[nacionalidad]++;
        } else {
          // Contar beneficiarios sin nacionalidad
          sinNacionalidad++;
        }
      });

      // Convertir a array para la respuesta
      const resultados = Object.keys(porNacionalidad).map((nacionalidad) => ({
        nacionalidad,
        cantidad: porNacionalidad[nacionalidad],
      }));

      // Agregar los que no tienen nacionalidad si existen
      if (sinNacionalidad > 0) {
        resultados.push({
          nacionalidad: "Sin especificar",
          cantidad: sinNacionalidad,
        });
      }

      // Ordenar por cantidad (descendente)
      resultados.sort((a, b) => b.cantidad - a.cantidad);

      console.log(`📊 Nacionalidades encontradas: ${resultados.length}`);
      console.log(
        "📋 Detalle:",
        resultados.map((r) => `${r.nacionalidad}: ${r.cantidad}`).join(", ")
      );

      res.json(resultados);
    } catch (error) {
      console.error(
        "❌ Error al obtener estadísticas por nacionalidad:",
        error
      );
      res.status(500).json({
        mensaje: "Error al obtener estadísticas por nacionalidad",
        error: error.message,
      });
    }
  }
);

router.get(
  "/beneficiarios/paises",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      console.log(
        "✅ GET /api/estadisticas/beneficiarios/paises - Endpoint llamado"
      );

      // Obtener TODOS los beneficiarios
      const beneficiarios = await Beneficiario.find({});

      console.log(
        `📊 Total de beneficiarios encontrados: ${beneficiarios.length}`
      );

      // Agrupar por país
      const porPais = {};
      let sinPais = 0;

      beneficiarios.forEach((beneficiario) => {
        if (
          beneficiario.pais &&
          beneficiario.pais.trim() !== "" &&
          beneficiario.pais !== "null" &&
          beneficiario.pais !== "undefined"
        ) {
          const pais = beneficiario.pais.trim();

          if (!porPais[pais]) {
            porPais[pais] = 0;
          }
          porPais[pais]++;
        } else {
          sinPais++;
        }
      });

      // Convertir a array para la respuesta
      const resultados = Object.keys(porPais).map((pais) => ({
        pais,
        cantidad: porPais[pais],
      }));

      // Agregar los que no tienen país si existen
      if (sinPais > 0) {
        resultados.push({
          pais: "Sin especificar",
          cantidad: sinPais,
        });
      }

      // Ordenar por cantidad (descendente)
      resultados.sort((a, b) => b.cantidad - a.cantidad);

      console.log(`📊 Países encontrados: ${resultados.length}`);
      console.log(
        "📋 Detalle:",
        resultados.map((r) => `${r.pais}: ${r.cantidad}`).join(", ")
      );

      res.json(resultados);
    } catch (error) {
      console.error("❌ Error al obtener estadísticas por país:", error);
      res.status(500).json({
        mensaje: "Error al obtener estadísticas por país",
        error: error.message,
      });
    }
  }
);

// ========== NUEVO: Estadísticas de aliados con más beneficiarios ==========
router.get(
  "/beneficiarios/aliados-top",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      console.log(
        "✅ GET /api/estadisticas/beneficiarios/aliados-top - Endpoint llamado"
      );

      // Importar modelo Aliado
      const { Aliado } = await import("../models/Aliado.js");

      // Obtener TODOS los beneficiarios
      const beneficiarios = await Beneficiario.find({}).lean();

      console.log(
        `📊 Total de beneficiarios encontrados: ${beneficiarios.length}`
      );

      // Agrupar por aliado
      const porAliado = {};
      let sinAliado = 0;

      for (const beneficiario of beneficiarios) {
        if (beneficiario.aliado_id) {
          const aliadoId = beneficiario.aliado_id.toString();

          if (!porAliado[aliadoId]) {
            porAliado[aliadoId] = 0;
          }
          porAliado[aliadoId]++;
        } else {
          sinAliado++;
        }
      }

      // Obtener información de los aliados
      const aliadoIds = Object.keys(porAliado);
      const aliados = await Aliado.find({ _id: { $in: aliadoIds } }).select(
        "nombre"
      );

      // Crear mapa de IDs a nombres
      const aliadosMap = {};
      aliados.forEach((aliado) => {
        aliadosMap[aliado._id.toString()] = aliado.nombre;
      });

      // Convertir a array para la respuesta
      const resultados = Object.keys(porAliado).map((aliadoId) => ({
        aliado_id: aliadoId,
        aliado: aliadosMap[aliadoId] || "Aliado desconocido",
        cantidad: porAliado[aliadoId],
      }));

      // Agregar los que no tienen aliado si existen
      if (sinAliado > 0) {
        resultados.push({
          aliado_id: null,
          aliado: "Sin asignar",
          cantidad: sinAliado,
        });
      }

      // Ordenar por cantidad (descendente)
      resultados.sort((a, b) => b.cantidad - a.cantidad);

      console.log(`📊 Aliados encontrados: ${resultados.length}`);
      console.log(
        "📋 Top 3:",
        resultados
          .slice(0, 3)
          .map((r) => `${r.aliado}: ${r.cantidad}`)
          .join(", ")
      );

      res.json(resultados);
    } catch (error) {
      console.error("❌ Error al obtener estadísticas de aliados:", error);
      res.status(500).json({
        mensaje: "Error al obtener estadísticas de aliados",
        error: error.message,
      });
    }
  }
);
// ========== FIN NUEVO ENDPOINT ==========

// Estadísticas por fecha de registro (último mes)
router.get(
  "/beneficiarios/registro-tiempo",
  checkAuth,
  isEquipoBNP,
  async (req, res) => {
    try {
      // Fecha hace un mes
      const unMesAtras = new Date();
      unMesAtras.setMonth(unMesAtras.getMonth() - 1);

      // Obtener beneficiarios registrados en el último mes
      const beneficiarios = await Beneficiario.find({
        fecha_registro: { $gte: unMesAtras },
      });

      // Agrupar por día
      const porDia = {};

      beneficiarios.forEach((beneficiario) => {
        if (beneficiario.fecha_registro) {
          const fecha = beneficiario.fecha_registro.toISOString().split("T")[0];
          if (!porDia[fecha]) {
            porDia[fecha] = 0;
          }
          porDia[fecha]++;
        }
      });

      // Convertir a array para la respuesta
      const resultados = Object.keys(porDia).map((fecha) => ({
        fecha,
        cantidad: porDia[fecha],
      }));

      // Ordenar por fecha
      resultados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      res.json(resultados);
    } catch (error) {
      console.error(
        "Error al obtener estadísticas de registro por tiempo:",
        error
      );
      res.status(500).json({
        mensaje: "Error al obtener estadísticas de registro por tiempo",
        error: error.message,
      });
    }
  }
);

export default router;
