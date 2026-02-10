import { registrarActividad } from './Bitacora.js';
import { Aliado } from '../models/Aliado.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { Servicio } from '../models/Servicio.js';
import { Ticket } from '../models/Ticket.js';
import {Usuario} from '../models/Usuario.js';
import mongoose from 'mongoose';  
import { ContratoEquipo } from '../models/ContratoEquipo.js';

const convertirServiciosIdsANombres = async (serviciosIds) => {
  if (!Array.isArray(serviciosIds) || serviciosIds.length === 0) {
    return serviciosIds;
  }

  try {
    // âœ… Usar el modelo Servicio directamente (ya estÃ¡ importado en lÃ­nea 4)
    const serviciosNombres = await Promise.all(
      serviciosIds.map(async (servicioId) => {
        try {
          // Si ya es un nombre (no un ID de MongoDB), devolverlo tal cual
          if (typeof servicioId === 'string' && !/^[a-f0-9]{24}$/i.test(servicioId)) {
            return servicioId;
          }
          
          const servicio = await Servicio.findById(servicioId);
          return servicio ? servicio.nombre : servicioId;
        } catch (error) {
          console.error('[BITÃCORA] Error convirtiendo servicio ID:', servicioId, error);
          return servicioId;
        }
      })
    );
    
    console.log('[BITÃCORA] Servicios convertidos:', serviciosNombres);
    return serviciosNombres;
  } catch (error) {
    console.error('[BITÃCORA] Error en convertirServiciosIdsANombres:', error);
    return serviciosIds;
  }
};
const detectarTipoCambioAliado = (campos) => {
  const camposInformacion = ["correo", "telefono", "direccion"];
  const camposServicios = ["servicios"];
  const camposColaborador = ["colaborador_bnp"];
  
  const tieneInformacion = campos.some(campo => camposInformacion.includes(campo));
  const tieneServicios = campos.some(campo => camposServicios.includes(campo));
  const tieneColaborador = campos.some(campo => camposColaborador.includes(campo));
  
  if (tieneInformacion && !tieneServicios && !tieneColaborador) 
    return "informacion_actualizada";
  if (tieneServicios && !tieneInformacion && !tieneColaborador) 
    return "servicios_actualizados";
  if (tieneColaborador && !tieneInformacion && !tieneServicios) 
    return "colaborador_asignado";
    
  return "aliado_actualizado";
};


const MAPEO_RUTAS = {
  '/api/aliados': {
    POST: { tipo: 'aliado_creado', entidad: 'aliado' },
    PUT: { tipo: 'aliado_actualizado', entidad: 'aliado' },
    PATCH: { tipo: 'aliado_actualizado', entidad: 'aliado' },
    DELETE: { tipo: 'aliado_eliminado', entidad: 'aliado' },
  },
  '/api/equipo/aliados': {
    POST: { tipo: 'aliado_creado', entidad: 'aliado' },
    PUT: { tipo: 'aliado_actualizado', entidad: 'aliado' },
    PATCH: { tipo: 'aliado_actualizado', entidad: 'aliado' },
  },
  '/api/beneficiarios': {
    POST: { tipo: 'beneficiario_creado', entidad: 'beneficiario' },
    PUT: { tipo: 'beneficiario_actualizado', entidad: 'beneficiario' },
    PATCH: { tipo: 'beneficiario_actualizado', entidad: 'beneficiario' },
    DELETE: { tipo: 'beneficiario_eliminado', entidad: 'beneficiario' },
  },
  '/api/equipo/beneficiarios': {
    POST: { tipo: 'beneficiario_creado', entidad: 'beneficiario', origen: 'equipo' },
    PUT: { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', origen: 'equipo' },
    PATCH: { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', origen: 'equipo' },
  },
  '/api/aliado-beneficiarios/crear-beneficiario': {
    POST: { tipo: 'beneficiario_creado', entidad: 'beneficiario', origen: 'aliado' },
  },
  '/api/servicios/beneficiario': {
    POST: { tipo: 'servicio_activado', entidad: 'servicio', dinamico: true },
  },
  '/api/tickets': {
    POST: { tipo: 'ticket_creado', entidad: 'ticket', dinamico: true },
    DELETE: { tipo: 'ticket_eliminado', entidad: 'ticket' },
  },
  '/api/contratos/enviar': {
    POST: { tipo: 'contrato_enviado', entidad: 'contrato' },
  },
  '/api/contratos/firmar': {
    POST: { tipo: 'contrato_firmado', entidad: 'contrato' },
  },
  '/api/contratos/rechazar': {
    POST: { tipo: 'contrato_rechazado', entidad: 'contrato' },
  },
   '/api/contratoequipo/enviar': {
    POST: { tipo: 'contrato_equipo_enviado', entidad: 'contrato', origen: 'equipo' },
  },

  '/api/sucursales': {
    POST: { tipo: 'sucursal_creada', entidad: 'sucursal' },
    PUT: { tipo: 'sucursal_actualizada', entidad: 'sucursal' },
  },
  '/api/equipo/sucursales': {
    POST: { tipo: 'sucursal_creada', entidad: 'sucursal' },
    PUT: { tipo: 'sucursal_actualizada', entidad: 'sucursal' },
  },
  '/api/bienvenida/solicitar-ayuda': {
    POST: { tipo: 'solicitud_ayuda_bienvenida', entidad: 'beneficiario' },
  },
  '/api/bienvenida/solicitar-enlaces': {
    POST: { tipo: 'solicitud_enlace_pago_bienvenida', entidad: 'beneficiario' },
  },
  '/api/mensajes-pago': {
    POST: { tipo: 'enlace_pago_enviado', entidad: 'beneficiario' },
  },
  '/api/seguimiento/eliminar': {
    POST: { tipo: 'beneficiario_eliminado_seguimiento', entidad: 'beneficiario' },
  },
  '/api/seguimiento/contactar': {
    POST: { tipo: 'beneficiario_contactado_seguimiento', entidad: 'beneficiario' },
  },
  '/api/fondos/crear': {
  POST: { tipo: 'fondo_creado', entidad: 'reembolso' },
},
'/api/fondos/:id/renovar': {
    POST: { tipo: 'reembolso_renovado', entidad: 'reembolso' },
}, 
 '/api/fondos/:id/bloquear': {
    POST: { tipo: 'reembolso_bloqueado', entidad: 'reembolso' },
  },
  '/api/fondos/:id/desbloquear': {
    POST: { tipo: 'reembolso_desbloqueado', entidad: 'reembolso' },
  },
 '/api/beneficiarios/:id/codigo-reembolso/regenerar': {
    POST: { tipo: 'codigo_generado', entidad: 'codigo' },
  },
  '/api/beneficiarios/:id/codigo-reembolso/activar': {
    POST: { tipo: 'codigo_activado', entidad: 'codigo' },
  },
  '/api/beneficiarios/:id/codigo-reembolso/reactivar': {
    POST: { tipo: 'codigo_reactivado', entidad: 'codigo' },
  },
  '/api/reembolsos/beneficiarios/:id/regenerar': {
    POST: { tipo: 'codigo_generado', entidad: 'codigo' },
  },
    '/api/comprobantes-pago/multiple': {
    POST: { tipo: 'comprobante_pago_subido', entidad: 'comprobante' },
  },
  '/api/comprobantes-pago/beneficiario': {
    POST: { tipo: 'comprobante_pago_subido', entidad: 'comprobante' },
  },

};

const RUTAS_IGNORADAS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/bitacora',
  '/api/estadisticas',
  '/api/dashboard',
  '/api/perfil',
  '/api/servicios/por-tipo',
];

const obtenerConfiguracionRuta = (path, method) => {
  if (path.includes('/asignar-beneficio')) {
    return { tipo: 'servicio_asignado', entidad: 'servicio' };
  }
  
  if (path.includes('/activar-beneficio')) {
    return { tipo: 'servicio_activado', entidad: 'servicio' };
  }
  
  if (path.includes('/desactivar-beneficio')) {
    return { tipo: 'servicio_desactivado', entidad: 'servicio' };
  }
  
  if (path.includes('/reactivar-beneficio')) {
    return { tipo: 'servicio_reactivado', entidad: 'servicio' };
  }

  if (path.includes('/contratoequipo') && path.includes('/marcar-email-enviado') && method === 'PATCH') {
    return { tipo: 'contrato_equipo_enviado', entidad: 'contrato', origen: 'equipo' };
  }

  if (path.includes('/contratoequipo') && path.includes('/firmar') && path.includes('/confirmar')) {
    return { tipo: 'contrato_equipo_firmado', entidad: 'contrato', origen: 'equipo' };
  }

  if (path.includes('/contratoequipo') && path.includes('/firmar') && path.includes('/rechazar')) {
    return { tipo: 'contrato_equipo_rechazado', entidad: 'contrato', origen: 'equipo' };
  }

  if (path.includes('/tickets') && path.includes('/estado') && method === 'PATCH') {
    return { tipo: 'ticket_estado_actualizado', entidad: 'ticket' };
  }

  if (path.includes('/tickets') && path.includes('/satisfaccion') && method === 'POST') {
    return { tipo: 'ticket_calificado', entidad: 'ticket', dinamico: true };
  }

  if (path.includes('/equipo/perfil') && (method === 'PUT' || method === 'PATCH')) {
    if (path.includes('/estado-civil')) {
      return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'estado_civil', origen: 'equipo' };
    }
    return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'perfil', origen: 'equipo' };
  }
 if (path.includes('/fondos/') && path.includes('/renovar') && method === 'POST') {
             return { tipo: 'reembolso_renovado', entidad: 'reembolso' };
           }

           if (path.includes('/fondos/') && path.includes('/bloquear') && method === 'POST') {
             return { tipo: 'reembolso_bloqueado', entidad: 'reembolso' };
           }

           if (path.includes('/fondos/') && path.includes('/desbloquear') && method === 'POST') {
             return { tipo: 'reembolso_desbloqueado', entidad: 'reembolso' };
           }

           if (path.includes('/codigo-reembolso/regenerar') && method === 'POST') {
             return { tipo: 'codigo_generado', entidad: 'codigo' };
           }

           if (path.includes('/codigo-reembolso/activar') && method === 'POST') {
             return { tipo: 'codigo_activado', entidad: 'codigo' };
           }

           if (path.includes('/codigo-reembolso/reactivar') && method === 'POST') {
             return { tipo: 'codigo_reactivado', entidad: 'codigo' };
           }

           if (path.includes('/comprobantes-pago') && method === 'POST') {
             return { tipo: 'comprobante_pago_subido', entidad: 'comprobante' };
           }

           if (path.includes('/financiamientos') && path.includes('/cuota') && path.includes('/morosa') && method === 'POST') {
             return { tipo: 'financiamiento_cuota_morosa', entidad: 'financiamiento' };
           }

           if (path.includes('/financiamientos') && method === 'POST' && !path.includes('/cuota')) {
             return { tipo: 'financiamiento_creado', entidad: 'financiamiento' };
           }
  if (path.includes('/beneficiarios') && (method === 'PUT' || method === 'PATCH')) {
    if (path.includes('/administrativa')) {
      return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'administrativa' };
    }
    if (path.includes('/pareja')) {
      return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'pareja' };
    }
    if (path.includes('/perfil') && path.includes('/estado-civil')) {
      return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'estado_civil' };
    }
    if (path.match(/\/perfil\/[a-f0-9]{24}/) && 
    (method === "PUT" || method === "PATCH") && 
    !path.includes("/equipo/perfil") && 
    !path.includes("/beneficiarios")) {
  return { 
    tipo: "perfil_actualizado", 
    entidad: "perfil", 
    requiere_deteccion_tipo: true 
  };
}
    if (path.includes('/perfil')) {
      return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario', subtipo: 'perfil' };
    }
    return { tipo: 'beneficiario_actualizado', entidad: 'beneficiario' };
  }

  for (const [rutaBase, metodos] of Object.entries(MAPEO_RUTAS)) {
    if (path === rutaBase || path.startsWith(rutaBase)) {
      return metodos[method];
    }
  }
  return null;
};

const debeIgnorarRuta = (path) => {
  return RUTAS_IGNORADAS.some(ruta => path.startsWith(ruta));
};

const determinarTipoTicket = async (ticketData, req) => {
  try {
    let ticketId = ticketData._id || ticketData.ticketId || req.params?.id;
    let ticket;

    if (ticketId) {
      ticket = await Ticket.findById(ticketId)
        .populate('aliado_id', 'nombre email')
        .populate('beneficiario_id', 'nombre apellido email')
        .populate('equipo_creador_id', 'nombre_usuario');
    } else {
      ticket = {
        aliado_id: ticketData.aliado_id,
        beneficiario_id: ticketData.beneficiario_id,
        equipo_creador_id: ticketData.equipo_creador_id,
        prioridad: ticketData.prioridad,
        categoria: ticketData.categoria,
      };
    }

    if (!ticket) return 'ticket_equipo_creado';

    if (ticket.beneficiario_id) {
      return 'ticket_beneficiario';
    } else if (ticket.aliado_id) {
      return 'ticket_aliado';
    } else {
      return 'ticket_equipo';
    }
  } catch (error) {
    console.error('[BITÃCORA] Error al determinar tipo de ticket:', error);
    return 'ticket_equipo';
  }
};

const determinarTipoDinamico = async (config, data, req) => {
  if (config.tipo === 'ticket_creado') {
    const tipoTicket = await determinarTipoTicket(data, req);
    return `${tipoTicket}_creado`;
  }
  
  if (config.tipo === 'ticket_calificado') {
    const tipoTicket = await determinarTipoTicket(data, req);
    return `${tipoTicket}_calificado`;
  }
  
  return config.tipo;
};

const extraerNombreEntidad = async (entidadTipo, data, req) => {
  try {
    switch (entidadTipo) {
      case 'aliado':
      case 'perfil': 
        //  datos directos
        if (data.nombre) return data.nombre;
        if (data.razon_social) return data.razon_social;
        if (data.nombre_usuario) return data.nombre_usuario;
        
        // Buscar por ID 
        const aliadoId = data._id || data.id || data.aliado_id || req.params?.id;
        
        if (aliadoId) {
          const aliado = await Aliado.findById(aliadoId);
          return aliado?.nombre || aliado?.razon_social || 'Aliado sin nombre';
        }
        break;

      case 'beneficiario':
        if (data.nombre && data.apellido) {
          return `${data.nombre} ${data.apellido}`.trim();
        }
        if (data.nombre) return data.nombre;
        
        const beneficiarioId = data._id || data.id || data.beneficiario_id || req.params?.id;
        const usuarioId = data.usuarioId || data.usuario_id;
        
        if (beneficiarioId) {
          const beneficiario = await Beneficiario.findById(beneficiarioId);
          return beneficiario ? `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim() : 'Beneficiario';
        }
        
        if (usuarioId) {
          const usuario = await Usuario.findById(usuarioId);
          if (usuario) {
            const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioId });
            if (beneficiario) {
              return `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim();
            }
            return usuario.nombre_usuario || 'Beneficiario';
          }
        }
        break;

      case 'servicio':
        if (data.servicioNombre) return data.servicioNombre;
        if (data.nombre) return data.nombre;
        if (data.servicioId || data.servicio_id) {
          const servicio = await Servicio.findById(data.servicioId || data.servicio_id);
          return servicio?.nombre || 'Servicio';
        }
        break;

      case 'ticket':
        const ticketId = data._id || data.ticketId || data.id || req.params?.id;
        if (data.titulo) return `${data.titulo} (${data.categoria || 'General'})`;
        if (ticketId) {
          const ticket = await Ticket.findById(ticketId);
          return ticket ? `${ticket.titulo} (${ticket.categoria})` : 'Ticket';
        }
        break;

      case 'sucursal':
        if (data.nombre) return data.nombre;
        const sucursalId = data._id || data.id || data.sucursal_id || req.params?.id;
        if (sucursalId) {
          const Sucursal = mongoose.model('Sucursal');
          const sucursal = await Sucursal.findById(sucursalId);
          return sucursal?.nombre || 'Sucursal';
        }
        break;
        
   case 'contrato':
        // Intentar obtener aliado de data directamente
        let aliadoIdNombre = data.aliado_id || data.aliadoId;
        
        // Si no hay aliado_id directamente, buscar por token
        if (!aliadoIdNombre && req.params?.token) {
          try {
            console.log('[BITÁCORA] extraerNombreEntidad - Buscando contrato por token:', req.params.token);
            const contrato = await ContratoEquipo.findOne({ token_firma: req.params.token }).populate('aliado_id');
            if (contrato && contrato.aliado_id) {
              console.log('[BITÁCORA] ✅ Contrato encontrado, aliado:', contrato.aliado_id.nombre || contrato.aliado_id.razon_social);
              return contrato.aliado_id.nombre || contrato.aliado_id.razon_social || contrato.aliado_id.nombre_usuario || 'Aliado';
            }
            if (contrato) {
              aliadoIdNombre = contrato.aliado_id;
            }
          } catch (error) {
            console.error('[BITÁCORA] Error buscando contrato por token:', error);
          }
        }
        
        // Buscar aliado por ID si se obtuvo
        if (aliadoIdNombre) {
          const aliado = await Aliado.findById(aliadoIdNombre);
          if (aliado) {
            return aliado.nombre || aliado.razon_social || aliado.nombre_usuario || 'Aliado';
          }
        }
        
        // Si no hay ID pero hay contrato_id, buscar el contrato
        const contratoId = data._id || data.contrato_id || req.params?.id;
        if (contratoId) {
          const contrato = await ContratoEquipo.findById(contratoId).populate('aliado_id');
          if (contrato && contrato.aliado_id) {
            return contrato.aliado_id.nombre || contrato.aliado_id.razon_social || contrato.aliado_id.nombre_usuario || 'Aliado';
          }
        }
        
        return 'Aliado';
      default:
        return data.nombre || data.titulo || 'Entidad';
    }
  } catch (error) {
    console.error('[BITÃCORA] Error al extraer nombre de entidad:', error);
  }
  return 'Entidad sin nombre';
};

const extraerRelacionesTicket = async (ticketData, req) => {
  try {
    const ticketId = ticketData._id || ticketData.ticketId || req.params?.id;
    const ticket = ticketId 
      ? await Ticket.findById(ticketId)
          .populate('aliado_id', 'nombre_usuario correo')
          .populate('beneficiario_id', 'nombre_usuario correo')
          .populate('equipo_creador_id', 'nombre_usuario correo')
      : null;

    const relaciones = {
      aliado_relacionado: null,
      beneficiario_relacionado: null,
      ticket_info: {
        fecha_creacion: ticket?.fecha_creacion || ticketData.fecha_creacion || new Date(),
        prioridad: ticket?.prioridad || ticketData.prioridad || 'Media',
        categoria: ticket?.categoria || ticketData.categoria,
        estado: ticket?.estado || ticketData.estado,
      }
    };

    // âœ… BENEFICIARIO: Buscar documento completo
    if (ticket?.beneficiario_id) {
      const usuarioBeneficiario = ticket.beneficiario_id;
      const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioBeneficiario._id });
      
      if (beneficiario) {
        relaciones.beneficiario_relacionado = {
          id: beneficiario._id,
          nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
          correo: beneficiario.correo || usuarioBeneficiario.correo || '',
        };
      } else {
        relaciones.beneficiario_relacionado = {
          id: usuarioBeneficiario._id,
          nombre: usuarioBeneficiario.nombre_usuario || 'Beneficiario',
          correo: usuarioBeneficiario.correo || '',
        };
      }
    } else if (ticketData.beneficiario_id) {
      const beneficiarioId = typeof ticketData.beneficiario_id === 'object' 
        ? ticketData.beneficiario_id._id 
        : ticketData.beneficiario_id;
      const usuarioBeneficiario = await Usuario.findById(beneficiarioId);
      if (usuarioBeneficiario) {
        const beneficiario = await Beneficiario.findOne({ usuario_id: usuarioBeneficiario._id });
        if (beneficiario) {
          relaciones.beneficiario_relacionado = {
            id: beneficiario._id,
            nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
            correo: beneficiario.correo || usuarioBeneficiario.correo || '',
          };
        } else {
          relaciones.beneficiario_relacionado = {
            id: usuarioBeneficiario._id,
            nombre: usuarioBeneficiario.nombre_usuario || 'Beneficiario',
            correo: usuarioBeneficiario.correo || '',
          };
        }
      }
    }

    // âœ… ALIADO: Buscar documento completo
    if (ticket?.aliado_id) {
      const usuarioAliado = ticket.aliado_id;
      const aliado = await Aliado.findOne({ usuario_id: usuarioAliado._id });
      
      if (aliado) {
        relaciones.aliado_relacionado = {
          id: aliado._id,
          nombre: aliado.nombre,
          nombre_usuario: usuarioAliado.nombre_usuario,
          correo: aliado.correo || usuarioAliado.correo || '',
        };
      } else {
        relaciones.aliado_relacionado = {
          id: usuarioAliado._id,
          nombre: usuarioAliado.nombre_usuario || 'Aliado',
          nombre_usuario: usuarioAliado.nombre_usuario,
          correo: usuarioAliado.correo || '',
        };
      }
    } else if (ticketData.aliado_id) {
      const aliadoId = typeof ticketData.aliado_id === 'object' 
        ? ticketData.aliado_id._id 
        : ticketData.aliado_id;
      const usuarioAliado = await Usuario.findById(aliadoId);
      if (usuarioAliado) {
        const aliado = await Aliado.findOne({ usuario_id: usuarioAliado._id });
        if (aliado) {
          relaciones.aliado_relacionado = {
            id: aliado._id,
            nombre: aliado.nombre,
            nombre_usuario: usuarioAliado.nombre_usuario,
            correo: aliado.correo || usuarioAliado.correo || '',
          };
        } else {
          relaciones.aliado_relacionado = {
            id: usuarioAliado._id,
            nombre: usuarioAliado.nombre_usuario || 'Aliado',
            nombre_usuario: usuarioAliado.nombre_usuario,
            correo: usuarioAliado.correo || '',
          };
        }
      }
    }

    return relaciones;
  } catch (error) {
    console.error('[BITÃCORA] Error al extraer relaciones de ticket:', error);
    return {
      aliado_relacionado: null,
      beneficiario_relacionado: null,
      ticket_info: {}
    };
  }
};

const extraerRelaciones = async (entidadTipo, data, req, responseData = null) => {
  const relaciones = {
    aliado_relacionado: null,
    beneficiario_relacionado: null,
    servicio_relacionado: null,
    sucursal_relacionada: null,
    datos_ticket_completo: null,
  };

  try {
    if (entidadTipo === 'ticket') {
      const relacionesTicket = await extraerRelacionesTicket(data, req);
      
      let ticketId = responseData?._id || responseData?.id || data._id || data.ticketId || req.params?.id;
      
      if (!ticketId) {
        if (responseData?.resultado?._id) ticketId = responseData.resultado._id;
        if (responseData?.data?._id) ticketId = responseData.data._id;
      }
      
      console.log('[BITÃCORA DEBUG] ID de ticket encontrado:', ticketId);
      
      if (ticketId) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const ticketCompleto = await Ticket.findById(ticketId)
            .populate('aliado_id', 'nombre_usuario correo')
            .populate('beneficiario_id', 'nombre_usuario correo')
            .populate('equipo_creador_id', 'nombre_usuario correo')
            .lean();
          
          if (ticketCompleto) {
            console.log('[BITÃCORA DEBUG] âœ… Ticket completo encontrado:', {
              id: ticketCompleto._id,
              titulo: ticketCompleto.titulo,
              categoria: ticketCompleto.categoria,
              prioridad: ticketCompleto.prioridad,
              tiene_aliado: !!ticketCompleto.aliado_id,
              tiene_beneficiario: !!ticketCompleto.beneficiario_id,
              campos_totales: Object.keys(ticketCompleto).length
            });
            
            // âœ… ENRIQUECER: Buscar documentos completos de Aliado y Beneficiario
            let aliadoCompleto = null;
            let beneficiarioCompleto = null;
            
            if (ticketCompleto.aliado_id) {
              const aliado = await Aliado.findOne({ usuario_id: ticketCompleto.aliado_id._id });
              if (aliado) {
                aliadoCompleto = {
                  _id: aliado._id.toString(),
                  nombre: aliado.nombre,
                  nombre_usuario: ticketCompleto.aliado_id.nombre_usuario,
                  correo: aliado.correo || ticketCompleto.aliado_id.correo,
                };
              } else {
                aliadoCompleto = {
                  _id: ticketCompleto.aliado_id._id?.toString(),
                  nombre: ticketCompleto.aliado_id.nombre_usuario,
                  nombre_usuario: ticketCompleto.aliado_id.nombre_usuario,
                  correo: ticketCompleto.aliado_id.correo,
                };
              }
            }
            
            if (ticketCompleto.beneficiario_id) {
              const beneficiario = await Beneficiario.findOne({ usuario_id: ticketCompleto.beneficiario_id._id });
              if (beneficiario) {
                beneficiarioCompleto = {
                  _id: beneficiario._id.toString(),
                  nombre: beneficiario.nombre,
                  apellido: beneficiario.apellido,
                  nombre_completo: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
                  correo: beneficiario.correo || ticketCompleto.beneficiario_id.correo,
                };
              } else {
                beneficiarioCompleto = {
                  _id: ticketCompleto.beneficiario_id._id?.toString(),
                  nombre: ticketCompleto.beneficiario_id.nombre_usuario,
                  apellido: '',
                  nombre_completo: ticketCompleto.beneficiario_id.nombre_usuario,
                  correo: ticketCompleto.beneficiario_id.correo,
                };
              }
            }
            
            relacionesTicket.datos_ticket_completo = {
              ...ticketCompleto,
              _id: ticketCompleto._id.toString(),
              aliado_id: aliadoCompleto,
              beneficiario_id: beneficiarioCompleto,
              equipo_creador_id: ticketCompleto.equipo_creador_id ? {
                _id: ticketCompleto.equipo_creador_id._id?.toString(),
                nombre_usuario: ticketCompleto.equipo_creador_id.nombre_usuario,
                correo: ticketCompleto.equipo_creador_id.correo,
              } : null
            };
          } else {
            console.log('[BITÃCORA] âš ï¸ Ticket no encontrado con ID:', ticketId);
          }
        } catch (error) {
          console.error('[BITÃCORA] âŒ Error buscando ticket:', error.message);
        }
      } else {
        console.log('[BITÃCORA DEBUG] âš ï¸ No se encontrÃ³ ID de ticket');
      }
      
      return relacionesTicket;
    }

    if (data.aliado_id || data.aliadoId) {
      const aliadoId = data.aliado_id || data.aliadoId;
      const aliado = await Aliado.findById(aliadoId);
      if (aliado) {
        relaciones.aliado_relacionado = {
          id: aliado._id.toString(),
          nombre: aliado.nombre,
        };
      }
    }

    if (data.beneficiario_id || data.beneficiarioId) {
      const beneficiarioId = data.beneficiario_id || data.beneficiarioId;
      const beneficiario = await Beneficiario.findById(beneficiarioId);
      if (beneficiario) {
        relaciones.beneficiario_relacionado = {
          id: beneficiario._id.toString(),
          nombre: `${beneficiario.nombre} ${beneficiario.apellido || ''}`.trim(),
          codigo: beneficiario.codigo,
        };
      }
    }
    if (entidadTipo === 'contrato') {
      let aliadoId = data.aliado_id || data.aliadoId || req.body?.aliado_id;
      
      // Si no hay aliado_id directamente, buscar por token (firmar/rechazar)
      if (!aliadoId && req.params?.token) {
        try {
          console.log('[BITÁCORA] extraerRelaciones - Buscando contrato por token:', req.params.token);
          const contrato = await ContratoEquipo.findOne({ token_firma: req.params.token });
          if (contrato) {
            aliadoId = contrato.aliado_id;
            console.log('[BITÁCORA] ✅ Aliado encontrado del contrato:', aliadoId);
          } else {
            console.log('[BITÁCORA] ⚠️ No se encontró contrato con token:', req.params.token);
          }
        } catch (error) {
          console.error('[BITÁCORA] Error buscando contrato por token:', error);
        }
      }
      
      if (aliadoId) {
        const aliado = await Aliado.findById(aliadoId);
        if (aliado) {
          const usuario = await Usuario.findById(aliado.usuario_id);
          relaciones.aliado_relacionado = {
            id: aliado._id.toString(),
            nombre: aliado.nombre || aliado.razon_social,
            nombre_usuario: usuario?.nombre_usuario || aliado.nombre_usuario || aliado.nombre,
          };
          console.log('[BITÁCORA] ✅ Aliado relacionado extraído:', relaciones.aliado_relacionado.nombre);
        } else {
          console.log('[BITÁCORA] No se encontró aliado con ID:', aliadoId);
        }
      } else {
        console.log('[BITÁCORA] No se pudo obtener aliado_id para el contrato');
      }
    }
    if (data.servicioId || data.servicio_id) {
      const servicioId = data.servicioId || data.servicio_id;
      const servicio = await Servicio.findById(servicioId);
      if (servicio) {
        relaciones.servicio_relacionado = {
          id: servicio._id.toString(),
          nombre: servicio.nombre,
        };
      }
    }
  } catch (error) {
    console.error('[BITÃCORA] Error al extraer relaciones:', error);
  }

  return relaciones;
};

const generarDescripcion = (tipo, nombreEntidad, relaciones, config = {}) => {
  const descripciones = {
    aliado_creado: `Nuevo aliado registrado: ${nombreEntidad}`,
    aliado_actualizado: `Aliado actualizado: ${nombreEntidad}`,
    aliado_eliminado: `Aliado eliminado: ${nombreEntidad}`,
    beneficiario_creado: (() => {
      const origen = config?.origen === 'equipo' ? 'Equipo BNP - ' : config?.origen === 'aliado' ? 'Aliado - ' : '';
      return `${origen}Nuevo beneficiario registrado: ${nombreEntidad}`;
    })(),
    beneficiario_actualizado: (() => {
      const subtipo = config?.subtipo;
      const origen = config?.origen === 'equipo' ? 'Equipo BNP - ' : '';
      if (subtipo === 'administrativa') return `${origen}Info administrativa actualizada: ${nombreEntidad}`;
      if (subtipo === 'pareja') return `${origen}Info de pareja actualizada: ${nombreEntidad}`;
      if (subtipo === 'estado_civil') return `${origen}Estado civil actualizado: ${nombreEntidad}`;
      if (subtipo === 'perfil') return `${origen}Perfil actualizado: ${nombreEntidad}`;
      return `${origen}Beneficiario actualizado: ${nombreEntidad}`;
    })(),
    beneficiario_eliminado: `Beneficiario eliminado: ${nombreEntidad}`,
    contrato_enviado: `Contrato enviado: ${nombreEntidad}`,
    contrato_firmado: `Contrato firmado: ${nombreEntidad}`,
    contrato_rechazado: `Contrato rechazado: ${nombreEntidad}`,
     contrato_equipo_enviado: `Contrato de equipo enviado${relaciones.aliado_relacionado ? ` a ${relaciones.aliado_relacionado.nombre}` : ''}: ${nombreEntidad}`,
    contrato_equipo_firmado: `Contrato de equipo firmado${relaciones.aliado_relacionado ? ` por ${relaciones.aliado_relacionado.nombre}` : ''}: ${nombreEntidad}`,
    contrato_equipo_rechazado: `Contrato de equipo rechazado${relaciones.aliado_relacionado ? ` por ${relaciones.aliado_relacionado.nombre}` : ''}: ${nombreEntidad}`,
    ticket_beneficiario_creado: (() => {
      const info = relaciones.beneficiario_relacionado 
        ? ` de ${relaciones.beneficiario_relacionado.nombre}` 
        : '';
      return `Ticket de beneficiario creado${info}: ${nombreEntidad}`;
    })(),
    ticket_aliado_creado: (() => {
      const info = relaciones.aliado_relacionado 
        ? ` de ${relaciones.aliado_relacionado.nombre}` 
        : '';
      return `Ticket de aliado creado${info}: ${nombreEntidad}`;
    })(),
    ticket_equipo_creado: `Ticket creado por equipo: ${nombreEntidad}`,
    ticket_estado_actualizado: (() => {
      const estadoAnterior = config?.estado_anterior || 'Desconocido';
      const estadoNuevo = config?.estado_nuevo || 'Actualizado';
      return `Estado de ticket cambiado: ${nombreEntidad} (${estadoAnterior} â†’ ${estadoNuevo})`;
    })(),
    ticket_beneficiario_calificado: (() => {
      const calificacion = config?.calificacion ? ` - ${config.calificacion}â˜…` : '';
      const info = relaciones.beneficiario_relacionado 
        ? ` por ${relaciones.beneficiario_relacionado.nombre}` 
        : '';
      return `Ticket de beneficiario calificado${info}${calificacion}: ${nombreEntidad}`;
    })(),
    ticket_aliado_calificado: (() => {
      const calificacion = config?.calificacion ? ` - ${config.calificacion}â˜…` : '';
      const info = relaciones.aliado_relacionado 
        ? ` por ${relaciones.aliado_relacionado.nombre}` 
        : '';
      return `Ticket de aliado calificado${info}${calificacion}: ${nombreEntidad}`;
    })(),
    ticket_eliminado: `Ticket eliminado: ${nombreEntidad}`,
    sucursal_creada: `Nueva sucursal creada: ${nombreEntidad}`,
    sucursal_actualizada: `Sucursal actualizada: ${nombreEntidad}`,
    servicio_asignado: `Servicio asignado: ${nombreEntidad}${relaciones.beneficiario_relacionado ? ` a ${relaciones.beneficiario_relacionado.nombre}` : ''}`,
    servicio_activado: `Servicio activado: ${nombreEntidad}${relaciones.beneficiario_relacionado ? ` para ${relaciones.beneficiario_relacionado.nombre}` : ''}`,
    servicio_desactivado: `Servicio desactivado: ${nombreEntidad}${relaciones.beneficiario_relacionado ? ` de ${relaciones.beneficiario_relacionado.nombre}` : ''}`,
    servicio_reactivado: `Servicio reactivado: ${nombreEntidad}${relaciones.beneficiario_relacionado ? ` para ${relaciones.beneficiario_relacionado.nombre}` : ''}`,
    solicitud_ayuda_bienvenida: `Solicitud de ayuda desde bienvenida: ${nombreEntidad}`,
    solicitud_enlace_pago_bienvenida: `Solicitud de enlace de pago: ${nombreEntidad}`,
    enlace_pago_enviado: `Enlace de pago enviado a: ${nombreEntidad}`,
    beneficiario_eliminado_seguimiento: `Beneficiario eliminado del seguimiento: ${nombreEntidad}`,
    beneficiario_contactado_seguimiento: `Beneficiario contactado en seguimiento: ${nombreEntidad}`,
  };

  return descripciones[tipo] || `Actividad ${tipo}: ${nombreEntidad}`;
};

const determinarNivelCriticidad = (tipo, datosNuevos) => {
  const prioridad = datosNuevos?.prioridad || 'Media';
  
  if (tipo.includes('ticket') && tipo.includes('creado')) {
    if (prioridad === 'CrÃ­tica' || prioridad === 'Alta') {
      return 'alto';
    }
    return 'medio';
  }

  const mapasCriticidad = {
    error_sistema: 'critico',
    aliado_eliminado: 'alto',
    beneficiario_eliminado: 'alto',
    codigo_activado: 'alto',
    configuracion_cambiada: 'alto',
    contrato_rechazado: 'alto',
    contrato_equipo_rechazado: 'alto',
    solicitud_ayuda_bienvenida: 'alto',
    solicitud_enlace_pago_bienvenida: 'medio',
    ticket_estado_actualizado: 'bajo',
    ticket_beneficiario_calificado: 'bajo',
    ticket_aliado_calificado: 'bajo',
    aliado_creado: 'medio',
    beneficiario_creado: 'medio',
    codigo_generado: 'medio',
    contrato_enviado: 'medio',
    contrato_firmado: 'medio',
    contrato_equipo_enviado: 'medio',
    contrato_equipo_firmado: 'medio',
    servicio_activado: 'medio',
    servicio_desactivado: 'medio',
    servicio_asignado: 'bajo',
    servicio_removido: 'bajo',
    login_usuario: 'bajo',
    logout_usuario: 'bajo',
  };

  return mapasCriticidad[tipo] || 'bajo';
};


export const bitacoraCentralMiddleware = (req, res, next) => {
  const rutaCompleta = req.originalUrl.split('?')[0];
  
  if (debeIgnorarRuta(rutaCompleta)) {
    return next();
  }

  const originalSend = res.send;

  res.send = function (data) {
    const shouldLog = res.statusCode >= 200 && res.statusCode < 300;
    
    if (shouldLog) {
      const config = obtenerConfiguracionRuta(rutaCompleta, req.method);
      
      if (config) {
        setImmediate(async () => {
          try {
            const responseData = typeof data === 'string' ? JSON.parse(data) : data;
            
            let combinedData = {
              ...req.body,
              ...(responseData.data || {}),
              ...(responseData.resultado || {}),
              ...(responseData.beneficio || {}),
            };

            if (responseData && typeof responseData === 'object' && !responseData.data && !responseData.resultado) {
              combinedData = { ...req.body, ...responseData };
            }

            if (responseData.beneficio && typeof responseData.beneficio === 'object') {
              combinedData.servicioId = combinedData.servicioId || responseData.beneficio.servicioId;
              combinedData.servicioNombre = combinedData.servicioNombre || responseData.beneficio.servicioNombre;
              combinedData._id = combinedData._id || responseData.beneficio._id;
            }

            if (config.tipo === 'ticket_estado_actualizado') {
              if (req.body.estado) combinedData.estado_nuevo = req.body.estado;
              if (responseData.estado) combinedData.estado_anterior = responseData.estado;
              if (req.body.mensaje) combinedData.mensaje_seguimiento = req.body.mensaje;
            }

            if (config.tipo === 'ticket_calificado') {
              if (req.body.calificacion) combinedData.calificacion = req.body.calificacion;
              if (req.body.comentario) combinedData.comentario = req.body.comentario;
            }

            if (config.entidad === 'ticket') {
              if (req.params?.id) combinedData.ticketId = req.params.id;
              if (responseData._id) combinedData._id = responseData._id;
              if (responseData.resultado?._id) combinedData._id = responseData.resultado._id;
              if (responseData.data?._id) combinedData._id = responseData.data._id;
            }

            const tipo = config.dinamico 
              ? await determinarTipoDinamico(config, combinedData, req)
              : config.tipo;
if (config.requiere_deteccion_tipo && responseData.tipo === "aliado") {
  const camposActualizados = Object.keys(req.body);
  config.tipo = detectarTipoCambioAliado(camposActualizados);
  config.entidad = "aliado";
  console.log("[BITÃCORA DEBUG] Detectado cambio en aliado:", config.tipo);
}
            const nombreEntidad = await extraerNombreEntidad(
              config.entidad, 
              combinedData, 
              req
            );

            if (config.tipo === 'enlace_pago_enviado') {
              combinedData.destinatario = {
                nombre_usuario: req.body.nombre_usuario || req.body.nombre || nombreEntidad,
                correo: req.body.correo || req.body.email || 'Sin correo',
                asunto: req.body.asunto || 'Enlace de pago enviado'
              };
            }

            const relaciones = await extraerRelaciones(
              config.entidad,
              combinedData,
              req,
              responseData
            );

            // ðŸ”¥ CAMBIO CRÃTICO: Usar los datos completos si existen, sino usar combinedData
            let datosParaGuardar;
            if (relaciones.datos_ticket_completo) {
              datosParaGuardar = relaciones.datos_ticket_completo;
              console.log('[BITÃCORA DEBUG] âœ… Usando datos completos del ticket');
            } else {
              datosParaGuardar = combinedData;
              console.log('[BITÃCORA DEBUG] âš ï¸ Usando datos combinados (no se encontrÃ³ ticket completo)');
            }

            if (config.entidad === 'ticket') {
              console.log('[BITÃCORA DEBUG] Datos finales del ticket:', {
                titulo: datosParaGuardar.titulo,
                prioridad: datosParaGuardar.prioridad,
                categoria: datosParaGuardar.categoria,
                tiene_aliado: !!datosParaGuardar.aliado_id,
                tiene_beneficiario: !!datosParaGuardar.beneficiario_id,
                _id: datosParaGuardar._id,
                campos_totales: Object.keys(datosParaGuardar).length
              });
            }

            const descripcion = generarDescripcion(tipo, nombreEntidad, relaciones, {
              ...config,
              estado_anterior: combinedData.estado_anterior,
              estado_nuevo: combinedData.estado_nuevo,
              calificacion: combinedData.calificacion,
              comentario: combinedData.comentario,
            });

            const nivelCriticidad = determinarNivelCriticidad(tipo, datosParaGuardar);

            console.log(`[BITÃCORA DEBUG] Tipo: ${tipo}, Prioridad: ${datosParaGuardar.prioridad}, Criticidad: ${nivelCriticidad}`);

            //  NO sanitizar los datos si ya estan en formato plano
            // El .lean() en la consulta ya nos da un objeto plano
           let datosSanitizados = datosParaGuardar;
if (datosSanitizados.servicios && Array.isArray(datosSanitizados.servicios)) {
  console.log('[BITÃCORA] Convirtiendo servicios de IDs a nombres...');
  const serviciosConNombres = await convertirServiciosIdsANombres(datosSanitizados.servicios);
  datosSanitizados = {
    ...datosSanitizados,
    servicios: serviciosConNombres
  };
}
            await registrarActividad(
              tipo,
              descripcion,
              {
                entidad_tipo: config.entidad,
                entidad_id: combinedData._id || combinedData.id || combinedData.beneficiarioId,
                entidad_nombre: nombreEntidad,
                aliado_relacionado: relaciones.aliado_relacionado,
                beneficiario_relacionado: relaciones.beneficiario_relacionado,
                servicio_relacionado: relaciones.servicio_relacionado,
                sucursal_relacionada: relaciones.sucursal_relacionada,
                ticket_info: relaciones.ticket_info,
                
                // ðŸ”¥ AQUÃ es donde van los datos completos
                datos_nuevos: datosSanitizados,
                
                parametros_accion: {
                  metodo: req.method,
                  endpoint: req.originalUrl,
                  timestamp: new Date().toISOString(),
                  origen: config.origen,
                  subtipo: config.subtipo,
                },
                etiquetas: [config.entidad, tipo.split('_')[1], config.origen, config.subtipo].filter(Boolean),
              },
              req,
              nivelCriticidad
            );

            console.log(`[BITÃCORA] âœ… ${tipo} - ${descripcion} - Criticidad: ${nivelCriticidad}`);
          } catch (error) {
            console.error('[BITÃCORA] âŒ Error:', error);
          }
        });
      }
    }

    originalSend.call(this, data);
  };

  next();
};
export const configurarBitacoraCentral = (app) => {
  app.use(bitacoraCentralMiddleware);
  console.log('âœ… Middleware de BitÃ¡cora Central configurado');
};

export default bitacoraCentralMiddleware;