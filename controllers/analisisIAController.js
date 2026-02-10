import { analizarEstadisticas } from '../services/huggingfaceService.js';
import mongoose from 'mongoose';

// Definir esquema para el modelo de análisis IA
const AnalisisSchema = new mongoose.Schema({
  analisis: {
    resumen: String,
    observaciones: [String],
    tendencias: String,
    recomendaciones: [{
      titulo: String,
      descripcion: String,
      impacto: String
    }]
  },
  estadisticas: Object,  // Guardamos los datos originales para referencia
  modeloUtilizado: {
    type: String,
    default: 'mistralai/Mistral-7B-Instruct-v0.2'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

// Crear el modelo (verificar si ya existe para evitar errores)
const AnalisisIA = mongoose.models.AnalisisIA || mongoose.model('AnalisisIA', AnalisisSchema);

/**
 * Genera un nuevo análisis basado en las estadísticas proporcionadas usando Mistral 7B
 */
export const generarAnalisis = async (req, res) => {
  try {
    const { estadisticas } = req.body;
    
    // Verificar que los datos necesarios están presentes
    if (!estadisticas || !estadisticas.totalBeneficiarios) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        mensaje: 'Se requieren datos estadísticos completos para generar el análisis' 
      });
    }
    
    console.log('Generando análisis con Mistral 7B. Datos iniciales:', 
      JSON.stringify({
        totalBeneficiarios: estadisticas.totalBeneficiarios,
        serviciosActivos: estadisticas.serviciosActivos?.length || 0,
        nacionalidades: estadisticas.nacionalidades?.length || 0
      })
    );
    
    // Generar análisis usando el servicio de Mistral 7B
    const analisis = await analizarEstadisticas(estadisticas);
    
    // Guardar en la base de datos
    const nuevoAnalisis = new AnalisisIA({
      analisis,
      estadisticas,
      modeloUtilizado: 'mistralai/Mistral-7B-Instruct-v0.2'  // Especificar el modelo usado
    });
    
    await nuevoAnalisis.save();
    
    console.log('Análisis con Mistral 7B generado y guardado correctamente');
    
    res.status(201).json({
      mensaje: 'Análisis generado correctamente con Mistral 7B',
      analisis,
      modeloUtilizado: nuevoAnalisis.modeloUtilizado,
      fechaCreacion: nuevoAnalisis.fechaCreacion
    });
    
  } catch (error) {
    console.error('Error al generar análisis con Mistral 7B:', error);
    res.status(500).json({ 
      error: 'Error al generar análisis IA',
      mensaje: error.message,
      detalles: 'Ocurrió un problema al comunicarse con el modelo Mistral 7B o al procesar su respuesta'
    });
  }
};

/**
 * Obtiene el último análisis generado
 */
export const obtenerUltimoAnalisis = async (req, res) => {
  try {
    console.log('Buscando el último análisis generado con Mistral 7B...');
    
    // Buscar el análisis más reciente
    const ultimoAnalisis = await AnalisisIA.findOne()
      .sort({ fechaCreacion: -1 })
      .limit(1);
    
    if (!ultimoAnalisis) {
      console.log('No se encontraron análisis previos');
      return res.status(404).json({ 
        error: 'No se encontraron análisis previos'
      });
    }
    
    console.log('Último análisis encontrado. Fecha:', ultimoAnalisis.fechaCreacion, 'Modelo:', ultimoAnalisis.modeloUtilizado);
    
    res.json({
      analisis: ultimoAnalisis.analisis,
      modeloUtilizado: ultimoAnalisis.modeloUtilizado,
      fechaCreacion: ultimoAnalisis.fechaCreacion
    });
    
  } catch (error) {
    console.error('Error al obtener último análisis:', error);
    res.status(500).json({ 
      error: 'Error al obtener el análisis',
      mensaje: error.message
    });
  }
};

/**
 * Obtiene el historial de análisis generados
 */
export const obtenerHistorialAnalisis = async (req, res) => {
  try {
    // Obtener parámetros de paginación
    const limite = parseInt(req.query.limite) || 10;
    const pagina = parseInt(req.query.pagina) || 1;
    const skip = (pagina - 1) * limite;
    
    // Realizar consulta paginada
    const historial = await AnalisisIA.find()
      .select('analisis.resumen modeloUtilizado fechaCreacion')
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limite);
      
    // Contar total de documentos
    const total = await AnalisisIA.countDocuments();
    
    res.json({
      historial,
      paginacion: {
        total,
        paginas: Math.ceil(total / limite),
        paginaActual: pagina,
        limite
      }
    });
    
  } catch (error) {
    console.error('Error al obtener historial de análisis:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial',
      mensaje: error.message
    });
  }
};

/**
 * Obtiene un análisis específico por ID
 */
export const obtenerAnalisisPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar que el ID sea válido para MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de análisis inválido' });
    }
    
    const analisis = await AnalisisIA.findById(id);
    
    if (!analisis) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }
    
    res.json({
      analisis: analisis.analisis,
      modeloUtilizado: analisis.modeloUtilizado,
      fechaCreacion: analisis.fechaCreacion
    });
    
  } catch (error) {
    console.error('Error al obtener análisis por ID:', error);
    res.status(500).json({ 
      error: 'Error al obtener el análisis',
      mensaje: error.message
    });
  }
};

// Exportar como default y también funciones individuales
export default {
  generarAnalisis,
  obtenerUltimoAnalisis,
  obtenerHistorialAnalisis,
  obtenerAnalisisPorId
};