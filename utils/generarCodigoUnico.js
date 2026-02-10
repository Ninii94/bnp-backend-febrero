//reembolso de boletos aereos 
import { Reembolso } from '../models/Reembolso.js';

/**
 * Genera un código único para reembolsos
 * El formato del código es: AIR-XXX-YYYY donde:
 * XXX: 3 letras mayúsculas aleatorias (excluyendo I, O)
 * YYYY: 4 dígitos aleatorios (excluyendo 0, 1)
 * @returns {Promise<string>} Código único generado
 */
export const generarCodigoUnico = async () => {
  let isUnique = false;
  let codigoGenerado = '';
  let intentos = 0;
  const maxIntentos = 10;
  
  while (!isUnique && intentos < maxIntentos) {
    // Letras para generar el código (excluyendo I, O para evitar confusión)
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    // Dígitos para generar el código (excluyendo 0, 1 para evitar confusión)
    const numeros = '23456789';
    
    // Iniciar con el prefijo
    let codigo = 'AIR-';
    
    // Generar 3 letras aleatorias
    for (let i = 0; i < 3; i++) {
      codigo += letras.charAt(Math.floor(Math.random() * letras.length));
    }
    
    // Agregar separador
    codigo += '-';
    
    // Generar 4 dígitos aleatorios
    for (let i = 0; i < 4; i++) {
      codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
    
    codigoGenerado = codigo;
    intentos++;
    
    // Verificar que no exista en la colección de Reembolsos
    const existente = await Reembolso.findOne({ codigo: codigoGenerado });
    
    if (!existente) {
      isUnique = true;
    }
  }
  
  if (!isUnique) {
    throw new Error('No se pudo generar un código de reembolso único después de múltiples intentos');
  }
  
  return codigoGenerado;
};