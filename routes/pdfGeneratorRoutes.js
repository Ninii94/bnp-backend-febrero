
import express from 'express';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';
import { generarPDF } from '../utils/pdfGenerator.js';

const router = express.Router();

// Ruta para generar PDF basado en análisis de IA
router.post('/generar-pdf', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estadisticas, analisis, fechaAnalisis } = req.body;
    
    if (!estadisticas || !analisis) {
      return res.status(400).json({
        mensaje: 'Datos insuficientes para generar PDF',
        error: 'Se requieren datos de estadísticas y análisis'
      });
    }
    
    // Convertir datos al formato que espera generarPDF
    const datosParaPDF = {
      ventasDiarias: [],  // No hay datos diarios en este caso
      ventasTotales: estadisticas.totalBeneficiarios || 0,
      promedioDiario: estadisticas.llaveUnicaActiva || 0,
      mejorDia: null,
      metasCumplidas: estadisticas.llaveUnicaActiva / estadisticas.totalBeneficiarios || 0,
      notas: [
        {
          fecha: fechaAnalisis || new Date(),
          aliado_nombre: "Análisis IA",
          texto: analisis.resumen
        },
        {
          fecha: fechaAnalisis || new Date(),
          aliado_nombre: "Observaciones",
          texto: analisis.observaciones.join("\n\n")
        }
      ]
    };
    
    // Agregar recomendaciones como notas
    if (analisis.recomendaciones && analisis.recomendaciones.length > 0) {
      analisis.recomendaciones.forEach((rec, index) => {
        datosParaPDF.notas.push({
          fecha: fechaAnalisis || new Date(),
          aliado_nombre: `Recomendación ${index + 1}`,
          texto: `${rec.titulo}: ${rec.descripcion}\nImpacto: ${rec.impacto || 'No especificado'}`
        });
      });
    }
    
    // Generar el PDF
    const doc = await generarPDF(datosParaPDF, 'actual', { nombre: "Reporte de Beneficiarios" });
    
    // Configurar respuesta como stream de PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="analisis.pdf"');
    
    // Enviar el PDF al cliente
    doc.pipe(res);
    doc.end();
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({
      mensaje: 'Error al generar PDF',
      error: error.message
    });
  }
});
export default router;