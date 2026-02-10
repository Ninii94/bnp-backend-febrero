//  - Funciones de formato para la aplicación

/**
 * Formatea un monto a formato de moneda USD
 * @param {number} monto - El monto a formatear
 * @param {string} moneda - La moneda a usar (por defecto USD)
 * @returns {string} - Monto formateado como $1,234.56
 */
export const formatearMonto = (monto, moneda = 'USD') => {
  if (monto === null || monto === undefined || isNaN(monto)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
};

/**
 * Formatea un monto sin símbolo de moneda
 * @param {number} monto - El monto a formatear
 * @returns {string} - Monto formateado como 1,234.56
 */
export const formatearNumero = (monto) => {
  if (monto === null || monto === undefined || isNaN(monto)) {
    return '0.00';
  }
  
  return new Intl.NumberFormat('es-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
};

/**
 * Formatea una fecha en formato largo en español
 * @param {string|Date} fecha - La fecha a formatear
 * @returns {string} - Fecha formateada como "15 de enero de 2024"
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return 'Fecha no disponible';
  
  try {
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      return 'Fecha inválida';
    }
    
    return fechaObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Fecha inválida';
  }
};

/**
 * Formatea una fecha en formato corto
 * @param {string|Date} fecha - La fecha a formatear
 * @returns {string} - Fecha formateada como "15/01/2024"
 */
export const formatearFechaCorta = (fecha) => {
  if (!fecha) return '--/--/----';
  
  try {
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      return '--/--/----';
    }
    
    return fechaObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formateando fecha corta:', error);
    return '--/--/----';
  }
};

/**
 * Formatea una fecha con hora
 * @param {string|Date} fecha - La fecha a formatear
 * @returns {string} - Fecha formateada como "15 de enero de 2024, 14:30"
 */
export const formatearFechaHora = (fecha) => {
  if (!fecha) return 'Fecha no disponible';
  
  try {
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      return 'Fecha inválida';
    }
    
    return fechaObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formateando fecha con hora:', error);
    return 'Fecha inválida';
  }
};

/**
 * Formatea tiempo relativo (hace X días, en X días)
 * @param {string|Date} fecha - La fecha a comparar
 * @returns {string} - Tiempo relativo como "hace 3 días" o "en 5 días"
 */
export const formatearTiempoRelativo = (fecha) => {
  if (!fecha) return 'Fecha no disponible';
  
  try {
    const fechaObj = new Date(fecha);
    const ahora = new Date();
    const diferenciaMilisegundos = fechaObj.getTime() - ahora.getTime();
    const diferenciaDias = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
    
    if (diferenciaDias === 0) {
      return 'Hoy';
    } else if (diferenciaDias === 1) {
      return 'Mañana';
    } else if (diferenciaDias === -1) {
      return 'Ayer';
    } else if (diferenciaDias > 0) {
      return `En ${diferenciaDias} día${diferenciaDias > 1 ? 's' : ''}`;
    } else {
      return `Hace ${Math.abs(diferenciaDias)} día${Math.abs(diferenciaDias) > 1 ? 's' : ''}`;
    }
  } catch (error) {
    console.error('Error formateando tiempo relativo:', error);
    return 'Fecha inválida';
  }
};

/**
 * Calcula y formatea el tiempo restante hasta una fecha
 * @param {string|Date} fechaVencimiento - La fecha de vencimiento
 * @returns {object} - Objeto con días, horas, minutos y texto formateado
 */
export const calcularTiempoRestante = (fechaVencimiento) => {
  if (!fechaVencimiento) {
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      texto: 'Fecha no disponible',
      vencido: true
    };
  }
  
  try {
    const fechaObj = new Date(fechaVencimiento);
    const ahora = new Date();
    const diferenciaMilisegundos = fechaObj.getTime() - ahora.getTime();
    
    if (diferenciaMilisegundos <= 0) {
      return {
        dias: 0,
        horas: 0,
        minutos: 0,
        texto: 'Vencido',
        vencido: true
      };
    }
    
    const dias = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferenciaMilisegundos % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferenciaMilisegundos % (1000 * 60 * 60)) / (1000 * 60));
    
    let texto = '';
    if (dias > 0) {
      texto += `${dias} día${dias !== 1 ? 's' : ''}`;
      if (horas > 0) texto += ` y ${horas} hora${horas !== 1 ? 's' : ''}`;
    } else if (horas > 0) {
      texto += `${horas} hora${horas !== 1 ? 's' : ''}`;
      if (minutos > 0) texto += ` y ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    } else {
      texto += `${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    }
    
    return {
      dias,
      horas,
      minutos,
      texto: texto || 'Menos de un minuto',
      vencido: false
    };
  } catch (error) {
    console.error('Error calculando tiempo restante:', error);
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      texto: 'Error en cálculo',
      vencido: true
    };
  }
};

/**
 * Formatea el estado de un ticket o solicitud
 * @param {string} estado - El estado a formatear
 * @returns {object} - Objeto con texto y clase CSS
 */
export const formatearEstado = (estado) => {
  const estados = {
    'pendiente': {
      texto: 'Pendiente',
      clase: 'bg-yellow-100 text-yellow-800',
      icono: '⏳'
    },
    'en_revision': {
      texto: 'En Revisión',
      clase: 'bg-blue-100 text-blue-800',
      icono: '👀'
    },
    'aprobado': {
      texto: 'Aprobado',
      clase: 'bg-green-100 text-green-800',
      icono: '✅'
    },
    'devuelto': {
      texto: 'Devuelto',
      clase: 'bg-purple-100 text-purple-800',
      icono: '↩️'
    },
    'rechazado': {
      texto: 'Rechazado',
      clase: 'bg-red-100 text-red-800',
      icono: '❌'
    },
    'activo': {
      texto: 'Activo',
      clase: 'bg-green-100 text-green-800',
      icono: '✅'
    },
    'inactivo': {
      texto: 'Inactivo',
      clase: 'bg-gray-100 text-gray-800',
      icono: '⏸️'
    },
    'bloqueado': {
      texto: 'Bloqueado',
      clase: 'bg-red-100 text-red-800',
      icono: '🔒'
    },
    'vencido': {
      texto: 'Vencido',
      clase: 'bg-gray-100 text-gray-800',
      icono: '⏰'
    },
    'proximo_a_vencer': {
      texto: 'Próximo a Vencer',
      clase: 'bg-orange-100 text-orange-800',
      icono: '⚠️'
    }
  };
  
  return estados[estado] || {
    texto: estado?.charAt(0).toUpperCase() + estado?.slice(1).replace('_', ' ') || 'Desconocido',
    clase: 'bg-gray-100 text-gray-800',
    icono: '❓'
  };
};

/**
 * Formatea el tipo de transacción
 * @param {string} tipo - El tipo de transacción
 * @returns {object} - Objeto con texto y clase CSS
 */
export const formatearTipoTransaccion = (tipo) => {
  const tipos = {
    'descuento': {
      texto: 'Descuento por Uso',
      clase: 'bg-red-100 text-red-600',
      icono: '📉'
    },
    'activacion': {
      texto: 'Activación de Servicio',
      clase: 'bg-green-100 text-green-600',
      icono: '🟢'
    },
    'desactivacion': {
      texto: 'Desactivación de Servicio',
      clase: 'bg-yellow-100 text-yellow-600',
      icono: '🟡'
    },
    'reactivacion': {
      texto: 'Servicio Reactivado',
      clase: 'bg-blue-100 text-blue-600',
      icono: '🔄'
    },
    'bloqueo': {
      texto: 'Servicio Bloqueado',
      clase: 'bg-red-100 text-red-600',
      icono: '🔒'
    },
    'pago_reactivacion': {
      texto: 'Pago de Reactivación',
      clase: 'bg-purple-100 text-purple-600',
      icono: '💳'
    },
    'ajuste': {
      texto: 'Ajuste Manual',
      clase: 'bg-gray-100 text-gray-600',
      icono: '⚙️'
    }
  };
  
  return tipos[tipo] || {
    texto: tipo?.charAt(0).toUpperCase() + tipo?.slice(1).replace('_', ' ') || 'Desconocido',
    clase: 'bg-gray-100 text-gray-600',
    icono: '❓'
  };
};

/**
 * Formatea el tamaño de archivo en bytes a formato legible
 * @param {number} bytes - El tamaño en bytes
 * @returns {string} - Tamaño formateado como "1.5 MB"
 */
export const formatearTamanoArchivo = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Formatea un porcentaje
 * @param {number} valor - El valor a formatear
 * @param {number} total - El total para calcular el porcentaje
 * @param {number} decimales - Número de decimales (por defecto 1)
 * @returns {string} - Porcentaje formateado como "75.5%"
 */
export const formatearPorcentaje = (valor, total, decimales = 1) => {
  if (!total || total === 0) return '0%';
  
  const porcentaje = (valor / total) * 100;
  return porcentaje.toFixed(decimales) + '%';
};

/**
 * Trunca un texto a una longitud específica
 * @param {string} texto - El texto a truncar
 * @param {number} longitud - La longitud máxima
 * @param {string} sufijo - El sufijo a agregar (por defecto "...")
 * @returns {string} - Texto truncado
 */
export const truncarTexto = (texto, longitud = 50, sufijo = '...') => {
  if (!texto) return '';
  if (texto.length <= longitud) return texto;
  
  return texto.substring(0, longitud) + sufijo;
};

/**
 * Formatea un número de teléfono
 * @param {string} telefono - El número de teléfono
 * @returns {string} - Teléfono formateado
 */
export const formatearTelefono = (telefono) => {
  if (!telefono) return '';
  
  // Remover todos los caracteres no numéricos
  const numeroLimpio = telefono.replace(/\D/g, '');
  
  // Formatear según la longitud
  if (numeroLimpio.length === 10) {
    return numeroLimpio.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (numeroLimpio.length === 11) {
    return numeroLimpio.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  }
  
  return telefono; // Devolver original si no coincide con formato esperado
};

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} texto - El texto a capitalizar
 * @returns {string} - Texto capitalizado
 */
export const capitalizarTexto = (texto) => {
  if (!texto) return '';
  
  return texto.toLowerCase().replace(/\b\w/g, (letra) => letra.toUpperCase());
};

/**
 * Formatea un tipo de medio de pago
 * @param {string} tipo - El tipo de medio de pago
 * @returns {object} - Objeto con texto e icono
 */
export const formatearTipoMedioPago = (tipo) => {
  const tipos = {
    'tarjeta_credito': {
      texto: 'Tarjeta de Crédito',
      icono: '💳'
    },
    'tarjeta_debito': {
      texto: 'Tarjeta de Débito',
      icono: '💳'
    },
    'transferencia_bancaria': {
      texto: 'Transferencia Bancaria',
      icono: '🏦'
    },
    'paypal': {
      texto: 'PayPal',
      icono: '💰'
    },
    'otro': {
      texto: 'Otro Método',
      icono: '💼'
    }
  };
  
  return tipos[tipo] || {
    texto: capitalizarTexto(tipo?.replace('_', ' ')) || 'Desconocido',
    icono: '❓'
  };
};

// Exportar todas las funciones como default también
const formatters = {
  formatearMonto,
  formatearNumero,
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearTiempoRelativo,
  calcularTiempoRestante,
  formatearEstado,
  formatearTipoTransaccion,
  formatearTamanoArchivo,
  formatearPorcentaje,
  truncarTexto,
  formatearTelefono,
  capitalizarTexto,
  formatearTipoMedioPago
};

export default formatters;