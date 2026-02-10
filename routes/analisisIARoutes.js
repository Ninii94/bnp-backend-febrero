import express from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { checkAuth, isEquipoBNP } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Modelo para guardar los análisis de IA
const AnalisisIA = mongoose.model('AnalisisIA', new mongoose.Schema({
  analisis: {
    resumen: String,
    observaciones: [String],
    recomendaciones: [{
      titulo: String,
      descripcion: String,
      impacto: String
    }],
    tendencias: String
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  }
}));

// Obtener último análisis de IA
router.get('/ultimo', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const ultimoAnalisis = await AnalisisIA.findOne()
      .sort({ fechaCreacion: -1 })
      .limit(1);
    
    if (!ultimoAnalisis) {
      return res.status(404).json({
        mensaje: 'No se encontró ningún análisis previo'
      });
    }
    
    res.json(ultimoAnalisis);
  } catch (error) {
    console.error('Error al obtener el último análisis:', error);
    res.status(500).json({
      mensaje: 'Error al obtener el análisis',
      error: error.message
    });
  }
});

// Generar un nuevo análisis con IA
// Función para generar el contexto de las estadísticas para la IA
function generarContextoParaIA(estadisticas) {
  let context = `Analiza las siguientes estadísticas de beneficiarios y proporciona recomendaciones basadas en los datos:

ESTADÍSTICAS GENERALES:
Total de beneficiarios: ${estadisticas.beneficiarios.totalBeneficiarios}
Beneficiarios con llave única activa: ${estadisticas.beneficiarios.llaveUnicaActiva} (${Math.round((estadisticas.beneficiarios.llaveUnicaActiva / estadisticas.beneficiarios.totalBeneficiarios) * 100)}%)
Beneficiarios con llave única inactiva: ${estadisticas.beneficiarios.llaveUnicaInactiva} (${Math.round((estadisticas.beneficiarios.llaveUnicaInactiva / estadisticas.beneficiarios.totalBeneficiarios) * 100)}%)

SERVICIOS ACTIVOS:`;

  if (estadisticas.servicios && estadisticas.servicios.length > 0) {
    estadisticas.servicios.forEach(servicio => {
      context += `\n- ${servicio.nombre}: ${servicio.cantidad} beneficiarios (${Math.round((servicio.cantidad / estadisticas.beneficiarios.totalBeneficiarios) * 100)}%)`;
    });
  } else {
    context += '\nNo hay datos de servicios activos disponibles.';
  }

  if (estadisticas.reembolsos) {
    context += `\n\nREEMBOLSOS:
Beneficiarios con reembolso: ${estadisticas.reembolsos.conReembolso}
Pendientes de activación: ${estadisticas.reembolsos.pendientesActivacion}
Activados: ${estadisticas.reembolsos.activados}
Cancelados: ${estadisticas.reembolsos.cancelados}
Monto total de reembolsos: ${estadisticas.reembolsos.montoTotalReembolsos}`;
  }

  if (estadisticas.nacionalidades && estadisticas.nacionalidades.length > 0) {
    context += '\n\nNACIONALIDADES (Top 5):';
    estadisticas.nacionalidades.slice(0, 5).forEach(nac => {
      context += `\n- ${nac.nacionalidad}: ${nac.cantidad} beneficiarios`;
    });
  }

  context += `\n\nPor favor, proporciona un análisis en formato JSON con la siguiente estructura:
{
  "resumen": "Un resumen ejecutivo de las estadísticas y su significado para el negocio",
  "observaciones": ["Lista de observaciones clave basadas en los datos"],
  "recomendaciones": [
    {
      "titulo": "Título de la recomendación",
      "descripcion": "Descripción detallada de la recomendación",
      "impacto": "Impacto esperado de implementar esta recomendación"
    }
  ],
  "tendencias": "Análisis de tendencias identificadas en los datos"
}`;

  return context;
}

// Función para generar un análisis de fallback en caso de error con la API de IA
function generarAnalisisFallback(estadisticas) {
  return {
    resumen: `Análisis basado en ${estadisticas.beneficiarios.totalBeneficiarios} beneficiarios registrados, donde el ${Math.round((estadisticas.beneficiarios.llaveUnicaActiva / estadisticas.beneficiarios.totalBeneficiarios) * 100)}% tiene su llave única activada.`,
    observaciones: [
      `El ${Math.round((estadisticas.beneficiarios.llaveUnicaInactiva / estadisticas.beneficiarios.totalBeneficiarios) * 100)}% de los beneficiarios tiene su llave única inactiva, lo que indica oportunidades de mejora en el proceso de activación.`,
      `La distribución de servicios muestra diferentes niveles de adopción entre los beneficiarios.`,
      `Se requiere atención para incrementar la tasa de activación de llaves únicas.`
    ],
    recomendaciones: [
      {
        titulo: "Campaña de activación de llaves únicas",
        descripcion: "Implementar una campaña de comunicación dirigida a beneficiarios con llaves inactivas para incrementar la tasa de activación.",
        impacto: "Incremento en la utilización de servicios y mejora en la experiencia del beneficiario."
      },
      {
        titulo: "Revisión del proceso de onboarding",
        descripcion: "Evaluar y optimizar el proceso de registro y activación inicial de beneficiarios para incrementar la tasa de activación desde el primer momento.",
        impacto: "Reducción del número de llaves inactivas y mejora en la experiencia inicial del usuario."
      },
      {
        titulo: "Análisis detallado de servicios",
        descripcion: "Realizar un estudio sobre los servicios menos utilizados para identificar barreras de adopción y posibles mejoras.",
        impacto: "Mayor adopción de servicios y aumento en la satisfacción de los beneficiarios."
      }
    ],
    tendencias: "Los datos actuales no permiten identificar tendencias temporales claras. Se recomienda implementar un seguimiento longitudinal para detectar patrones de comportamiento a lo largo del tiempo."
  };
}

router.post('/generar', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const { estadisticas } = req.body;
    
    if (!estadisticas || !estadisticas.beneficiarios) {
      return res.status(400).json({
        mensaje: 'Datos insuficientes para generar análisis'
      });
    }
    
    // Aquí integramos con la API de IA (OpenAI o similar)
    let analisisGenerado;
    
    try {
      // Usar AI generativa para analizar las estadísticas
      // Aquí puedes integrarte con la API de OpenAI, Anthropic, etc.
      
      // Ejemplo con OpenAI (asumiendo que tienes la API configurada)
      const mensajeContexto = generarContextoParaIA(estadisticas);
      
      const openAiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'Eres un asesor ejecutivo especializado en análisis de datos de beneficiarios y servicios. Tu tarea es analizar las estadísticas proporcionadas y generar conclusiones útiles, observaciones clave y recomendaciones accionables.'
            },
            {
              role: 'user',
              content: mensajeContexto
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        }
      );
      
      // Procesar la respuesta (que debe venir en formato JSON)
      const contenidoRespuesta = openAiResponse.data.choices[0].message.content;
      analisisGenerado = JSON.parse(contenidoRespuesta);
      
    } catch (iaError) {
      console.error('Error al comunicarse con la API de IA:', iaError);
      
      // Si falla la IA, usamos una respuesta de fallback
      analisisGenerado = generarAnalisisFallback(estadisticas);
    }
    
    // Guardar el análisis en la base de datos
    const nuevoAnalisis = new AnalisisIA({
      analisis: analisisGenerado,
      creadoPor: req.usuario._id
    });
    
    await nuevoAnalisis.save();
    
    res.json({
      mensaje: 'Análisis generado correctamente',
      analisis: analisisGenerado,
      fechaCreacion: nuevoAnalisis.fechaCreacion
    });
  } catch (error) {
    console.error('Error al generar análisis de IA:', error);
    res.status(500).json({
      mensaje: 'Error al generar análisis',
      error: error.message
    });
  }
});
export default router; 