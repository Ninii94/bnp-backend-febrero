import mongoose from 'mongoose';

export class ServiciosSincronizacionController {
  
  static MAPEO_SERVICIOS = {
    'Refund360': {
      rutas_relacionadas: ['codigo_unico'],
      servicio_tipo: 'reembolso'
    },
    'Reembolso de costos': {
      rutas_relacionadas: ['codigo_unico'],
      servicio_tipo: 'reembolso'
    },
    'Voucher Fly Back': {
      rutas_relacionadas: ['fondo'],
      servicio_tipo: 'voucher'
    },
    'Vouchers Flyback': {
      rutas_relacionadas: ['fondo'],
      servicio_tipo: 'voucher'
    },
    'Certificado de boletos aéreos': {
      rutas_relacionadas: ['fondo'],
      servicio_tipo: 'voucher'
    },
    'Entrada Flex': {
      rutas_relacionadas: ['financiamiento'],
      servicio_tipo: 'financiamiento'
    },
    'Financiamiento de seña': {
      rutas_relacionadas: ['financiamiento'],
      servicio_tipo: 'financiamiento'
    },
    'Financiamiento de Seña': {
      rutas_relacionadas: ['financiamiento'],
      servicio_tipo: 'financiamiento'
    }
  };

  static async activarServicioCompleto(beneficiarioId, servicioNombre, datosActivacion = {}, usuarioId) {
    console.log(`[SYNC] === ACTIVACIÓN COMPLETA INICIADA ===`);
    console.log(`[SYNC] Beneficiario: ${beneficiarioId}`);
    console.log(`[SYNC] Servicio: ${servicioNombre}`);
    console.log(`[SYNC] Usuario: ${usuarioId}`);
    console.log(`[SYNC] Datos de activación:`, datosActivacion);

    const resultados = {
      servicio_principal: false,
      rutas_activadas: [],
      errores: []
    };

    try {
      const { Beneficiario } = await import('../models/Beneficiario.js');
      const { Fondo } = await import('../models/Fondo.js');
      const Financiamiento = (await import('../models/Financiamiento.js')).default;

      const beneficiario = await Beneficiario.findById(beneficiarioId);
      if (!beneficiario) {
        throw new Error(`Beneficiario no encontrado: ${beneficiarioId}`);
      }

      console.log(`[SYNC] Beneficiario encontrado: ${beneficiario.nombre} ${beneficiario.apellido}`);

      const configuracionServicio = this.MAPEO_SERVICIOS[servicioNombre];
      if (!configuracionServicio) {
        console.log(`[SYNC] ⚠️ Servicio no configurado para sincronización: ${servicioNombre}`);
        return { 
          servicio_principal: true, 
          rutas_activadas: [], 
          errores: [`Servicio ${servicioNombre} no configurado para sincronización`] 
        };
      }

      console.log(`[SYNC] Configuración encontrada:`, configuracionServicio);

      for (const ruta of configuracionServicio.rutas_relacionadas) {
        try {
          console.log(`[SYNC] Activando en ruta: ${ruta}`);
          
          switch (ruta) {
            case 'codigo_unico':
              await this.activarCodigoUnico(beneficiario, servicioNombre, datosActivacion, usuarioId);
              resultados.rutas_activadas.push('codigo_unico');
              break;
              
            case 'fondo':
              await this.activarFondo(beneficiario, servicioNombre, datosActivacion, usuarioId, Fondo);
              resultados.rutas_activadas.push('fondo');
              break;

            case 'financiamiento':
              await this.activarFinanciamiento(beneficiario, servicioNombre, datosActivacion, usuarioId, Financiamiento);
              resultados.rutas_activadas.push('financiamiento');
              break;
              
            default:
              console.log(`[SYNC] ⚠️ Ruta no implementada: ${ruta}`);
          }
        } catch (error) {
          console.error(`[SYNC] ❌ Error activando ruta ${ruta}:`, error);
          resultados.errores.push(`Error en ${ruta}: ${error.message}`);
        }
      }

      resultados.servicio_principal = true;
      console.log(`[SYNC] ✅ Activación completa finalizada`);
      console.log(`[SYNC] Rutas activadas: ${resultados.rutas_activadas.join(', ')}`);

    } catch (error) {
      console.error(`[SYNC] ❌ Error en activación completa:`, error);
      resultados.errores.push(`Error principal: ${error.message}`);
    }

    return resultados;
  }

  static async desactivarServicioCompleto(beneficiarioId, servicioNombre, datosDesactivacion = {}, usuarioId) {
    console.log(`[SYNC] === DESACTIVACIÓN COMPLETA INICIADA ===`);
    console.log(`[SYNC] Beneficiario: ${beneficiarioId}`);
    console.log(`[SYNC] Servicio: ${servicioNombre}`);
    console.log(`[SYNC] Usuario: ${usuarioId}`);

    const resultados = {
      servicio_principal: false,
      rutas_desactivadas: [],
      errores: []
    };

    try {
      const { Beneficiario } = await import('../models/Beneficiario.js');
      const { Fondo } = await import('../models/Fondo.js');
      const Financiamiento = (await import('../models/Financiamiento.js')).default;

      const beneficiario = await Beneficiario.findById(beneficiarioId);
      if (!beneficiario) {
        throw new Error(`Beneficiario no encontrado: ${beneficiarioId}`);
      }

      const configuracionServicio = this.MAPEO_SERVICIOS[servicioNombre];
      if (!configuracionServicio) {
        return { 
          servicio_principal: true, 
          rutas_desactivadas: [], 
          errores: [`Servicio ${servicioNombre} no configurado para sincronización`] 
        };
      }

      for (const ruta of configuracionServicio.rutas_relacionadas) {
        try {
          console.log(`[SYNC] Desactivando en ruta: ${ruta}`);
          
          switch (ruta) {
            case 'codigo_unico':
              await this.desactivarCodigoUnico(beneficiario, servicioNombre, datosDesactivacion, usuarioId);
              resultados.rutas_desactivadas.push('codigo_unico');
              break;
              
            case 'fondo':
              await this.desactivarFondo(beneficiario, servicioNombre, datosDesactivacion, usuarioId, Fondo);
              resultados.rutas_desactivadas.push('fondo');
              break;

            case 'financiamiento':
              await this.desactivarFinanciamiento(beneficiario, servicioNombre, datosDesactivacion, usuarioId, Financiamiento);
              resultados.rutas_desactivadas.push('financiamiento');
              break;
              
            default:
              console.log(`[SYNC] ⚠️ Ruta no implementada: ${ruta}`);
          }
        } catch (error) {
          console.error(`[SYNC] ❌ Error desactivando ruta ${ruta}:`, error);
          resultados.errores.push(`Error en ${ruta}: ${error.message}`);
        }
      }

      resultados.servicio_principal = true;
      console.log(`[SYNC] ✅ Desactivación completa finalizada`);

    } catch (error) {
      console.error(`[SYNC] ❌ Error en desactivación completa:`, error);
      resultados.errores.push(`Error principal: ${error.message}`);
    }

    return resultados;
  }

  static async reactivarServicioCompleto(beneficiarioId, servicioNombre, usuarioId) {
    console.log(`[SYNC] === REACTIVACIÓN COMPLETA INICIADA ===`);
    
    const resultados = {
      servicio_principal: false,
      rutas_reactivadas: [],
      errores: []
    };

    try {
      const { Beneficiario } = await import('../models/Beneficiario.js');
      const { Fondo } = await import('../models/Fondo.js');
      const Financiamiento = (await import('../models/Financiamiento.js')).default;

      const beneficiario = await Beneficiario.findById(beneficiarioId);
      if (!beneficiario) {
        throw new Error(`Beneficiario no encontrado: ${beneficiarioId}`);
      }

      const configuracionServicio = this.MAPEO_SERVICIOS[servicioNombre];
      if (!configuracionServicio) {
        return { 
          servicio_principal: true, 
          rutas_reactivadas: [], 
          errores: [`Servicio ${servicioNombre} no configurado para sincronización`] 
        };
      }

      for (const ruta of configuracionServicio.rutas_relacionadas) {
        try {
          console.log(`[SYNC] Reactivando en ruta: ${ruta}`);
          
          switch (ruta) {
            case 'codigo_unico':
              await this.reactivarCodigoUnico(beneficiario, servicioNombre, usuarioId);
              resultados.rutas_reactivadas.push('codigo_unico');
              break;
              
            case 'fondo':
              await this.reactivarFondo(beneficiario, servicioNombre, usuarioId, Fondo);
              resultados.rutas_reactivadas.push('fondo');
              break;

            case 'financiamiento':
              await this.reactivarFinanciamiento(beneficiario, servicioNombre, usuarioId, Financiamiento);
              resultados.rutas_reactivadas.push('financiamiento');
              break;
              
            default:
              console.log(`[SYNC] ⚠️ Ruta no implementada: ${ruta}`);
          }
        } catch (error) {
          console.error(`[SYNC] ❌ Error reactivando ruta ${ruta}:`, error);
          resultados.errores.push(`Error en ${ruta}: ${error.message}`);
        }
      }

      resultados.servicio_principal = true;
      console.log(`[SYNC] ✅ Reactivación completa finalizada`);

    } catch (error) {
      console.error(`[SYNC] ❌ Error en reactivación completa:`, error);
      resultados.errores.push(`Error principal: ${error.message}`);
    }

    return resultados;
  }

  static async activarCodigoUnico(beneficiario, servicioNombre, datosActivacion, usuarioId) {
    console.log(`[CÓDIGO] 🎯 Activando código único para servicio: ${servicioNombre}`);

    try {
      if (!beneficiario.codigo) {
        beneficiario.codigo = {
          value: beneficiario.llave_unica,
          fecha_creacion: new Date(),
          activo: false,
          estado_activacion: 'PENDIENTE',
          monto: { valor: 0, moneda: 'USD' },
          primaPagada: 0,
          historial: []
        };
      }

      let montoParaCodigo = 0;
      let primaCalculada = 0;

      if (datosActivacion.monto_a_reembolsar && datosActivacion.monto_a_reembolsar > 0) {
        montoParaCodigo = parseFloat(datosActivacion.monto_a_reembolsar);
        primaCalculada = montoParaCodigo * 0.0575;
      }

      beneficiario.codigo.activo = true;
      beneficiario.codigo.estado_activacion = 'ACTIVO';
      beneficiario.codigo.fecha_activacion = new Date();
      
      if (!beneficiario.codigo.monto) {
        beneficiario.codigo.monto = {};
      }
      beneficiario.codigo.monto.valor = montoParaCodigo;
      beneficiario.codigo.monto.moneda = 'USD';
      beneficiario.codigo.primaPagada = primaCalculada;

      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }

      beneficiario.codigo.historial.push({
        motivo: 'ACTIVACION',
        fecha_cambio: new Date(),
        detalles: `Código activado automáticamente por sincronización. Servicio: ${servicioNombre}`,
        codigo_anterior: null
      });

      await beneficiario.save();

      console.log(`[CÓDIGO] ✅ Código activado exitosamente`);

    } catch (error) {
      console.error(`[CÓDIGO] ❌ Error activando código:`, error);
      throw error;
    }
  }

  static async desactivarCodigoUnico(beneficiario, servicioNombre, datosDesactivacion, usuarioId) {
    console.log(`[CÓDIGO] 🔒 Desactivando código único`);

    try {
      if (!beneficiario.codigo || !beneficiario.codigo.activo) {
        console.log(`[CÓDIGO] ⚠️ Código ya inactivo o no existe`);
        return;
      }

      beneficiario.codigo.activo = false;
      beneficiario.codigo.estado_activacion = 'SUSPENDIDO';

      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }

      beneficiario.codigo.historial.push({
        motivo: 'CANCELACION',
        fecha_cambio: new Date(),
        detalles: `Código desactivado por sincronización. Servicio: ${servicioNombre}`,
        codigo_anterior: null
      });

      await beneficiario.save();
      console.log(`[CÓDIGO] ✅ Código desactivado`);

    } catch (error) {
      console.error(`[CÓDIGO] ❌ Error:`, error);
      throw error;
    }
  }

  static async reactivarCodigoUnico(beneficiario, servicioNombre, usuarioId) {
    console.log(`[CÓDIGO] 🔄 Reactivando código único`);

    try {
      if (!beneficiario.codigo) {
        console.log(`[CÓDIGO] ⚠️ No existe código para reactivar`);
        return;
      }

      if (beneficiario.codigo.activo) {
        console.log(`[CÓDIGO] ℹ️ Código ya está activo`);
        return;
      }

      beneficiario.codigo.activo = true;
      beneficiario.codigo.estado_activacion = 'ACTIVO';
      beneficiario.codigo.fecha_activacion = new Date();

      if (!beneficiario.codigo.historial) {
        beneficiario.codigo.historial = [];
      }

      beneficiario.codigo.historial.push({
        motivo: 'REACTIVACION',
        fecha_cambio: new Date(),
        detalles: `Código reactivado por sincronización. Servicio: ${servicioNombre}`,
        codigo_anterior: null
      });

      await beneficiario.save();
      console.log(`[CÓDIGO] ✅ Código reactivado`);

    } catch (error) {
      console.error(`[CÓDIGO] ❌ Error:`, error);
      throw error;
    }
  }

  static async activarFondo(beneficiario, servicioNombre, datosActivacion, usuarioId, FondoModel) {
    console.log(`[FONDO] 💰 Activando fondo`);

    try {
      let fondo = await FondoModel.findOne({ beneficiarioId: beneficiario._id });

      if (fondo) {
        if (fondo.estado !== 'activo') {
          if (fondo.estado === 'desactivado') {
            await fondo.reactivar(null, usuarioId);
          } else {
            fondo.estado = 'activo';
            fondo.historial_movimientos.push({
              tipo: 'reactivacion',
              monto_anterior: fondo.saldo_actual.valor,
              monto_nuevo: fondo.saldo_actual.valor,
              descripcion: `Fondo reactivado automáticamente. Servicio: ${servicioNombre}`,
              realizado_por: usuarioId,
              fecha: new Date()
            });
            await fondo.save();
          }
        }
      } else {
        const fechaVencimiento = new Date();
        fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);

        fondo = new FondoModel({
          beneficiarioId: beneficiario._id,
          monto_inicial: { valor: 500, moneda: 'USD' },
          saldo_actual: { valor: 500, moneda: 'USD' },
          estado: 'activo',
          fecha_vencimiento: fechaVencimiento,
          creado_por: usuarioId,
          actualizado_por: usuarioId,
          historial_movimientos: [{
            tipo: 'creacion',
            monto_anterior: 0,
            monto_nuevo: 500,
            descripcion: `Fondo creado automáticamente. Servicio: ${servicioNombre}`,
            realizado_por: usuarioId,
            fecha: new Date()
          }]
        });

        await fondo.save();
        console.log(`[FONDO] ✅ Fondo creado`);
      }

    } catch (error) {
      console.error(`[FONDO] ❌ Error:`, error);
      throw error;
    }
  }

  static async desactivarFondo(beneficiario, servicioNombre, datosDesactivacion, usuarioId, FondoModel) {
    console.log(`[FONDO] 🔒 Desactivando fondo`);

    try {
      const fondo = await FondoModel.findOne({ beneficiarioId: beneficiario._id });

      if (!fondo || !fondo.puedeDesactivar()) {
        console.log(`[FONDO] ⚠️ Fondo no puede ser desactivado`);
        return;
      }

      const motivoFondo = this.mapearMotivoDesactivacionFondo(datosDesactivacion.motivo_desactivacion);
      
      await fondo.desactivar(
        motivoFondo,
        datosDesactivacion.razon_personalizada || `Desactivado por sincronización con servicio ${servicioNombre}`,
        true,
        usuarioId
      );

      console.log(`[FONDO] ✅ Fondo desactivado`);

    } catch (error) {
      console.error(`[FONDO] ❌ Error:`, error);
      throw error;
    }
  }

  static async reactivarFondo(beneficiario, servicioNombre, usuarioId, FondoModel) {
    console.log(`[FONDO] 🔄 Reactivando fondo`);

    try {
      const fondo = await FondoModel.findOne({ beneficiarioId: beneficiario._id });

      if (!fondo) {
        await this.activarFondo(beneficiario, servicioNombre, {}, usuarioId, FondoModel);
        return;
      }

      if (!fondo.puedeReactivar()) {
        if (fondo.estado === 'activo') {
          console.log(`[FONDO] ℹ️ Fondo ya está activo`);
          return;
        }
        console.log(`[FONDO] ⚠️ Fondo no puede ser reactivado`);
        return;
      }

      await fondo.reactivar(null, usuarioId);
      console.log(`[FONDO] ✅ Fondo reactivado`);

    } catch (error) {
      console.error(`[FONDO] ❌ Error:`, error);
      throw error;
    }
  }

  static async activarFinanciamiento(beneficiario, servicioNombre, datosActivacion, usuarioId, FinanciamientoModel) {
    console.log(`[FINANCIAMIENTO] 💳 Activando financiamiento`);
    console.log(`[FINANCIAMIENTO] Beneficiario: ${beneficiario._id}`);
    console.log(`[FINANCIAMIENTO] Datos:`, datosActivacion);

    try {
      let financiamiento = await FinanciamientoModel.findOne({ 
        beneficiario: beneficiario._id,
        activadoPorSincronizacion: true
      });

      if (financiamiento && financiamiento.estadoGeneral === 'Activo') {
        console.log(`[FINANCIAMIENTO] ℹ️ Ya existe financiamiento activo creado por sincronización`);
        return;
      }

      const costoMembresia = beneficiario.membresia?.costo_total?.valor || 0;
      const costoContratoCierre = beneficiario.membresia?.costo_contrato_cierre?.valor || 0;
      const monedaMembresia = beneficiario.membresia?.costo_total?.moneda || 'USD';

      financiamiento = new FinanciamientoModel({
        beneficiario: beneficiario._id,
        sucursal: beneficiario.sucursal || null,
        costoMembresia,
        costoContratoCierre,
        porcentajeEnganche: 20,
        montoEnganche: 0,
        montoFinanciado: 0,
        moneda: monedaMembresia === 'reales' || monedaMembresia === 'BRL' ? 'BRL' : 'USD',
        tasaInteres: 7,
        montoTotalConIntereses: 0,
        numeroPagos: 6,
        valorMensualidad: 0,
        fechaPrimerVencimiento: null,
        estadoGeneral: 'Pendiente',
        cuotas: [],
        activadoPorSincronizacion: true,
        requiereConfiguracion: true,
        historialEstados: [{
          estado: 'Pendiente',
          fecha: new Date(),
          usuario: usuarioId,
          notas: `Financiamiento creado automáticamente por activación de servicio ${servicioNombre}. Requiere configuración de montos y fechas.`
        }]
      });

      await financiamiento.save();

      if (!beneficiario.financiamientos) {
        beneficiario.financiamientos = [];
      }
      beneficiario.financiamientos.push(financiamiento._id);
      await beneficiario.save();

      console.log(`[FINANCIAMIENTO] ✅ Financiamiento creado en estado Pendiente`);
      console.log(`[FINANCIAMIENTO] - ID: ${financiamiento._id}`);
      console.log(`[FINANCIAMIENTO] - Estado: ${financiamiento.estadoGeneral}`);
      console.log(`[FINANCIAMIENTO] - Requiere configuración manual`);

    } catch (error) {
      console.error(`[FINANCIAMIENTO] ❌ Error:`, error);
      throw error;
    }
  }

  static async desactivarFinanciamiento(beneficiario, servicioNombre, datosDesactivacion, usuarioId, FinanciamientoModel) {
    console.log(`[FINANCIAMIENTO] 🔒 Desactivando financiamiento`);
    console.log(`[FINANCIAMIENTO] Beneficiario: ${beneficiario._id}`);

    try {
      const financiamientos = await FinanciamientoModel.find({ 
        beneficiario: beneficiario._id,
        estadoGeneral: { $in: ['Activo', 'Pendiente'] }
      });

      if (financiamientos.length === 0) {
        console.log(`[FINANCIAMIENTO] ⚠️ No hay financiamientos activos para desactivar`);
        return;
      }

      for (const financiamiento of financiamientos) {
        const motivoCancelacion = datosDesactivacion.razon_personalizada || 
                                  datosDesactivacion.motivo_desactivacion || 
                                  'Desactivado por cancelación de servicio';

        financiamiento.estadoGeneral = 'Cancelado sin devolución';
        financiamiento.historialEstados.push({
          estado: 'Cancelado sin devolución',
          fecha: new Date(),
          usuario: usuarioId,
          notas: `Financiamiento cancelado por desactivación de servicio ${servicioNombre}. Motivo: ${motivoCancelacion}`
        });

        await financiamiento.save();
        console.log(`[FINANCIAMIENTO] ✅ Financiamiento ${financiamiento._id} cancelado`);
      }

    } catch (error) {
      console.error(`[FINANCIAMIENTO] ❌ Error:`, error);
      throw error;
    }
  }

  static async reactivarFinanciamiento(beneficiario, servicioNombre, usuarioId, FinanciamientoModel) {
    console.log(`[FINANCIAMIENTO] 🔄 Reactivando financiamiento`);
    console.log(`[FINANCIAMIENTO] Beneficiario: ${beneficiario._id}`);

    try {
      const financiamientos = await FinanciamientoModel.find({ 
        beneficiario: beneficiario._id,
        estadoGeneral: 'Cancelado sin devolución',
        activadoPorSincronizacion: true
      }).sort({ createdAt: -1 }).limit(1);

      if (financiamientos.length === 0) {
        console.log(`[FINANCIAMIENTO] ℹ️ No hay financiamiento cancelado para reactivar, creando nuevo`);
        await this.activarFinanciamiento(beneficiario, servicioNombre, {}, usuarioId, FinanciamientoModel);
        return;
      }

      const financiamiento = financiamientos[0];

      financiamiento.estadoGeneral = 'Pendiente';
      financiamiento.historialEstados.push({
        estado: 'Pendiente',
        fecha: new Date(),
        usuario: usuarioId,
        notas: `Financiamiento reactivado por reactivación de servicio ${servicioNombre}. Requiere revisión de configuración.`
      });

      await financiamiento.save();
      console.log(`[FINANCIAMIENTO] ✅ Financiamiento ${financiamiento._id} reactivado en estado Pendiente`);

    } catch (error) {
      console.error(`[FINANCIAMIENTO] ❌ Error:`, error);
      throw error;
    }
  }

  static mapearMotivoDesactivacion(motivoServicio) {
    const mapeoMotivos = {
      'incumplimiento_pagos': 'ATRASO_PAGOS',
      'decision_administrativa': 'VIOLACION_CONTRATO',
      'solicitud_beneficiario': 'RESCISION_IMOTIVADA',
      'inactividad_prolongada': 'NO_USO',
      'finalizacion_contrato': 'VIOLACION_CONTRATO',
      'cambio_programa': 'OTRO',
      'otros': 'OTRO'
    };

    return mapeoMotivos[motivoServicio] || 'OTRO';
  }

  static mapearMotivoDesactivacionFondo(motivoServicio) {
    const mapeoMotivos = {
      'incumplimiento_pagos': 'decision_administrativa',
      'decision_administrativa': 'decision_administrativa',
      'solicitud_beneficiario': 'solicitud_beneficiario',
      'inactividad_prolongada': 'inactividad_prolongada',
      'finalizacion_contrato': 'finalizacion_contrato',
      'cambio_programa': 'cambio_programa',
      'otros': 'otros'
    };

    return mapeoMotivos[motivoServicio] || 'otros';
  }

  static normalizarNombreServicio(nombreServicio) {
    const mapeoNombres = {
      'Reembolso de costos': 'Refund360',
      'Certificado de boletos aéreos': 'Voucher Fly Back',
      'Vouchers Flyback': 'Voucher Fly Back',
      'Financiamiento de seña': 'Entrada Flex',
      'Financiamiento de Seña': 'Entrada Flex'
    };
    
    return mapeoNombres[nombreServicio] || nombreServicio;
  }
}