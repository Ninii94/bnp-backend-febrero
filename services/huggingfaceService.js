import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

// Inicializar cliente de Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const MISTRAL_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';

/**
 * Genera análisis y recomendaciones basadas en estadísticas de beneficiarios utilizando Mistral 7B
 * @param {Object} estadisticas - Datos estadísticos de los beneficiarios
 * @returns {Promise<Object>} - Objeto con análisis y recomendaciones
 */
export const analizarEstadisticas = async (estadisticas) => {
  try {
    console.log('Iniciando análisis con Mistral 7B para estadísticas de beneficiarios');
    
    // Generar prompt para Mistral (formato específico para modelos instruct)
    const prompt = generarPromptMistral(estadisticas);
    
    try {
      console.log('Enviando solicitud a Hugging Face con modelo Mistral...');
      const respuesta = await hf.textGeneration({
        model: MISTRAL_MODEL,
        inputs: prompt,
        parameters: {
          max_new_tokens: 800,  // Aumentado para obtener un análisis más completo
          temperature: 0.7,     // Balanceado entre creatividad y determinismo
          top_p: 0.95,          // Diversidad razonable en las respuestas
          return_full_text: false
        }
      });
      
      // Procesar la respuesta para extraer el JSON
      return procesarRespuestaMistral(respuesta.generated_text);
    } catch (hfError) {
      console.error('Error con Hugging Face Mistral 7B:', hfError);
      // Si hay un error con la API, usar respuesta de respaldo
      return generarRespuestaRespaldo(estadisticas);
    }
  } catch (error) {
    console.error('Error general al generar análisis con Mistral 7B:', error);
    return generarRespuestaRespaldo(estadisticas);
  }
};

/**
 * Genera el prompt específico para Mistral 7B Instruct
 * Formato: <s>[INST] prompt [/INST]
 */
function generarPromptMistral(estadisticas) {
  const {
    totalBeneficiarios,
    llaveUnicaActiva = 0,
    llaveUnicaInactiva = 0,
    serviciosActivos = [],
    nacionalidades = []
  } = estadisticas;
  
  // Calcular porcentajes si hay datos disponibles
  const porcActivas = totalBeneficiarios ? Math.round((llaveUnicaActiva / totalBeneficiarios) * 100) : 0;
  const porcInactivas = totalBeneficiarios ? Math.round((llaveUnicaInactiva / totalBeneficiarios) * 100) : 0;
  
  // Obtener top 5 servicios más utilizados
  const topServicios = [...serviciosActivos]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
    .map(s => `${s.nombre}: ${s.cantidad} (${totalBeneficiarios ? Math.round((s.cantidad / totalBeneficiarios) * 100) : 0}%)`);
    
  // Obtener top 5 nacionalidades
  const topNacionalidades = [...nacionalidades]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
    .map(n => `${n.nacionalidad}: ${n.cantidad} usuarios`);
  
  // Formato específico para Mistral Instruct
  return `<s>[INST] Analiza las siguientes estadísticas de una plataforma de beneficiarios y genera recomendaciones detalladas:

ESTADÍSTICAS:
- Total de beneficiarios registrados: ${totalBeneficiarios}
- Beneficiarios con llave única activa: ${llaveUnicaActiva} (${porcActivas}%)
- Beneficiarios con llave única inactiva: ${llaveUnicaInactiva} (${porcInactivas}%)

SERVICIOS MÁS UTILIZADOS:
${topServicios.join('\n')}

PRINCIPALES NACIONALIDADES:
${topNacionalidades.join('\n')}

Proporciona un análisis completo con el siguiente formato JSON exacto (sin incluir texto adicional antes o después del JSON):
{
  "resumen": "Un resumen ejecutivo de los datos que incluya tendencias principales y hallazgos clave",
  "observaciones": ["Observación específica 1", "Observación específica 2", "Observación específica 3"],
  "tendencias": "Análisis detallado de tendencias identificadas y patrones",
  "recomendaciones": [
    {
      "titulo": "Título de la recomendación 1",
      "descripcion": "Descripción detallada de la acción recomendada",
      "impacto": "Alto/Medio/Bajo - Justificación del impacto esperado"
    },
    {
      "titulo": "Título de la recomendación 2",
      "descripcion": "Descripción detallada de la acción recomendada",
      "impacto": "Alto/Medio/Bajo - Justificación del impacto esperado"
    }
  ]
}

Tu respuesta debe ser SOLO el objeto JSON, nada más. [/INST]`;
}

/**
 * Procesa la respuesta del modelo Mistral para extraer el JSON
 */
function procesarRespuestaMistral(textoRespuesta) {
  try {
    console.log('Procesando respuesta de Mistral. Primeros 100 caracteres:', textoRespuesta.substring(0, 100));
    
    // Intentar encontrar un JSON válido en la respuesta
    // Mistral puede incluir texto adicional antes o después del JSON
    const jsonRegex = /\{[\s\S]*\}/;
    const matches = textoRespuesta.match(jsonRegex);
    
    if (matches && matches.length > 0) {
      const jsonStr = matches[0];
      try {
        const analisis = JSON.parse(jsonStr);
        
        // Validar estructura mínima
        if (!analisis.resumen) analisis.resumen = "No se pudo generar un resumen.";
        if (!analisis.observaciones || !Array.isArray(analisis.observaciones)) {
          analisis.observaciones = ["No se identificaron observaciones relevantes."];
        }
        if (!analisis.tendencias) analisis.tendencias = "No se identificaron tendencias claras.";
        if (!analisis.recomendaciones || !Array.isArray(analisis.recomendaciones)) {
          analisis.recomendaciones = [{
            titulo: "No hay recomendaciones disponibles",
            descripcion: "No se pudieron generar recomendaciones basadas en los datos proporcionados.",
            impacto: "N/A"
          }];
        }
        
        return analisis;
      } catch (parseError) {
        console.error('Error al parsear JSON de Mistral:', parseError);
        throw new Error('Formato de respuesta inválido');
      }
    } else {
      console.error('No se encontró un formato JSON válido en la respuesta de Mistral');
      throw new Error('No se encontró un formato JSON válido en la respuesta');
    }
  } catch (error) {
    console.error('Error al procesar la respuesta de Mistral:', error);
    throw error;
  }
}

/**
 * Genera una respuesta de respaldo en caso de error
 */
function generarRespuestaRespaldo(estadisticas) {
  console.log('Generando análisis de respaldo con datos locales (sin Mistral)');
  const {
    totalBeneficiarios,
    llaveUnicaActiva = 0,
    llaveUnicaInactiva = 0,
    serviciosActivos = [],
    nacionalidades = []
  } = estadisticas;
  
  // Calcular porcentajes
  const porcActivas = totalBeneficiarios ? Math.round((llaveUnicaActiva / totalBeneficiarios) * 100) : 0;
  
  // Extraer solo el servicio más popular
  const servicioMasPopular = serviciosActivos.length > 0 
    ? serviciosActivos.sort((a, b) => b.cantidad - a.cantidad)[0]
    : null;
  
  const nombreServicioPopular = servicioMasPopular 
    ? servicioMasPopular.nombre 
    : "No hay datos suficientes sobre servicios";
  
  const porcentajeServicioPopular = servicioMasPopular && totalBeneficiarios
    ? Math.round((servicioMasPopular.cantidad / totalBeneficiarios) * 100) 
    : 0;
  
  // Extraer nacionalidad principal
  const nacionalidadPrincipal = nacionalidades.length > 0 
    ? nacionalidades.sort((a, b) => b.cantidad - a.cantidad)[0] 
    : null;
  
  const nombreNacionalidadPrincipal = nacionalidadPrincipal 
    ? nacionalidadPrincipal.nacionalidad 
    : "No hay datos suficientes sobre nacionalidades";
  
  return {
    resumen: `Análisis (generado localmente): Actualmente hay ${totalBeneficiarios} beneficiarios registrados, con ${llaveUnicaActiva} (${porcActivas}%) beneficiarios con llaves únicas activas.`,
    observaciones: [
      `El ${porcActivas}% de los beneficiarios tienen sus llaves únicas activas, mientras que el ${100-porcActivas}% están inactivas.`,
      `El servicio más utilizado es "${nombreServicioPopular}" con ${servicioMasPopular ? servicioMasPopular.cantidad : 0} usuarios (${porcentajeServicioPopular}% del total).`,
      `La nacionalidad más común entre los beneficiarios es ${nombreNacionalidadPrincipal}.`
    ],
    tendencias: "Se observa que la mayoría de los beneficiarios mantienen sus llaves activas, lo que indica un buen nivel de compromiso con la plataforma.",
    recomendaciones: [
      {
        titulo: "Aumentar la tasa de activación",
        descripcion: `Implementar campañas específicas para los ${llaveUnicaInactiva} beneficiarios con llaves inactivas para incrementar el porcentaje de activación.`,
        impacto: "Alto - Mejora directa en el uso de la plataforma"
      },
      {
        titulo: `Potenciar el servicio "${nombreServicioPopular}"`,
        descripcion: `Dado que "${nombreServicioPopular}" es el servicio más utilizado, considerar expandir sus funcionalidades y usarlo como modelo para mejorar otros servicios menos populares.`,
        impacto: "Medio - Aprovechamiento de servicios con mayor demanda"
      },
      {
        titulo: "Análisis periódico de datos",
        descripcion: "Implementar revisiones mensuales de las estadísticas para identificar patrones emergentes y tomar decisiones basadas en datos.",
        impacto: "Alto - Mejora continua basada en datos"
      }
    ]
  };
}

export default { analizarEstadisticas };