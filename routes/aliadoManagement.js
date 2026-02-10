import express from 'express';
import { Aliado, EstadisticaAliado } from '../models/index.js';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';
import mongoose from 'mongoose';
import { generarPDF } from '../utils/pdfGenerator.js';

import moment from 'moment-timezone';

const router = express.Router();
const TIMEZONE = 'America/Argentina/Buenos_Aires';

router.post('/estadisticas/reset', 
  checkAuth,  
  isEquipoBNP,  
  async (req, res) => {
  try {
    // Log full request details
    console.log('Reset Request Details:', {
      user: req.usuario ? {
        id: req.usuario._id,
        tipo: req.usuario.tipo,
        nombre: req.usuario.nombre
      } : 'No user found',
      body: req.body,
      headers: req.headers
    });

    // Rest of your existing reset logic...
    const resultAliados = await Aliado.updateMany(
      {}, 
      { 
        $set: { 
          cantidad_ventas: 0, 
          metricas_rendimiento: 0 
        } 
      }
    );

    const resultEstadisticas = await EstadisticaAliado.deleteMany({});

    console.log('Estadísticas eliminadas:', {
      aliadosModificados: resultAliados.modifiedCount,
      estadisticasEliminadas: resultEstadisticas.deletedCount
    });

    res.json({ 
      message: 'Estadísticas eliminadas exitosamente', 
      timestamp: new Date().toISOString(),
      detalles: {
        aliadosModificados: resultAliados.modifiedCount,
        estadisticasEliminadas: resultEstadisticas.deletedCount
      }
    });
  } catch (error) {
    console.error('Error detallado al eliminar estadísticas:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Error al eliminar estadísticas', 
      error: error.message,
      fullError: error
    });
  }
});

// Middleware to validate ObjectId
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName] || req.query[paramName];
    
    if (!id || id === 'general' || id === 'todas') {
      return next();
    }

    try {
      new mongoose.Types.ObjectId(id);
      next();
    } catch (error) {
      return res.status(400).json({ 
        message: `Invalid ${paramName} provided`, 
        error: error.message 
      });
    }
  };
};

// Middleware de autenticación
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  // agregar verificacion de token
  next();
};

// Obtener sucursales de un aliado específico
router.get('/aliados/:aliadoId/sucursales', checkAuth, async (req, res) => {
  try {
    const { aliadoId } = req.params;
    
    // Verificar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(aliadoId)) {
      return res.status(400).json({ message: 'ID de aliado inválido' });
    }

    // Opción 1: Buscar en el modelo Sucursal directamente
    const Sucursal = mongoose.model('Sucursal');
    const sucursales = await Sucursal.find({ aliado_id: aliadoId })
      .select('nombre direccion telefono');
    
    console.log(`🏢 Sucursales encontradas para aliado ${aliadoId}:`, sucursales);
    
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener sucursales:', error);
    res.status(500).json({ 
      message: 'Error al obtener sucursales', 
      error: error.message 
    });
  }
});

// Obtener todos los aliados
router.get('/aliados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    // Primero, obtener sin populate para ver qué hay
    const aliadosRaw = await Aliado.find()
      .select('nombre info_contacto cantidad_ventas metricas_rendimiento sucursales');
    
    console.log('📋 Aliados RAW (sin populate):', JSON.stringify(aliadosRaw, null, 2));

    // Ahora con populate
    const aliados = await Aliado.find()
      .populate({
        path: 'sucursales',
        select: 'nombre direccion telefono'
      })
      .select('nombre info_contacto cantidad_ventas metricas_rendimiento sucursales');
    
    console.log('📋 Aliados CON populate:', JSON.stringify(aliados, null, 2));
    
    res.json(aliados);
  } catch (error) {
    console.error('Error al obtener aliados:', error);
    res.status(500).json({ 
      message: 'Error al obtener aliados', 
      error: error.message 
    });
  }
});

// Obtener resumen de estadísticas
router.get('/estadisticas/resumen', 
  checkAuth, 
  validateObjectId('aliadoId'),
  validateObjectId('sucursalId'),
  async (req, res) => {
  try {
    const { aliadoId = 'general', sucursalId } = req.query;
    
    // Calcular fechas
    const fechaFin = new Date();
    const fechaInicio = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), 1);

    // Construir la query base
    const matchQuery = {
      fecha_creacion: {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    };

    // Añadir filtro de aliado si no es general
    if (aliadoId !== 'general') {
      matchQuery.aliado_id = new mongoose.Types.ObjectId(aliadoId);
    }

    // Añadir filtro de sucursal si se proporciona
    if (sucursalId && sucursalId !== 'todas') {
      matchQuery.sucursal_id = new mongoose.Types.ObjectId(sucursalId);
    }

    // Agregación para obtener estadísticas
    const estadisticas = await EstadisticaAliado.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'aliados',
          localField: 'aliado_id',
          foreignField: '_id',
          as: 'aliado'
        }
      },
      {
        $lookup: {
          from: 'sucursals',
          localField: 'sucursal_id',
          foreignField: '_id',
          as: 'sucursal'
        }
      },
      { 
        $unwind: { 
          path: '$aliado', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      { 
        $unwind: { 
          path: '$sucursal', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      {
        $group: {
          _id: {
            fecha: { 
              $dateToString: { 
                format: "%Y-%m-%d", 
                date: "$fecha_creacion" 
              } 
            }
          },
          ventas: { $sum: "$ventas_totales" },
          metasCumplidasCount: { 
            $sum: { 
              $cond: ["$metas_cumplidas", 1, 0] 
            } 
          },
          totalRegistros: { $sum: 1 },
          notas: {
            $push: {
              $cond: {
                if: { $isArray: "$notas" },
                then: {
                  $map: {
                    input: "$notas",
                    as: "nota",
                    in: {
                      texto: "$$nota.texto",
                      fecha: "$$nota.fecha",
                      aliado_nombre: { $ifNull: ["$aliado.nombre", "General"] },
                      sucursal_nombre: { $ifNull: ["$sucursal.nombre", "Sin sucursal"] }
                    }
                  }
                },
                else: []
              }
            }
          }
        }
      },
      { 
        $sort: { 
          "_id.fecha": 1 
        } 
      }
    ]);

    // Verificar si hay estadísticas
    if (!estadisticas || estadisticas.length === 0) {
      return res.json({
        ventasDiarias: [],
        ventasTotales: 0,
        promedioDiario: 0,
        mejorDia: null,
        metasCumplidas: 0,
        metasCumplidasTexto: "N/A",
        notas: []
      });
    }

    // Formatear datos para el gráfico diario
    const ventasDiarias = estadisticas.map(est => ({
      fecha: est._id.fecha,
      ventas: est.ventas || 0
    }));

    // Calcular métricas
    const ventasTotales = estadisticas.reduce((acc, est) => acc + (est.ventas || 0), 0);
    const promedioDiario = estadisticas.length > 0 
      ? Math.round(ventasTotales / estadisticas.length) 
      : 0;

    // Encontrar el día con más ventas
    const mejorDia = estadisticas.reduce((mejor, actual) => {
      return (actual.ventas > (mejor?.ventas || 0)) 
        ? { 
            fecha: actual._id.fecha, 
            ventas: actual.ventas 
          } 
        : mejor;
    }, null);

    // Formatear notas
    const notasFormateadas = estadisticas
      .flatMap(est => est.notas.flat())
      .filter(nota => nota && nota.texto)
      .map(nota => ({
        texto: Array.isArray(nota.texto) ? nota.texto[0] : nota.texto,
        fecha: nota.fecha,
        aliado_nombre: nota.aliado_nombre,
        sucursal_nombre: nota.sucursal_nombre
      }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Calcular metas cumplidas
    const totalMetasCumplidas = estadisticas.reduce((acc, est) => acc + (est.metasCumplidasCount || 0), 0);
    const totalRegistros = estadisticas.reduce((acc, est) => acc + (est.totalRegistros || 0), 0);
    const metasCumplidas = totalRegistros > 0 ? (totalMetasCumplidas / totalRegistros) : 0;
    
    // Texto legible de metas cumplidas
    const metasCumplidasTexto = totalRegistros > 0 
      ? `${totalMetasCumplidas} de ${totalRegistros} días`
      : "Sin datos";

    res.json({
      ventasDiarias,
      ventasTotales,
      promedioDiario,
      metasCumplidas, 
      metasCumplidasTexto,
      mejorDia,
      notas: notasFormateadas
    });

  } catch (error) {
    console.error('Error en obtenerResumenEstadisticas:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas', 
      error: error.message 
    });
  }
});

// Generar PDF de estadísticas
router.get('/estadisticas/pdf', verificarToken, async (req, res) => {
  try {
    const { periodo, aliadoId, sucursalId } = req.query;
    
    // Calcular fechas según el período
    const fechaFin = new Date();
    let fechaInicio = new Date();
    
    switch(periodo) {
      case 'anterior':
        fechaInicio = new Date(fechaFin.getFullYear(), fechaFin.getMonth() - 1, 1);
        fechaFin.setDate(0);
        break;
      case 'trimestre':
        fechaInicio.setMonth(fechaInicio.getMonth() - 3);
        break;
      default:
        fechaInicio = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), 1);
        break;
    }

    // Construir la query
    const matchQuery = {
      fecha_creacion: {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    };

    if (aliadoId && aliadoId !== 'general') {
      try {
        matchQuery.aliado_id = new mongoose.Types.ObjectId(aliadoId);
      } catch (err) {
        return res.status(400).json({ message: 'ID de aliado inválido' });
      }
    }

    if (sucursalId && sucursalId !== 'todas') {
      try {
        matchQuery.sucursal_id = new mongoose.Types.ObjectId(sucursalId);
      } catch (err) {
        return res.status(400).json({ message: 'ID de sucursal inválido' });
      }
    }

    // Obtener estadísticas
    const estadisticas = await EstadisticaAliado.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'aliados',
          localField: 'aliado_id',
          foreignField: '_id',
          as: 'aliado'
        }
      },
      {
        $lookup: {
          from: 'sucursals',
          localField: 'sucursal_id',
          foreignField: '_id',
          as: 'sucursal'
        }
      },
      { 
        $unwind: { 
          path: '$aliado', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      { 
        $unwind: { 
          path: '$sucursal', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      {
        $group: {
          _id: {
            fecha: { 
              $dateToString: { 
                format: "%Y-%m-%d", 
                date: "$fecha_creacion" 
              } 
            }
          },
          ventas: { $sum: "$ventas_totales" },
          metasCumplidasCount: { 
            $sum: { 
              $cond: ["$metas_cumplidas", 1, 0] 
            } 
          },
          totalRegistros: { $sum: 1 },
          notas: {
            $push: {
              texto: "$notas",
              fecha: "$fecha_creacion",
              aliado_nombre: { $ifNull: ["$aliado.nombre", "General"] },
              sucursal_nombre: { $ifNull: ["$sucursal.nombre", "Sin sucursal"] }
            }
          }
        }
      },
      { 
        $sort: { 
          "_id.fecha": 1 
        } 
      }
    ]);

    // Formatear datos para el PDF
    const ventasDiarias = estadisticas.map(est => ({
      fecha: est._id.fecha,
      ventas: est.ventas || 0
    }));
    
    const ventasTotales = estadisticas.reduce((acc, est) => acc + (est.ventas || 0), 0);
    const promedioDiario = Math.round(ventasTotales / estadisticas.length);
    
    const totalMetasCumplidas = estadisticas.reduce((acc, est) => acc + (est.metasCumplidasCount || 0), 0);
    const totalRegistros = estadisticas.reduce((acc, est) => acc + (est.totalRegistros || 0), 0);
    const metasCumplidas = totalRegistros > 0 ? (totalMetasCumplidas / totalRegistros) : 0;

    const mejorDia = estadisticas.reduce((mejor, actual) => {
      return (actual.ventas > (mejor?.ventas || 0)) 
        ? { 
            fecha: actual._id.fecha, 
            ventas: actual.ventas 
          } 
        : mejor;
    }, null);

    const notasFormateadas = estadisticas
      .flatMap(est => est.notas)
      .filter(nota => nota && nota.texto)
      .map(nota => ({
        texto: Array.isArray(nota.texto) ? nota.texto[0] : nota.texto,
        fecha: nota.fecha,
        aliado_nombre: nota.aliado_nombre,
        sucursal_nombre: nota.sucursal_nombre
      }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Obtener información del aliado y sucursal si es necesario
    let aliado = null;
    let sucursal = null;
    
    if (aliadoId && aliadoId !== 'general') {
      aliado = await Aliado.findById(aliadoId);
    }

    // Generar el PDF
    const doc = await generarPDF(
      {
        ventasDiarias,
        ventasTotales,
        promedioDiario,
        mejorDia,
        metasCumplidas,
        notas: notasFormateadas
      },
      periodo,
      aliado,
      sucursal
    );

    // Configurar headers para la descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=estadisticas_${new Date().toISOString().split('T')[0]}.pdf`
    );

    // Enviar el PDF
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error('Error en generarPDFEstadisticas:', error);
    res.status(500).json({ 
      message: 'Error al generar PDF', 
      error: error.message 
    });
  }
});

// Registrar estadísticas diarias
router.post('/estadisticas/:aliadoId', 
  validateObjectId('aliadoId'), 
  checkAuth, 
  async (req, res) => {
  try {
    const { ventas_totales, metas_cumplidas, nota, sucursal_id } = req.body;
    const aliado_id = req.params.aliadoId;
    
    console.log('📥 Datos recibidos en backend:');
    console.log('  - aliado_id:', aliado_id);
    console.log('  - sucursal_id:', sucursal_id);
    console.log('  - ventas_totales:', ventas_totales);
    console.log('  - metas_cumplidas:', metas_cumplidas);
    console.log('  - Body completo:', req.body);
    
    const fecha = new Date();
    const mes = fecha.getMonth() + 1;
    const año = fecha.getFullYear();

    // Construir query de búsqueda
    const searchQuery = {
      aliado_id,
      fecha_creacion: {
        $gte: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
        $lt: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1)
      }
    };

    // Agregar sucursal_id si existe
    if (sucursal_id) {
      searchQuery.sucursal_id = sucursal_id;
      console.log('✅ sucursal_id agregado a searchQuery:', sucursal_id);
    } else {
      console.log('⚠️ No se recibió sucursal_id');
    }

    console.log('🔍 SearchQuery:', searchQuery);

    // Buscar estadística existente para el día
    let estadistica = await EstadisticaAliado.findOne(searchQuery);

    if (!estadistica) {
      const estadisticaData = {
        aliado_id,
        mes,
        año,
        ventas_totales,
        metas_cumplidas,
        fecha_creacion: fecha
      };
      
      if (sucursal_id) {
        estadisticaData.sucursal_id = sucursal_id;
        console.log('✅ sucursal_id agregado a nueva estadística:', sucursal_id);
      }
      
      console.log('📝 Creando nueva estadística:', estadisticaData);
      estadistica = new EstadisticaAliado(estadisticaData);
    } else {
      console.log('📝 Actualizando estadística existente');
      estadistica.ventas_totales = ventas_totales;
      estadistica.metas_cumplidas = metas_cumplidas;
    }

    if (nota) {
      estadistica.notas.push({
        texto: nota,
        fecha: new Date()
      });
    }

    await estadistica.save();
    console.log('💾 Estadística guardada:', estadistica);

    // Actualizar métricas del aliado
    const aliado = await Aliado.findById(aliado_id);
    if (aliado) {
      aliado.cantidad_ventas = (aliado.cantidad_ventas || 0) + ventas_totales;
      aliado.metricas_rendimiento = metas_cumplidas ? 
        (aliado.metricas_rendimiento || 0) + 1 : 
        (aliado.metricas_rendimiento || 0);
      await aliado.save();
    }

    res.json(estadistica);
  } catch (error) {
    console.error('❌ Error en registrarEstadisticas:', error);
    res.status(500).json({ 
      message: 'Error al registrar estadísticas', 
      error: error.message 
    });
  }
});

// Obtener estadísticas específicas de un aliado
router.get('/estadisticas/:aliadoId', verificarToken, async (req, res) => {
  try {
    const { aliadoId } = req.params;
    const estadisticas = await EstadisticaAliado.find({ aliado_id: aliadoId })
      .sort({ fecha_creacion: -1 })
      .populate('aliado_id', 'nombre')
      .populate('sucursal_id', 'nombre');
    
    res.json(estadisticas);
  } catch (error) {
    console.error('Error en obtenerEstadisticas:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas', 
      error: error.message 
    });
  }
});

export default router;