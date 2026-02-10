import { registrarActividad } from './Bitacora.js';

export const registrarTicketBeneficiario = async (ticketData, req) => {
  try {
    const descripcion = `Beneficiario ${ticketData.beneficiario_nombre} creó ticket: ${ticketData.asunto}`;
    
    await registrarActividad(
      'ticket_creado_beneficiario',
      descripcion,
      {
        entidad_tipo: 'ticket',
        entidad_id: ticketData.ticket_id,
        entidad_nombre: ticketData.asunto,
        beneficiario_relacionado: {
          id: ticketData.beneficiario_id,
          nombre: ticketData.beneficiario_nombre,
        },
        datos_nuevos: {
          asunto: ticketData.asunto,
          categoria: ticketData.categoria,
          prioridad: ticketData.prioridad,
        },
        etiquetas: ['ticket', 'soporte', 'beneficiario'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando ticket beneficiario:', error);
  }
};

export const registrarTicketAliado = async (ticketData, req) => {
  try {
    const descripcion = `Aliado ${ticketData.aliado_nombre} creó ticket: ${ticketData.asunto}`;
    
    await registrarActividad(
      'ticket_creado_aliado',
      descripcion,
      {
        entidad_tipo: 'ticket',
        entidad_id: ticketData.ticket_id,
        entidad_nombre: ticketData.asunto,
        aliado_relacionado: {
          id: ticketData.aliado_id,
          nombre: ticketData.aliado_nombre,
        },
        datos_nuevos: {
          asunto: ticketData.asunto,
          categoria: ticketData.categoria,
          prioridad: ticketData.prioridad,
        },
        etiquetas: ['ticket', 'soporte', 'aliado'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando ticket aliado:', error);
  }
};

export const registrarSolicitudAyudaBienvenida = async (solicitudData, req) => {
  try {
    const descripcion = `Beneficiario ${solicitudData.beneficiario_nombre} solicitó ayuda en bienvenida`;
    
    await registrarActividad(
      'solicitud_ayuda_bienvenida',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: solicitudData.beneficiario_id,
        beneficiario_relacionado: {
          id: solicitudData.beneficiario_id,
          nombre: solicitudData.beneficiario_nombre,
        },
        datos_nuevos: {
          tipo_ayuda: solicitudData.tipo_ayuda,
          descripcion: solicitudData.descripcion,
        },
        etiquetas: ['bienvenida', 'ayuda', 'beneficiario'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando solicitud ayuda:', error);
  }
};

export const registrarSolicitudEnlacePagoBienvenida = async (solicitudData, req) => {
  try {
    const descripcion = `Beneficiario ${solicitudData.beneficiario_nombre} solicitó enlace de pago`;
    
    await registrarActividad(
      'solicitud_enlace_pago_bienvenida',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: solicitudData.beneficiario_id,
        beneficiario_relacionado: {
          id: solicitudData.beneficiario_id,
          nombre: solicitudData.beneficiario_nombre,
        },
        datos_nuevos: {
          tipo_pago: solicitudData.tipo_pago,
          monto: solicitudData.monto,
        },
        etiquetas: ['bienvenida', 'pago', 'beneficiario'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando solicitud enlace pago:', error);
  }
};

export const registrarEnlacePagoEnviado = async (pagoData, req) => {
  try {
    const descripcion = `Enlace de pago enviado a ${pagoData.beneficiario_nombre}`;
    
    await registrarActividad(
      'enlace_pago_enviado',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: pagoData.beneficiario_id,
        beneficiario_relacionado: {
          id: pagoData.beneficiario_id,
          nombre: pagoData.beneficiario_nombre,
        },
        datos_nuevos: {
          monto: pagoData.monto,
          concepto: pagoData.concepto,
          enlace: pagoData.enlace,
        },
        etiquetas: ['pago', 'enlace', 'equipo'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando enlace pago enviado:', error);
  }
};

export const registrarChatIniciado = async (chatData, req) => {
  try {
    const descripcion = `Beneficiario ${chatData.beneficiario_nombre} inició chat con agente`;
    
    await registrarActividad(
      'chat_iniciado',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: chatData.beneficiario_id,
        beneficiario_relacionado: {
          id: chatData.beneficiario_id,
          nombre: chatData.beneficiario_nombre,
        },
        datos_nuevos: {
          chat_id: chatData.chat_id,
          tipo_consulta: chatData.tipo_consulta,
        },
        etiquetas: ['chat', 'lia', 'soporte'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando chat iniciado:', error);
  }
};

export const registrarChatFinalizado = async (chatData, req) => {
  try {
    const descripcion = `Chat finalizado con ${chatData.beneficiario_nombre} - Duración: ${chatData.duracion_minutos} min`;
    
    await registrarActividad(
      'chat_finalizado',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: chatData.beneficiario_id,
        beneficiario_relacionado: {
          id: chatData.beneficiario_id,
          nombre: chatData.beneficiario_nombre,
        },
        datos_nuevos: {
          chat_id: chatData.chat_id,
          duracion_minutos: chatData.duracion_minutos,
          mensajes_totales: chatData.mensajes_totales,
          satisfaccion: chatData.satisfaccion,
          resolucion: chatData.resolucion,
        },
        etiquetas: ['chat', 'finalizado', 'estadisticas'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando chat finalizado:', error);
  }
};

export const registrarServicioActivado = async (servicioData, req) => {
  try {
    const descripcion = `Servicio ${servicioData.servicio_nombre} activado para ${servicioData.beneficiario_nombre}`;
    
    await registrarActividad(
      'servicio_activado',
      descripcion,
      {
        entidad_tipo: 'servicio',
        entidad_id: servicioData.servicio_id,
        beneficiario_relacionado: {
          id: servicioData.beneficiario_id,
          nombre: servicioData.beneficiario_nombre,
        },
        servicio_relacionado: {
          id: servicioData.servicio_id,
          nombre: servicioData.servicio_nombre,
        },
        datos_nuevos: {
          fecha_activacion: new Date(),
        },
        etiquetas: ['servicio', 'activacion'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando servicio activado:', error);
  }
};

export const registrarServicioDesactivado = async (servicioData, req) => {
  try {
    const descripcion = `Servicio ${servicioData.servicio_nombre} desactivado para ${servicioData.beneficiario_nombre}`;
    
    await registrarActividad(
      'servicio_desactivado',
      descripcion,
      {
        entidad_tipo: 'servicio',
        entidad_id: servicioData.servicio_id,
        beneficiario_relacionado: {
          id: servicioData.beneficiario_id,
          nombre: servicioData.beneficiario_nombre,
        },
        servicio_relacionado: {
          id: servicioData.servicio_id,
          nombre: servicioData.servicio_nombre,
        },
        datos_nuevos: {
          fecha_desactivacion: new Date(),
          motivo: servicioData.motivo,
        },
        etiquetas: ['servicio', 'desactivacion'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando servicio desactivado:', error);
  }
};

export const registrarBeneficiarioEliminadoSeguimiento = async (beneficiarioData, req) => {
  try {
    const descripcion = `Beneficiario ${beneficiarioData.nombre} eliminado del seguimiento`;
    
    await registrarActividad(
      'beneficiario_eliminado_seguimiento',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: beneficiarioData.beneficiario_id,
        beneficiario_relacionado: {
          id: beneficiarioData.beneficiario_id,
          nombre: beneficiarioData.nombre,
        },
        datos_nuevos: {
          motivo: beneficiarioData.motivo,
          servicio_desactivado: beneficiarioData.servicio_nombre,
        },
        etiquetas: ['seguimiento', 'eliminacion'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando eliminación de seguimiento:', error);
  }
};

export const registrarBeneficiarioContactadoSeguimiento = async (contactoData, req) => {
  try {
    const descripcion = `Beneficiario ${contactoData.nombre} contactado por seguimiento`;
    
    await registrarActividad(
      'beneficiario_contactado_seguimiento',
      descripcion,
      {
        entidad_tipo: 'beneficiario',
        entidad_id: contactoData.beneficiario_id,
        beneficiario_relacionado: {
          id: contactoData.beneficiario_id,
          nombre: contactoData.nombre,
        },
        datos_nuevos: {
          tipo_contacto: contactoData.tipo_contacto,
          resultado: contactoData.resultado,
          notas: contactoData.notas,
        },
        etiquetas: ['seguimiento', 'contacto'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contacto de seguimiento:', error);
  }
};

export const registrarContratoEnviado = async (contratoData, req) => {
  try {
    const destinatario = contratoData.destinatario_nombre || contratoData.beneficiario_nombre || contratoData.aliado_nombre;
    const tipoDestinatario = contratoData.destinatario_tipo || (contratoData.beneficiario_id ? 'beneficiario' : 'aliado');
    
    const descripcion = `Contrato enviado a ${destinatario}`;
    
    await registrarActividad(
      'contrato_enviado',
      descripcion,
      {
        entidad_tipo: 'contrato',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: contratoData.contrato_nombre,
        ...(tipoDestinatario === 'beneficiario' && contratoData.beneficiario_id ? {
          beneficiario_relacionado: {
            id: contratoData.beneficiario_id,
            nombre: destinatario,
          }
        } : {}),
        ...(tipoDestinatario === 'aliado' && contratoData.aliado_id ? {
          aliado_relacionado: {
            id: contratoData.aliado_id,
            nombre: destinatario,
          }
        } : {}),
        datos_nuevos: {
          contrato_tipo: contratoData.tipo,
          fecha_envio: new Date(),
          metodo_envio: contratoData.metodo_envio,
        },
        etiquetas: ['contrato', 'envio', tipoDestinatario],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato enviado:', error);
  }
};

export const registrarContratoFirmado = async (contratoData, req) => {
  try {
    const firmante = contratoData.firmante_nombre || contratoData.beneficiario_nombre || contratoData.aliado_nombre;
    const tipoFirmante = contratoData.firmante_tipo || (contratoData.beneficiario_id ? 'beneficiario' : 'aliado');
    
    const descripcion = `Contrato firmado por ${firmante}`;
    
    await registrarActividad(
      'contrato_firmado',
      descripcion,
      {
        entidad_tipo: 'contrato',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: contratoData.contrato_nombre,
        ...(tipoFirmante === 'beneficiario' && contratoData.beneficiario_id ? {
          beneficiario_relacionado: {
            id: contratoData.beneficiario_id,
            nombre: firmante,
          }
        } : {}),
        ...(tipoFirmante === 'aliado' && contratoData.aliado_id ? {
          aliado_relacionado: {
            id: contratoData.aliado_id,
            nombre: firmante,
          }
        } : {}),
        datos_nuevos: {
          fecha_firma: new Date(),
          ip_firma: contratoData.ip_firma,
        },
        etiquetas: ['contrato', 'firmado', tipoFirmante],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato firmado:', error);
  }
};

export const registrarContratoRechazado = async (contratoData, req) => {
  try {
    const rechazante = contratoData.rechazante_nombre || contratoData.beneficiario_nombre || contratoData.aliado_nombre;
    const tipoRechazante = contratoData.rechazante_tipo || (contratoData.beneficiario_id ? 'beneficiario' : 'aliado');
    
    const descripcion = `Contrato rechazado por ${rechazante}`;
    
    await registrarActividad(
      'contrato_rechazado',
      descripcion,
      {
        entidad_tipo: 'contrato',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: contratoData.contrato_nombre,
        ...(tipoRechazante === 'beneficiario' && contratoData.beneficiario_id ? {
          beneficiario_relacionado: {
            id: contratoData.beneficiario_id,
            nombre: rechazante,
          }
        } : {}),
        ...(tipoRechazante === 'aliado' && contratoData.aliado_id ? {
          aliado_relacionado: {
            id: contratoData.aliado_id,
            nombre: rechazante,
          }
        } : {}),
        datos_nuevos: {
          fecha_rechazo: new Date(),
          motivo: contratoData.motivo,
        },
        etiquetas: ['contrato', 'rechazado', tipoRechazante],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato rechazado:', error);
  }
};

export const registrarContratoEquipoCreado = async (contratoData, req) => {
  try {
    const aliadoNombre = contratoData.aliado_nombre || 'Aliado';
    const descripcion = `Contrato de equipo creado para aliado ${aliadoNombre}`;
    
    await registrarActividad(
      'contrato_equipo_creado',
      descripcion,
      {
        entidad_tipo: 'contrato_equipo',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato Equipo - ${aliadoNombre}`,
        aliado_relacionado: {
          id: contratoData.aliado_id,
          nombre: aliadoNombre,
        },
        datos_nuevos: {
          tipo_contrato: 'equipo',
          fecha_inicio: contratoData.fecha_inicio,
          fecha_fin: contratoData.fecha_fin,
          estado: contratoData.estado || 'borrador',
          observaciones: contratoData.observaciones,
        },
        parametros_accion: {
          metodo: 'creacion_contrato_equipo',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'equipo', 'creacion', 'aliado'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato equipo creado:', error);
  }
};

export const registrarContratoEquipoManual = async (contratoData, req) => {
  try {
    const aliadoNombre = contratoData.aliado_nombre || 'Aliado';
    const archivoNombre = contratoData.archivo_nombre || 'PDF';
    const descripcion = `Contrato de equipo manual subido para aliado ${aliadoNombre} - Archivo: ${archivoNombre}`;
    
    await registrarActividad(
      'contrato_equipo_manual_subido',
      descripcion,
      {
        entidad_tipo: 'contrato_equipo',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato Equipo Manual - ${aliadoNombre}`,
        aliado_relacionado: {
          id: contratoData.aliado_id,
          nombre: aliadoNombre,
        },
        datos_nuevos: {
          tipo_contrato: 'equipo',
          fecha_inicio: contratoData.fecha_inicio,
          fecha_fin: contratoData.fecha_fin,
          estado: 'firmado',
          archivo_nombre: archivoNombre,
          archivo_tamano: contratoData.archivo_tamano,
          es_manual: true,
        },
        parametros_accion: {
          metodo: 'subida_contrato_equipo_manual',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'equipo', 'manual', 'pdf', 'aliado'],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato equipo manual:', error);
  }
};

export const registrarContratoBeneficiarioCreado = async (contratoData, req) => {
  try {
    const beneficiarioNombre = contratoData.beneficiario_nombre || 'Beneficiario';
    const aliadoNombre = contratoData.aliado_nombre;
    const tipoContrato = contratoData.tipo_contrato || 'estándar';
    const numeroContrato = contratoData.numero_contrato;
    
    let descripcion = `Contrato beneficiario creado para ${beneficiarioNombre} - Tipo: ${tipoContrato}`;
    if (numeroContrato) descripcion += ` - N° ${numeroContrato}`;
    if (aliadoNombre) descripcion += ` - Aliado: ${aliadoNombre}`;
    
    await registrarActividad(
      'contrato_beneficiario_creado',
      descripcion,
      {
        entidad_tipo: 'contrato_beneficiario',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato ${tipoContrato} - ${beneficiarioNombre}`,
        beneficiario_relacionado: {
          id: contratoData.beneficiario_id,
          nombre: beneficiarioNombre,
          codigo: contratoData.beneficiario_codigo,
        },
        ...(contratoData.aliado_id && aliadoNombre ? {
          aliado_relacionado: {
            id: contratoData.aliado_id,
            nombre: aliadoNombre,
          }
        } : {}),
        datos_nuevos: {
          numero_contrato: numeroContrato,
          tipo_contrato: tipoContrato,
          fecha_inicio: contratoData.fecha_inicio,
          fecha_fin: contratoData.fecha_fin,
          estado: contratoData.estado || 'borrador',
          monto: contratoData.monto,
          metodo_pago: contratoData.metodo_pago,
        },
        parametros_accion: {
          metodo: 'creacion_contrato_beneficiario',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'beneficiario', 'creacion', tipoContrato],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato beneficiario creado:', error);
  }
};

export const registrarContratoBeneficiarioManual = async (contratoData, req) => {
  try {
    const beneficiarioNombre = contratoData.beneficiario_nombre || 'Beneficiario';
    const aliadoNombre = contratoData.aliado_nombre;
    const archivoNombre = contratoData.archivo_nombre || 'PDF';
    const numeroContrato = contratoData.numero_contrato || 'Sin número';
    const tipoContrato = contratoData.tipo_contrato || 'estándar';
    
    let descripcion = `Contrato beneficiario manual subido para ${beneficiarioNombre} - N° ${numeroContrato} - Archivo: ${archivoNombre}`;
    if (aliadoNombre) descripcion += ` - Aliado: ${aliadoNombre}`;
    
    await registrarActividad(
      'contrato_beneficiario_manual_subido',
      descripcion,
      {
        entidad_tipo: 'contrato_beneficiario',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato Manual ${tipoContrato} - ${beneficiarioNombre}`,
        beneficiario_relacionado: {
          id: contratoData.beneficiario_id,
          nombre: beneficiarioNombre,
          codigo: contratoData.beneficiario_codigo,
        },
        ...(contratoData.aliado_id && aliadoNombre ? {
          aliado_relacionado: {
            id: contratoData.aliado_id,
            nombre: aliadoNombre,
          }
        } : {}),
        datos_nuevos: {
          numero_contrato: numeroContrato,
          tipo_contrato: tipoContrato,
          fecha_inicio: contratoData.fecha_inicio,
          fecha_fin: contratoData.fecha_fin,
          estado: 'firmado',
          monto: contratoData.monto,
          archivo_nombre: archivoNombre,
          archivo_tamano: contratoData.archivo_tamano,
          es_manual: true,
        },
        parametros_accion: {
          metodo: 'subida_contrato_beneficiario_manual',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'beneficiario', 'manual', 'pdf', tipoContrato],
      },
      req
    );
  } catch (error) {
    console.error('Error registrando contrato beneficiario manual:', error);
  }
};

export async function registrarContratoBeneficiarioEnviado(contratoData, req) {
  try {
    const descripcion = `Contrato ${contratoData.numero_contrato} enviado a beneficiario ${contratoData.beneficiario_nombre} para firma`;
    
    await registrarActividad(
      'contrato_beneficiario_enviado',
      descripcion,
      {
        entidad_tipo: 'contrato_beneficiario',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato ${contratoData.tipo_contrato} - ${contratoData.beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: contratoData.beneficiario_id,
          nombre: contratoData.beneficiario_nombre,
          codigo: contratoData.beneficiario_codigo,
        },
        aliado_relacionado: contratoData.aliado_id ? {
          id: contratoData.aliado_id,
          nombre: contratoData.aliado_nombre,
        } : null,
        datos_nuevos: {
          numero_contrato: contratoData.numero_contrato,
          tipo_contrato: contratoData.tipo_contrato,
          beneficiario_email: contratoData.beneficiario_email,
          fecha_envio: contratoData.fecha_envio,
          token_firma: contratoData.token_firma,
          link_firma: contratoData.link_firma,
        },
        parametros_accion: {
          metodo: 'envio_contrato_beneficiario',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'beneficiario', 'envio', contratoData.tipo_contrato],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error al registrar envío de contrato beneficiario:', error);
  }
}

export async function registrarContratoBeneficiarioFirmado(contratoData, reqSimulado = null) {
  try {
    const descripcion = `Contrato ${contratoData.numero_contrato} firmado digitalmente por beneficiario ${contratoData.beneficiario_nombre}`;
    
    await registrarActividad(
      'contrato_beneficiario_firmado',
      descripcion,
      {
        entidad_tipo: 'contrato_beneficiario',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato ${contratoData.tipo_contrato} - ${contratoData.beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: contratoData.beneficiario_id,
          nombre: contratoData.beneficiario_nombre,
          codigo: typeof contratoData.beneficiario_codigo === 'object' 
            ? contratoData.beneficiario_codigo.value 
            : contratoData.beneficiario_codigo,
        },
        aliado_relacionado: contratoData.aliado_id ? {
          id: contratoData.aliado_id,
          nombre: contratoData.aliado_nombre,
        } : null,
        datos_nuevos: {
          numero_contrato: contratoData.numero_contrato,
          tipo_contrato: contratoData.tipo_contrato,
          fecha_firma: contratoData.fecha_firma,
          ip_firma: contratoData.ip_firma,
          hash_documento: contratoData.hash_documento,
        },
        parametros_accion: {
          metodo: 'firma_contrato_beneficiario',
          endpoint: '/api/contrato-beneficiario/firmar',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'beneficiario', 'firmado', contratoData.tipo_contrato],
      },
      reqSimulado,
      'alto'
    );
  } catch (error) {
    console.error('Error al registrar firma de contrato beneficiario:', error);
  }
}

export async function registrarContratoBeneficiarioRechazado(contratoData, reqSimulado = null) {
  try {
    const descripcion = `Contrato ${contratoData.numero_contrato} rechazado por beneficiario ${contratoData.beneficiario_nombre}`;
    
    await registrarActividad(
      'contrato_beneficiario_rechazado',
      descripcion,
      {
        entidad_tipo: 'contrato_beneficiario',
        entidad_id: contratoData.contrato_id,
        entidad_nombre: `Contrato ${contratoData.tipo_contrato} - ${contratoData.beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: contratoData.beneficiario_id,
          nombre: contratoData.beneficiario_nombre,
          codigo: typeof contratoData.beneficiario_codigo === 'object' 
            ? contratoData.beneficiario_codigo.value 
            : contratoData.beneficiario_codigo,
        },
        aliado_relacionado: contratoData.aliado_id ? {
          id: contratoData.aliado_id,
          nombre: contratoData.aliado_nombre,
        } : null,
        datos_nuevos: {
          numero_contrato: contratoData.numero_contrato,
          tipo_contrato: contratoData.tipo_contrato,
          fecha_rechazo: contratoData.fecha_rechazo,
          motivo_rechazo: contratoData.motivo_rechazo || 'Sin motivo especificado',
        },
        parametros_accion: {
          metodo: 'rechazo_contrato_beneficiario',
          endpoint: '/api/contrato-beneficiario/firmar/rechazar',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['contrato', 'beneficiario', 'rechazado', contratoData.tipo_contrato],
      },
      reqSimulado,
      'alto'
    );
  } catch (error) {
    console.error('Error al registrar rechazo de contrato beneficiario:', error);
  }
}

export const registrarCambioEstadoFinanciamiento = async (financiamientoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, estado_anterior, estado_nuevo, financiamiento_id, notas } = financiamientoData;
    
    const descripcion = `Financiamiento de ${beneficiario_nombre} cambió de estado: ${estado_anterior} → ${estado_nuevo}`;
    
    await registrarActividad(
      'financiamiento_estado_cambiado',
      descripcion,
      {
        entidad_tipo: 'financiamiento',
        entidad_id: financiamiento_id,
        entidad_nombre: `Financiamiento - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        financiamiento_relacionado: {
          id: financiamiento_id,
        },
        datos_anteriores: {
          estado: estado_anterior,
        },
        datos_nuevos: {
          estado: estado_nuevo,
          notas: notas,
        },
        parametros_accion: {
          metodo: 'cambio_estado_financiamiento',
          endpoint: req?.originalUrl || '/api/financiamientos/:id/estado',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'estado', estado_nuevo.toLowerCase(), 'entrada-flex'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando cambio estado financiamiento:', error);
  }
};

export const registrarCuotaPagada = async (cuotaData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, numero_cuota, monto_pagado, financiamiento_id, comprobante } = cuotaData;
    
    const descripcion = `Cuota #${numero_cuota} marcada como pagada - ${beneficiario_nombre} - Monto: $${monto_pagado}`;
    
    await registrarActividad(
      'financiamiento_cuota_pagada',
      descripcion,
      {
        entidad_tipo: 'cuota',
        entidad_id: financiamiento_id,
        entidad_nombre: `Cuota #${numero_cuota} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        financiamiento_relacionado: {
          id: financiamiento_id,
          numero_cuota: numero_cuota,
          estado_cuota: 'Pagado',
        },
        datos_nuevos: {
          numero_cuota: numero_cuota,
          monto_pagado: monto_pagado,
          comprobante: comprobante,
          fecha_pago: new Date(),
        },
        parametros_accion: {
          metodo: 'marcar_cuota_pagada',
          endpoint: req?.originalUrl || '/api/financiamientos/:id/cuota/:numeroCuota',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'cuota', 'pagado', 'entrada-flex'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando cuota pagada:', error);
  }
};

export const registrarCuotaMorosa = async (cuotaData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, numero_cuota, dias_vencidos, interes_moratorio, financiamiento_id } = cuotaData;
    
    const descripcion = `Cuota #${numero_cuota} marcada como MOROSA - ${beneficiario_nombre} - ${dias_vencidos} días vencidos - Interés moratorio: $${interes_moratorio}`;
    
    await registrarActividad(
      'financiamiento_cuota_morosa',
      descripcion,
      {
        entidad_tipo: 'cuota',
        entidad_id: financiamiento_id,
        entidad_nombre: `Cuota #${numero_cuota} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        financiamiento_relacionado: {
          id: financiamiento_id,
          numero_cuota: numero_cuota,
          estado_cuota: 'Moroso',
        },
        datos_nuevos: {
          numero_cuota: numero_cuota,
          estado: 'Moroso',
          dias_vencidos: dias_vencidos,
          interes_moratorio: interes_moratorio,
          fecha_marcado: new Date(),
        },
        parametros_accion: {
          metodo: 'marcar_cuota_morosa',
          endpoint: req?.originalUrl || '/api/financiamientos/:id/cuota/:numeroCuota',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'cuota', 'moroso', 'alerta', 'entrada-flex'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando cuota morosa:', error);
  }
};

export const registrarCuotaLitigioLegal = async (cuotaData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, numero_cuota, financiamiento_id, notas } = cuotaData;
    
    const descripcion = `Cuota #${numero_cuota} marcada en LITIGIO LEGAL - ${beneficiario_nombre}`;
    
    await registrarActividad(
      'financiamiento_cuota_litigio',
      descripcion,
      {
        entidad_tipo: 'cuota',
        entidad_id: financiamiento_id,
        entidad_nombre: `Cuota #${numero_cuota} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        financiamiento_relacionado: {
          id: financiamiento_id,
          numero_cuota: numero_cuota,
          estado_cuota: 'Litigio legal',
        },
        datos_nuevos: {
          numero_cuota: numero_cuota,
          estado: 'Litigio legal',
          notas: notas,
          fecha_marcado: new Date(),
        },
        parametros_accion: {
          metodo: 'marcar_cuota_litigio',
          endpoint: req?.originalUrl || '/api/financiamientos/:id/cuota/:numeroCuota',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'cuota', 'litigio', 'legal', 'critico', 'entrada-flex'],
      },
      req,
      'critico'
    );
  } catch (error) {
    console.error('Error registrando cuota en litigio legal:', error);
  }
};

export const registrarLiquidacionAnticipada = async (liquidacionData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, hasta_cuota, monto_final, interes_aplicado, interes_condonado, financiamiento_id, comprobante } = liquidacionData;
    
    const descripcion = `Liquidación anticipada hasta cuota #${hasta_cuota} - ${beneficiario_nombre} - Monto: $${monto_final} - Interés condonado: $${interes_condonado}`;
    
    await registrarActividad(
      'financiamiento_liquidacion_anticipada',
      descripcion,
      {
        entidad_tipo: 'financiamiento',
        entidad_id: financiamiento_id,
        entidad_nombre: `Financiamiento - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        financiamiento_relacionado: {
          id: financiamiento_id,
          numero_cuota: hasta_cuota,
        },
        datos_nuevos: {
          hasta_cuota: hasta_cuota,
          monto_final: monto_final,
          interes_aplicado: interes_aplicado,
          interes_condonado: interes_condonado,
          comprobante: comprobante,
          fecha_liquidacion: new Date(),
        },
        parametros_accion: {
          metodo: 'liquidacion_anticipada',
          endpoint: req?.originalUrl || '/api/financiamientos/:id/liquidacion-anticipada',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'liquidacion', 'anticipada', 'entrada-flex'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando liquidación anticipada:', error);
  }
};
export const registrarFondoCreado = async (fondoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, monto_inicial, dias_periodo, fecha_vencimiento } = fondoData;
    
    const descripcion = `VoucherFlyback creado para ${beneficiario_nombre} - Monto: $${monto_inicial} - Vigencia: ${dias_periodo} días`;
    
    await registrarActividad(
      'fondo_creado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Restante - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          monto_inicial,
          dias_periodo,
          fecha_vencimiento,
          estado: 'activo',
          tipo_fondo: 'flyback',
        },
        parametros_accion: {
          metodo: 'crear_fondo',
          endpoint: req?.originalUrl || '/api/fondos/crear',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['voucherflyback', 'fondo', 'creacion', 'reembolso'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando creación de fondo:', error);
  }
};
export const registrarRenovacionFondo = async (fondoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, saldo_anterior, saldo_nuevo, fecha_vencimiento_nueva, contador_renovaciones } = fondoData;
    
    const descripcion = `Fondo renovado para ${beneficiario_nombre} - Renovación #${contador_renovaciones} - Saldo restaurado: $${saldo_nuevo}`;
    
    await registrarActividad(
      'reembolso_renovado',
      descripcion,
      {
        entidad_tipo: 'fondo',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Flyback - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        fondo_relacionado: {
          id: fondo_id,
          tipo_fondo: 'Flyback',
        },
        datos_anteriores: {
          saldo: saldo_anterior,
        },
        datos_nuevos: {
          saldo: saldo_nuevo,
          fecha_vencimiento: fecha_vencimiento_nueva,
          contador_renovaciones: contador_renovaciones,
          fecha_renovacion: new Date(),
        },
        parametros_accion: {
          metodo: 'renovar_fondo',
          endpoint: req?.originalUrl || '/api/fondos/:id/renovar',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['fondo', 'renovacion', 'flyback', 'reembolso'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando renovación de fondo:', error);
  }
};
export const registrarReembolsoBloqueado = async (reembolsoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, razon_bloqueo, razon_personalizada } = reembolsoData;
    
    const descripcion = `VoucherFlyback bloqueado - ${beneficiario_nombre} - Razón: ${razon_bloqueo}${razon_personalizada ? ` (${razon_personalizada})` : ''}`;
    
    await registrarActividad(
      'reembolso_bloqueado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Restante - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          estado: 'bloqueado',
          razon_bloqueo,
          razon_personalizada,
          fecha_bloqueo: new Date(),
        },
        parametros_accion: {
          metodo: 'bloquear_fondo',
          endpoint: req?.originalUrl || `/api/fondos/${fondo_id}/bloquear`,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['voucherflyback', 'fondo', 'bloqueado', 'reembolso', 'seguridad'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando bloqueo de fondo:', error);
  }
};


export const registrarReembolsoDesbloqueado = async (reembolsoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id } = reembolsoData;
    
    const descripcion = `VoucherFlyback desbloqueado - ${beneficiario_nombre}`;
    
    await registrarActividad(
      'reembolso_desbloqueado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Restante - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          estado: 'activo',
          fecha_desbloqueo: new Date(),
        },
        parametros_accion: {
          metodo: 'desbloquear_fondo',
          endpoint: req?.originalUrl || `/api/fondos/${fondo_id}/desbloquear`,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['voucherflyback', 'fondo', 'desbloqueado', 'reembolso'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando desbloqueo de fondo:', error);
  }
};

export const registrarBloqueoFondo = async (fondoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, razon_bloqueo, razon_personalizada, monto_reactivacion } = fondoData;
    
    const descripcion = `Fondo BLOQUEADO - ${beneficiario_nombre} - Razón: ${razon_bloqueo}${razon_personalizada ? ` (${razon_personalizada})` : ''} - Reactivación: $${monto_reactivacion}`;
    
    await registrarActividad(
      'reembolso_bloqueado',
      descripcion,
      {
        entidad_tipo: 'fondo',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Flyback - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        fondo_relacionado: {
          id: fondo_id,
          tipo_fondo: 'Flyback',
        },
        datos_nuevos: {
          bloqueado: true,
          razon_bloqueo: razon_bloqueo,
          razon_personalizada: razon_personalizada,
          monto_reactivacion: monto_reactivacion,
          fecha_bloqueo: new Date(),
        },
        parametros_accion: {
          metodo: 'bloquear_fondo',
          endpoint: req?.originalUrl || '/api/fondos/:id/bloquear',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['fondo', 'bloqueado', 'flyback', 'alerta'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando bloqueo de fondo:', error);
  }
};

export const registrarDesbloqueoFondo = async (fondoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, saldo_recuperado } = fondoData;
    
    const descripcion = `Fondo DESBLOQUEADO - ${beneficiario_nombre} - Saldo recuperado: $${saldo_recuperado}`;
    
    await registrarActividad(
      'reembolso_desbloqueado',
      descripcion,
      {
        entidad_tipo: 'fondo',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Flyback - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        fondo_relacionado: {
          id: fondo_id,
          tipo_fondo: 'Flyback',
        },
        datos_nuevos: {
          bloqueado: false,
          saldo_recuperado: saldo_recuperado,
          fecha_desbloqueo: new Date(),
        },
        parametros_accion: {
          metodo: 'desbloquear_fondo',
          endpoint: req?.originalUrl || '/api/fondos/:id/desbloquear',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['fondo', 'desbloqueado', 'flyback'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando desbloqueo de fondo:', error);
  }
};
export const registrarReembolsoRenovado = async (reembolsoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, fondo_id, fecha_nueva_vencimiento, renovacion_numero } = reembolsoData;
    
    const descripcion = `VoucherFlyback renovado para ${beneficiario_nombre} - Renovación #${renovacion_numero}`;
    
    await registrarActividad(
      'reembolso_renovado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: fondo_id,
        entidad_nombre: `Fondo Restante - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          fecha_nueva_vencimiento,
          renovacion_numero,
          estado: 'activo',
        },
        parametros_accion: {
          metodo: 'renovar_fondo',
          endpoint: req?.originalUrl || `/api/fondos/${fondo_id}/renovar`,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['voucherflyback', 'fondo', 'renovacion', 'reembolso'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando renovación de fondo:', error);
  }
};

export const registrarReembolsoAprobado = async (reembolsoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, solicitud_id, numero_solicitud, monto_solicitado, monto_aprobado, saldo_restante } = reembolsoData;
    
    const descripcion = `Reembolso APROBADO - ${beneficiario_nombre} - Solicitud: ${numero_solicitud} - Monto: $${monto_aprobado} - Saldo restante: $${saldo_restante}`;
    
    await registrarActividad(
      'reembolso_aprobado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: solicitud_id,
        entidad_nombre: `Solicitud ${numero_solicitud} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          numero_solicitud: numero_solicitud,
          monto_solicitado: monto_solicitado,
          monto_aprobado: monto_aprobado,
          saldo_restante: saldo_restante,
          estado: 'aprobado',
          fecha_aprobacion: new Date(),
        },
        parametros_accion: {
          metodo: 'aprobar_reembolso',
          endpoint: req?.originalUrl || '/api/solicitudes-reembolso/:id/aprobar',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['reembolso', 'aprobado', 'flyback', 'solicitud'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando reembolso aprobado:', error);
  }
};

export const registrarReembolsoRechazado = async (reembolsoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, solicitud_id, numero_solicitud, monto_solicitado, razon_rechazo } = reembolsoData;
    
    const descripcion = `Reembolso RECHAZADO - ${beneficiario_nombre} - Solicitud: ${numero_solicitud} - Razón: ${razon_rechazo}`;
    
    await registrarActividad(
      'reembolso_rechazado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: solicitud_id,
        entidad_nombre: `Solicitud ${numero_solicitud} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          numero_solicitud: numero_solicitud,
          monto_solicitado: monto_solicitado,
          estado: 'rechazado',
          razon_rechazo: razon_rechazo,
          fecha_rechazo: new Date(),
        },
        parametros_accion: {
          metodo: 'rechazar_reembolso',
          endpoint: req?.originalUrl || '/api/solicitudes-reembolso/:id/rechazar',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['reembolso', 'rechazado', 'flyback', 'solicitud'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando reembolso rechazado:', error);
  }
};

export const registrarSolicitudReembolsoBeneficiario = async (solicitudData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, solicitud_id, numero_solicitud, tipo_reembolso, monto_solicitado } = solicitudData;
    
    const descripcion = `Reembolso solicitado por ${beneficiario_nombre} - Tipo: ${tipo_reembolso} - Monto: $${monto_solicitado} - Solicitud: ${numero_solicitud}`;
    
    await registrarActividad(
      'reembolso_solicitado',
      descripcion,
      {
        entidad_tipo: 'reembolso',
        entidad_id: solicitud_id,
        entidad_nombre: `Solicitud ${numero_solicitud} - ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          numero_solicitud: numero_solicitud,
          tipo_reembolso: tipo_reembolso,
          monto_solicitado: monto_solicitado,
          estado: 'pendiente',
          fecha_solicitud: new Date(),
        },
        parametros_accion: {
          metodo: 'solicitar_reembolso_beneficiario',
          endpoint: req?.originalUrl || '/api/beneficiario/fondos/solicitar-reembolso',
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['reembolso', 'solicitud', 'beneficiario', 'flyback'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando solicitud de reembolso:', error);
  }
};

export const registrarComprobantePagoSubido = async (comprobanteData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, tipo_comprobante, archivo_nombre, archivo_url } = comprobanteData;
    
    const descripcion = `Comprobante de pago subido por ${beneficiario_nombre} - Tipo: ${tipo_comprobante} - Archivo: ${archivo_nombre}`;
    
    await registrarActividad(
      'comprobante_pago_subido',
      descripcion,
      {
        entidad_tipo: 'documento',
        entidad_nombre: `Comprobante - ${tipo_comprobante}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          tipo_comprobante: tipo_comprobante,
          archivo_nombre: archivo_nombre,
          archivo_url: archivo_url,
          fecha_subida: new Date(),
        },
        parametros_accion: {
          metodo: 'subir_comprobante_pago',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['comprobante', 'pago', 'documento', 'beneficiario'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando comprobante de pago subido:', error);
  }
};

export const registrarCodigoActivado = async (codigoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, monto_reembolso, prima_pagada, primera_activacion } = codigoData;
    
    const esPrimeraVez = primera_activacion === true;
    const descripcion = `Refund360 - Llave ${esPrimeraVez ? 'activada por primera vez' : 'reactivada'} para ${beneficiario_nombre} - Código: ${beneficiario_codigo}`;
    
    await registrarActividad(
      'codigo_activado',
      descripcion,
      {
        entidad_tipo: 'codigo',
        entidad_nombre: beneficiario_codigo,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          codigo: beneficiario_codigo,
          monto_reembolso: monto_reembolso,
          prima_pagada: prima_pagada,
          estado: 'ACTIVO',
          fecha_activacion: new Date(),
          primera_activacion: esPrimeraVez,
        },
        parametros_accion: {
          metodo: 'activar_codigo_unico',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['refund360', 'llave-unica', 'codigo', esPrimeraVez ? 'primera-activacion' : 'reactivacion'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando código activado:', error);
  }
};


export const registrarCodigoReactivado = async (codigoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, codigo_reactivado, motivo } = codigoData;
    
    const descripcion = `Refund360 - Llave reactivada para ${beneficiario_nombre} - Código: ${codigo_reactivado}`;
    
    await registrarActividad(
      'codigo_reactivado',
      descripcion,
      {
        entidad_tipo: 'codigo',
        entidad_nombre: codigo_reactivado,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          codigo: codigo_reactivado,
          motivo: motivo || 'Reactivación solicitada',
          estado: 'ACTIVO',
          fecha_reactivacion: new Date(),
        },
        parametros_accion: {
          metodo: 'reactivar_codigo',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['refund360', 'llave-unica', 'codigo', 'reactivado'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando código reactivado:', error);
  }
};


export const registrarCodigoGenerado = async (codigoData, req) => {
  try {
    const { beneficiario_nombre, beneficiario_id, beneficiario_codigo, codigo_generado, motivo, monto_reembolso } = codigoData;
    
    const descripcion = `Refund360 - Nueva llave generada para ${beneficiario_nombre} - Código: ${codigo_generado} - Motivo: ${motivo}`;
    
    await registrarActividad(
      'codigo_generado',
      descripcion,
      {
        entidad_tipo: 'codigo',
        entidad_nombre: codigo_generado,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          codigo: codigo_generado,
          motivo,
          monto_reembolso,
          estado: 'PENDIENTE',
          fecha_generacion: new Date(),
        },
        parametros_accion: {
          metodo: 'generar_codigo',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['refund360', 'llave-unica', 'codigo', 'generado'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando código generado:', error);
  }
};

export const registrarFinanciamientoCuotaMorosa = async (cuotaData, req) => {
  try {
    const { 
      beneficiario_nombre, 
      beneficiario_id, 
      beneficiario_codigo, 
      financiamiento_id,
      numero_cuota,
      monto,
      fecha_vencimiento,
      fecha_marcado_moroso
    } = cuotaData;
    
    const descripcion = `Cuota #${numero_cuota} marcada como MOROSA - ${beneficiario_nombre}`;
    
    await registrarActividad(
      'financiamiento_cuota_morosa',
      descripcion,
      {
        entidad_tipo: 'financiamiento',
        entidad_id: financiamiento_id,
        entidad_nombre: `Financiamiento ${beneficiario_nombre}`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          numero_cuota,
          estado: 'Moroso',
          monto,
          fecha_vencimiento,
          fecha_marcado_moroso: fecha_marcado_moroso || new Date(),
        },
        parametros_accion: {
          metodo: 'marcar_cuota_morosa',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['financiamiento', 'cuota', 'moroso', 'entrada-flex'],
      },
      req,
      'alto'
    );
  } catch (error) {
    console.error('Error registrando cuota morosa:', error);
  }
};
export const registrarComprobanteMultiple = async (comprobantesData, req) => {
  try {
    const { 
      beneficiario_nombre, 
      beneficiario_id, 
      beneficiario_codigo,
      cantidad_comprobantes,
      servicios_afectados,
      urls_comprobantes
    } = comprobantesData;
    
    const serviciosText = servicios_afectados?.join(', ') || 'varios servicios';
    const descripcion = `${cantidad_comprobantes} comprobantes de pago subidos por ${beneficiario_nombre} - Servicios: ${serviciosText}`;
    
    await registrarActividad(
      'comprobante_pago_subido',
      descripcion,
      {
        entidad_tipo: 'comprobante',
        entidad_nombre: `${cantidad_comprobantes} comprobantes`,
        beneficiario_relacionado: {
          id: beneficiario_id,
          nombre: beneficiario_nombre,
          codigo: beneficiario_codigo,
        },
        datos_nuevos: {
          cantidad_comprobantes,
          servicios_afectados,
          urls_comprobantes,
          fecha_subida: new Date(),
        },
        parametros_accion: {
          metodo: 'subir_comprobantes_multiples',
          endpoint: req?.originalUrl,
          timestamp: new Date().toISOString(),
        },
        etiquetas: ['comprobante', 'pago', 'documento', 'beneficiario', 'multiple'],
      },
      req,
      'medio'
    );
  } catch (error) {
    console.error('Error registrando comprobantes múltiples:', error);
  }
};
export default {
  registrarReembolsoRenovado,
  registrarReembolsoBloqueado,
  registrarReembolsoDesbloqueado,
  registrarCodigoReactivado,
  registrarFinanciamientoCuotaMorosa,
  registrarComprobanteMultiple
};