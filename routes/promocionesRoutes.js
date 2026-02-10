import express from 'express';
import { BeneficioBeneficiario } from '../models/BeneficioBeneficiario.js';
import { Beneficiario } from '../models/Beneficiario.js';
import mongoose from 'mongoose';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// Obtener candidatos para promociones con datos correctos
router.get('/candidatos', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[PROMOCIONES] === OBTENIENDO CANDIDATOS ===');

    // Buscar TODOS los beneficios inactivos que quieren recontratar
    const candidatos = await BeneficioBeneficiario.aggregate([
      {
        $match: {
          estado: 'inactivo',
          volveria_contratar: true, // Solo los que SÍ quieren recontratar
          motivo_desactivacion: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'beneficiarios',
          localField: 'beneficiarioId',
          foreignField: '_id',
          as: 'beneficiarioData'
        }
      },
      {
        $unwind: '$beneficiarioData'
      },
      {
        $project: {
          _id: 1,
          beneficiarioId: 1,
          servicioNombre: 1,
          fecha_desactivacion: 1,
          motivo_desactivacion: 1,
          razon_personalizada: 1,
          notas_adicionales: 1,
          volveria_contratar: 1,
          'beneficiarioData.nombre': 1,
          'beneficiarioData.apellido': 1,
          'beneficiarioData.correo': 1,
          'beneficiarioData.telefono': 1
        }
      },
      {
        $sort: { fecha_desactivacion: -1 }
      }
    ]);

    console.log(`[PROMOCIONES] Candidatos encontrados: ${candidatos.length}`);

    // Formatear candidatos
    const candidatosFormateados = candidatos.map(candidato => ({
      _id: candidato._id,
      beneficiarioId: candidato.beneficiarioId,
      servicioNombre: candidato.servicioNombre,
      fecha_desactivacion: candidato.fecha_desactivacion,
      motivo_desactivacion: candidato.motivo_desactivacion,
      razon_personalizada: candidato.razon_personalizada,
      notas_adicionales: candidato.notas_adicionales,
      volveria_contratar: candidato.volveria_contratar,
      beneficiarioData: {
        nombre: candidato.beneficiarioData.nombre,
        apellido: candidato.beneficiarioData.apellido,
        correo: candidato.beneficiarioData.correo,
        telefono: candidato.beneficiarioData.telefono
      }
    }));

    res.json({
      success: true,
      candidatos: candidatosFormateados,
      total: candidatosFormateados.length
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
});

// Obtener estadísticas de promociones
router.get('/estadisticas', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[PROMOCIONES] === OBTENIENDO ESTADÍSTICAS ===');

    // Estadísticas generales
    const resumenGeneral = await BeneficioBeneficiario.aggregate([
      {
        $group: {
          _id: null,
          total_beneficios: { $sum: 1 },
          activos: {
            $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] }
          },
          inactivos: {
            $sum: { $cond: [{ $eq: ['$estado', 'inactivo'] }, 1, 0] }
          },
          candidatos_promociones: {
            $sum: { $cond: [{ $and: [
              { $eq: ['$estado', 'inactivo'] },
              { $eq: ['$volveria_contratar', true] }
            ]}, 1, 0] }
          }
        }
      }
    ]);

    // Estadísticas por motivo de desactivación
    const estadisticasMotivos = await BeneficioBeneficiario.aggregate([
      {
        $match: { 
          estado: 'inactivo',
          motivo_desactivacion: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$motivo_desactivacion',
          total: { $sum: 1 },
          recontratarian: {
            $sum: { $cond: [{ $eq: ['$volveria_contratar', true] }, 1, 0] }
          },
          no_recontratarian: {
            $sum: { $cond: [{ $eq: ['$volveria_contratar', false] }, 1, 0] }
          },
          sin_respuesta: {
            $sum: { $cond: [{ $eq: ['$volveria_contratar', null] }, 1, 0] }
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    console.log('[PROMOCIONES] Estadísticas calculadas');

    res.json({
      success: true,
      resumen_general: resumenGeneral[0] || {
        total_beneficios: 0,
        activos: 0,
        inactivos: 0,
        candidatos_promociones: 0
      },
      estadisticas_motivos: estadisticasMotivos
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      mensaje: error.message
    });
  }
});

// Eliminar candidato de la lista (marcar como no recontratará)
router.post('/candidatos/:beneficioId/eliminar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { beneficioId } = req.params;
    const { motivo_eliminacion, recontrato } = req.body;

    console.log(`[PROMOCIONES] Eliminando candidato: ${beneficioId}, Recontrató: ${recontrato}`);

    if (!mongoose.Types.ObjectId.isValid(beneficioId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de beneficio inválido'
      });
    }

    const beneficio = await BeneficioBeneficiario.findOne({
      _id: beneficioId,
      estado: 'inactivo',
      volveria_contratar: true
    });

    if (!beneficio) {
      return res.status(404).json({
        success: false,
        error: 'Candidato no encontrado o ya fue eliminado'
      });
    }

    // Si recontrató, marcarlo de manera especial
    if (recontrato) {
      beneficio.recontrato = true; // Nuevo campo
      beneficio.fecha_recontratacion = new Date();
      beneficio.volveria_contratar = false; // Ya no es candidato
      beneficio.notas_adicionales = (beneficio.notas_adicionales || '') + 
        `\n[${new Date().toISOString()}] RECONTRATÓ el servicio. Gestionado por: ${req.usuario.nombre || 'Admin'}. ${motivo_eliminacion ? 'Motivo: ' + motivo_eliminacion : ''}`;
    } else {
      // No recontrató, solo eliminar de candidatos
      beneficio.volveria_contratar = false;
      beneficio.recontrato = false;
      beneficio.notas_adicionales = (beneficio.notas_adicionales || '') + 
        `\n[${new Date().toISOString()}] Eliminado de candidatos por: ${req.usuario.nombre || 'Admin'}. Motivo: ${motivo_eliminacion || 'No especificado'}`;
    }

    await beneficio.save();

    console.log(`[PROMOCIONES] Candidato ${recontrato ? 'recontrató' : 'eliminado'}: ${beneficio.servicioNombre}`);

    res.json({
      success: true,
      mensaje: recontrato ? 'Beneficiario marcado como recontratado' : 'Candidato eliminado de la lista',
      beneficio: {
        _id: beneficio._id,
        servicioNombre: beneficio.servicioNombre,
        volveria_contratar: beneficio.volveria_contratar,
        recontrato: beneficio.recontrato
      }
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error eliminando candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando candidato',
      mensaje: error.message
    });
  }
});


// Restaurar candidato a la lista
router.post('/candidatos/:beneficioId/restaurar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { beneficioId } = req.params;

    console.log(`[PROMOCIONES] Restaurando candidato: ${beneficioId}`);

    if (!mongoose.Types.ObjectId.isValid(beneficioId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de beneficio inválido'
      });
    }

    // Buscar el beneficio
    const beneficio = await BeneficioBeneficiario.findOne({
      _id: beneficioId,
      estado: 'inactivo'
    });

    if (!beneficio) {
      return res.status(404).json({
        success: false,
        error: 'Beneficio no encontrado'
      });
    }

    // Marcar como que SÍ volverá a contratar
    beneficio.volveria_contratar = true;
    beneficio.notas_adicionales = (beneficio.notas_adicionales || '') + 
      `\n[${new Date().toISOString()}] Restaurado a candidatos por: ${req.usuario.nombre || 'Admin'}`;

    await beneficio.save();

    console.log(`[PROMOCIONES]  Candidato restaurado: ${beneficio.servicioNombre}`);

    res.json({
      success: true,
      mensaje: 'Candidato restaurado a la lista de promociones',
      beneficio: {
        _id: beneficio._id,
        servicioNombre: beneficio.servicioNombre,
        volveria_contratar: beneficio.volveria_contratar
      }
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error restaurando candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Error restaurando candidato',
      mensaje: error.message
    });
  }
});

// Obtener beneficios eliminados de promociones
router.get('/eliminados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[PROMOCIONES] === OBTENIENDO ELIMINADOS ===');

    const eliminados = await BeneficioBeneficiario.aggregate([
      {
        $match: {
          estado: 'inactivo',
          volveria_contratar: false,
          $or: [
            { recontrato: { $exists: false } },
            { recontrato: false }
          ],
          motivo_desactivacion: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'beneficiarios',
          localField: 'beneficiarioId',
          foreignField: '_id',
          as: 'beneficiarioData'
        }
      },
      {
        $unwind: '$beneficiarioData'
      },
      {
        $project: {
          _id: 1,
          beneficiarioId: 1,
          servicioNombre: 1,
          fecha_desactivacion: 1,
          motivo_desactivacion: 1,
          razon_personalizada: 1,
          notas_adicionales: 1,
          volveria_contratar: 1,
          'beneficiarioData.nombre': 1,
          'beneficiarioData.apellido': 1,
          'beneficiarioData.correo': 1
        }
      },
      {
        $sort: { fecha_desactivacion: -1 }
      }
    ]);

    console.log(`[PROMOCIONES] Eliminados encontrados: ${eliminados.length}`);

    res.json({
      success: true,
      eliminados: eliminados,
      total: eliminados.length
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error obteniendo eliminados:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo eliminados',
      mensaje: error.message
    });
  }
});
router.get('/recontratados', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[PROMOCIONES] === OBTENIENDO RECONTRATADOS ===');

    const recontratados = await BeneficioBeneficiario.aggregate([
      {
        $match: {
          estado: 'inactivo',
          recontrato: true, // Nuevo campo para identificar recontrataciones
          motivo_desactivacion: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'beneficiarios',
          localField: 'beneficiarioId',
          foreignField: '_id',
          as: 'beneficiarioData'
        }
      },
      {
        $unwind: '$beneficiarioData'
      },
      {
        $project: {
          _id: 1,
          beneficiarioId: 1,
          servicioNombre: 1,
          fecha_desactivacion: 1,
          fecha_recontratacion: 1,
          motivo_desactivacion: 1,
          razon_personalizada: 1,
          notas_adicionales: 1,
          recontrato: 1,
          'beneficiarioData.nombre': 1,
          'beneficiarioData.apellido': 1,
          'beneficiarioData.correo': 1,
          'beneficiarioData.telefono': 1
        }
      },
      {
        $sort: { fecha_recontratacion: -1 }
      }
    ]);

    console.log(`[PROMOCIONES] Recontratados encontrados: ${recontratados.length}`);

    res.json({
      success: true,
      recontratados: recontratados,
      total: recontratados.length
    });

  } catch (error) {
    console.error('[PROMOCIONES] Error obteniendo recontratados:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo recontratados',
      mensaje: error.message
    });
  }
});

// Exportar candidatos a CSV
router.get('/candidatos/exportar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[PROMOCIONES] === EXPORTANDO CANDIDATOS ===');

    const candidatos = await BeneficioBeneficiario.aggregate([
      {
        $match: {
          estado: 'inactivo',
          volveria_contratar: true
        }
      },
      {
        $lookup: {
          from: 'beneficiarios',
          localField: 'beneficiarioId',
          foreignField: '_id',
          as: 'beneficiarioData'
        }
      },
      {
        $unwind: '$beneficiarioData'
      },
      {
        $sort: { fecha_desactivacion: -1 }
      }
    ]);

    // Formatear para CSV
    const csvData = candidatos.map(candidato => ({
      Nombre: `${candidato.beneficiarioData.nombre} ${candidato.beneficiarioData.apellido}`,
      Email: candidato.beneficiarioData.correo || '',
      Telefono: candidato.beneficiarioData.telefono || '',
      Servicio: candidato.servicioNombre,
      FechaDesactivacion: candidato.fecha_desactivacion ? 
        new Date(candidato.fecha_desactivacion).toLocaleDateString('es-ES') : '',
      MotivoDesactivacion: candidato.motivo_desactivacion || '',
      RazonPersonalizada: candidato.razon_personalizada || '',
      VolveriaContratar: candidato.volveria_contratar ? 'SÍ' : 'NO'
    }));

    // Crear CSV
    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=candidatos-promociones-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff' + csv); // BOM para UTF-8

    console.log(`[PROMOCIONES]  CSV exportado: ${candidatos.length} registros`);

  } catch (error) {
    console.error('[PROMOCIONES] Error exportando:', error);
    res.status(500).json({
      success: false,
      error: 'Error exportando CSV',
      mensaje: error.message
    });
  }
});


// ENDPOINT TEMPORAL 
router.post('/admin/migrar-candidatos', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[MIGRACIÓN] === INICIANDO MIGRACIÓN DE CANDIDATOS ===');
    
    // 1. Marcar candidatos potenciales
    const candidatosPositivos = await BeneficioBeneficiario.updateMany(
      {
        estado: 'inactivo',
        motivo_desactivacion: { 
          $in: ['inactividad_prolongada', 'cambio_programa', 'solicitud_beneficiario'] 
        },
        volveria_contratar: { $in: [false, null] }
      },
      {
        $set: { 
          volveria_contratar: true,
          notas_adicionales: '[MIGRACIÓN] Marcado como candidato potencial'
        }
      }
    );
    
    // 2. Marcar como NO candidatos los casos negativos
    const candidatosNegativos = await BeneficioBeneficiario.updateMany(
      {
        estado: 'inactivo',
        motivo_desactivacion: { 
          $in: ['incumplimiento_pagos', 'decision_administrativa', 'finalizacion_contrato'] 
        },
        volveria_contratar: null
      },
      {
        $set: { 
          volveria_contratar: false
        }
      }
    );
    
    // 3. Estadísticas finales
    const estadisticas = await BeneficioBeneficiario.aggregate([
      { $match: { estado: 'inactivo' } },
      {
        $group: {
          _id: '$volveria_contratar',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const resumen = {
      candidatos_SI: estadisticas.find(e => e._id === true)?.count || 0,
      candidatos_NO: estadisticas.find(e => e._id === false)?.count || 0,
      sin_procesar: estadisticas.find(e => e._id === null)?.count || 0
    };
    
    res.json({
      success: true,
      mensaje: 'Migración completada exitosamente',
      candidatos_marcados: candidatosPositivos.modifiedCount,
      no_candidatos_marcados: candidatosNegativos.modifiedCount,
      resumen_final: resumen
    });
    
  } catch (error) {
    console.error('[MIGRACIÓN] Error:', error);
    res.status(500).json({
      error: 'Error en migración',
      mensaje: error.message
    });
  }
});


export default router;