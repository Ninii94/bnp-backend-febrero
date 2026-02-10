import express from 'express';
import Financiamiento from '../models/Financiamiento.js';
import { Beneficiario } from '../models/Beneficiario.js';
import { BeneficioBeneficiario } from '../models/BeneficioBeneficiario.js';
import { Servicio } from '../models/Servicio.js';
import { checkAuth, isEquipoBNP, isBeneficiario } from '../middleware/auth.js';
import {
  registrarCambioEstadoFinanciamiento,
  registrarCuotaPagada,
  registrarCuotaMorosa,
  registrarCuotaLitigioLegal,
  registrarLiquidacionAnticipada,
} from '../middleware/bitacoraHelpers.js';
const router = express.Router();

// Función de verificación de servicio
const verificarServicioFinanciamiento = async (beneficiarioId) => {
  try {
    const servicio = await Servicio.findOne({ 
      nombre: { $regex: /financiamiento.*se[ñn]a|entrada.*flex/i }
    });

    if (!servicio) {
      console.log('Servicio de financiamiento no encontrado');
      return false;
    }

    const beneficioActivo = await BeneficioBeneficiario.findOne({
      beneficiarioId: beneficiarioId,
      servicioId: servicio._id,
      estado: 'activo'
    });

    return !!beneficioActivo;
  } catch (error) {
    console.error('Error al verificar servicio:', error);
    return false;
  }
};
// ===== RUTAS ESPECÍFICAS PRIMERO (SIN PARÁMETROS) =====

// GET /beneficiarios-elegibles - DEBE IR PRIMERO
router.get('/beneficiarios-elegibles', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const servicio = await Servicio.findOne({ 
      nombre: { $regex: /financiamiento.*se[ñn]a|entrada.*flex/i }
    });

    if (!servicio) {
      return res.status(404).json({ 
        message: 'Servicio de financiamiento no encontrado',
        beneficiarios: []
      });
    }

    const beneficiosActivos = await BeneficioBeneficiario.find({
      servicioId: servicio._id,
      estado: 'activo'
    }).select('beneficiarioId');

    const beneficiariosIds = beneficiosActivos.map(b => b.beneficiarioId);

    const beneficiarios = await Beneficiario.find({
      _id: { $in: beneficiariosIds }
    })
    .select('nombre apellido correo telefono membresia sucursal')
    .populate('sucursal', 'nombre')
    .sort({ nombre: 1, apellido: 1 });

    const beneficiariosFormateados = beneficiarios.map(b => ({
      _id: b._id,
      nombre: b.nombre,
      apellido: b.apellido,
      nombreCompleto: `${b.nombre} ${b.apellido}`,
      correo: b.correo,
      telefono: b.telefono,
      sucursal: b.sucursal?._id,
      sucursalNombre: b.sucursal?.nombre,
      costoMembresia: b.membresia?.costo_total?.valor || 0,
      costoContratoCierre: b.membresia?.costo_contrato_cierre?.valor || 0,
      moneda: b.membresia?.costo_total?.moneda || 'USD'
    }));

    res.json(beneficiariosFormateados);
  } catch (error) {
    console.error('Error al obtener beneficiarios elegibles:', error);
    res.status(500).json({ message: error.message });
  }
});


//  Crear financiamiento
router.post('/', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const beneficiario = await Beneficiario.findById(req.body.beneficiario);
    if (!beneficiario) {
      return res.status(404).json({ message: 'Beneficiario no encontrado' });
    }

    const tieneServicio = await verificarServicioFinanciamiento(beneficiario._id);
    if (!tieneServicio) {
      return res.status(403).json({ 
        message: 'El beneficiario no tiene activo el servicio de Financiamiento de Seña/Entrada Flex',
        codigo: 'SERVICIO_NO_ACTIVO'
      });
    }

    const financiamientoPendiente = await Financiamiento.findOne({
      beneficiario: beneficiario._id,
      activadoPorSincronizacion: true,
      requiereConfiguracion: true
    });

    // ✅ CORRECCIÓN: Calcular montos correctamente
    // La base de cálculo es SOLO la membresía, NO incluye costo de contrato
    const costoMembresia = parseFloat(req.body.costoMembresia);
    const costoContratoCierre = parseFloat(req.body.costoContratoCierre);
    
    const porcentajeEngancheTotal = parseFloat(req.body.porcentajeEnganche);
    const porcentajeBeneficiario = parseFloat(req.body.porcentajeEngancheBeneficiario);
    const porcentajeBNP = parseFloat(req.body.porcentajeEngancheBNP);
    
    // ✅ Todos los porcentajes se aplican SOLO sobre la membresía
    const montoEngancheTotal = (costoMembresia * porcentajeEngancheTotal) / 100;
    const montoEngancheBeneficiario = (costoMembresia * porcentajeBeneficiario) / 100;
    const montoEngancheBNP = (costoMembresia * porcentajeBNP) / 100;
    
    // ✅ IMPORTANTE: Solo financiamos el enganche de BNP (sobre la membresía)
    const montoFinanciado = montoEngancheBNP;
    const montoIntereses = (montoFinanciado * parseFloat(req.body.tasaInteres)) / 100;
    const montoTotalConIntereses = montoFinanciado + montoIntereses;
    const valorMensualidad = montoTotalConIntereses / parseInt(req.body.numeroPagos);

    // Generar cuotas con montos desglosados
    const cuotas = [];
    let fechaActual = new Date(req.body.fechaPrimerVencimiento);
    
    // Calcular cuánto capital y cuánto interés en cada mensualidad
    const capitalPorCuota = montoFinanciado / parseInt(req.body.numeroPagos);
    const interesPorCuota = montoIntereses / parseInt(req.body.numeroPagos);
    
    for (let i = 1; i <= parseInt(req.body.numeroPagos); i++) {
      cuotas.push({
        numero: i,
        monto: valorMensualidad,
        montoPrincipal: capitalPorCuota,
        montoInteres: interesPorCuota,
        fechaVencimiento: new Date(fechaActual)
      });
      fechaActual.setMonth(fechaActual.getMonth() + 1);
    }

    if (financiamientoPendiente) {
      console.log(`Actualizando financiamiento existente: ${financiamientoPendiente._id}`);
      
      financiamientoPendiente.costoMembresia = costoMembresia;
      financiamientoPendiente.costoContratoCierre = costoContratoCierre;
      financiamientoPendiente.porcentajeEnganche = porcentajeEngancheTotal;
      financiamientoPendiente.porcentajeEngancheBeneficiario = porcentajeBeneficiario;
      financiamientoPendiente.porcentajeEngancheBNP = porcentajeBNP;
      financiamientoPendiente.montoEnganche = montoEngancheTotal;
      financiamientoPendiente.montoEngancheBeneficiario = montoEngancheBeneficiario;
      financiamientoPendiente.montoEngancheBNP = montoEngancheBNP;
      financiamientoPendiente.montoFinanciado = montoFinanciado;
      financiamientoPendiente.tasaInteres = req.body.tasaInteres;
      financiamientoPendiente.montoIntereses = montoIntereses;
      financiamientoPendiente.montoTotalConIntereses = montoTotalConIntereses;
      financiamientoPendiente.numeroPagos = req.body.numeroPagos;
      financiamientoPendiente.valorMensualidad = valorMensualidad;
      financiamientoPendiente.fechaPrimerVencimiento = req.body.fechaPrimerVencimiento;
      financiamientoPendiente.cuotas = cuotas;
      financiamientoPendiente.estadoGeneral = 'Activo';
      financiamientoPendiente.requiereConfiguracion = false;
      financiamientoPendiente.sucursal = req.body.sucursal || beneficiario.sucursal;
      financiamientoPendiente.moneda = req.body.moneda;

      financiamientoPendiente.historialEstados.push({
        estado: 'Activo',
        usuario: req.usuario._id,
        notas: 'Financiamiento configurado y activado'
      });

      await financiamientoPendiente.save();

      return res.status(200).json({
        mensaje: 'Financiamiento configurado exitosamente',
        financiamiento: financiamientoPendiente,
        esActualizacion: true
      });
    }

    // nuevo
    const financiamiento = new Financiamiento({
      beneficiario: req.body.beneficiario,
      sucursal: req.body.sucursal,
      costoMembresia: costoMembresia,
      costoContratoCierre: costoContratoCierre,
      porcentajeEnganche: porcentajeEngancheTotal,
      porcentajeEngancheBeneficiario: porcentajeBeneficiario,
      porcentajeEngancheBNP: porcentajeBNP,
      montoEnganche: montoEngancheTotal,
      montoEngancheBeneficiario: montoEngancheBeneficiario,
      montoEngancheBNP: montoEngancheBNP,
      montoFinanciado: montoFinanciado,
      moneda: req.body.moneda,
      tasaInteres: req.body.tasaInteres,
      montoIntereses: montoIntereses,
      montoTotalConIntereses: montoTotalConIntereses,
      numeroPagos: req.body.numeroPagos,
      valorMensualidad: valorMensualidad,
      fechaPrimerVencimiento: req.body.fechaPrimerVencimiento,
      cuotas: cuotas,
      activadoPorSincronizacion: false,
      requiereConfiguracion: false,
      estadoGeneral: 'Activo',
      historialEstados: [{
        estado: 'Activo',
        usuario: req.usuario._id,
        notas: 'Financiamiento creado manualmente'
      }]
    });

    await financiamiento.save();

    if (!beneficiario.financiamientos) {
      beneficiario.financiamientos = [];
    }
    beneficiario.financiamientos.push(financiamiento._id);
    await beneficiario.save();

    res.status(201).json({
      mensaje: 'Financiamiento creado exitosamente',
      financiamiento,
      esActualizacion: false
    });
  } catch (error) {
    console.error('Error al crear financiamiento:', error);
    res.status(400).json({ message: error.message });
  }
});
// Listar
router.get('/', checkAuth, async (req, res) => {
  try {
    const query = {};
    
    if (req.tipo === 'beneficiario') {
      const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
      if (beneficiario) {
        const tieneServicio = await verificarServicioFinanciamiento(beneficiario._id);
        if (!tieneServicio) {
          return res.json([]);
        }
        query.beneficiario = beneficiario._id;
      } else {
        return res.json([]);
      }
    }
    
    if (req.query.estado) query.estadoGeneral = req.query.estado;

    let financiamientos = await Financiamiento.find(query)
      .populate('beneficiario', 'nombre apellido correo telefono')
      .populate('sucursal', 'nombre')
      .sort({ createdAt: -1 });

    if (req.tipo === 'equipoBNP' && !req.query.incluirTodos) {
      const financiamientosFiltrados = [];
      for (const financiamiento of financiamientos) {
        const tieneServicio = await verificarServicioFinanciamiento(financiamiento.beneficiario._id);
        if (tieneServicio) {
          financiamientosFiltrados.push(financiamiento);
        }
      }
      financiamientos = financiamientosFiltrados;
    }

    res.json(financiamientos);
  } catch (error) {
    console.error('Error al obtener financiamientos:', error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/verificar-recordatorios-pendientes', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    // Normalizar a medianoche en hora local
    const normalizarFecha = (fecha) => {
      const f = new Date(fecha);
      return new Date(f.getFullYear(), f.getMonth(), f.getDate());
    };
    
    const mananaNormalizado = normalizarFecha(manana);

    console.log('[DEBUG] Hoy:', hoy.toISOString());
    console.log('[DEBUG] Mañana normalizado:', mananaNormalizado.toISOString());

    const financiamientos = await Financiamiento.find({
      estadoGeneral: 'Activo'
    })
    .populate('beneficiario', 'nombre apellido correo')
    .populate('sucursal', 'nombre');

    const recordatoriosPendientes = [];

    for (const financiamiento of financiamientos) {
      const cuotasQueVencenManana = financiamiento.cuotas.filter(cuota => {
        if (cuota.estado === 'Pagado') return false;
        
        const fechaVencimiento = normalizarFecha(cuota.fechaVencimiento);
        const venceManana = fechaVencimiento.getTime() === mananaNormalizado.getTime();
        
        console.log(`[DEBUG] Cuota ${cuota.numero} de ${financiamiento.beneficiario.nombre}:`);
        console.log(`  Vence: ${fechaVencimiento.toISOString()}`);
        console.log(`  Mañana: ${mananaNormalizado.toISOString()}`);
        console.log(`  ¿Vence mañana?: ${venceManana}`);
        
        return venceManana;
      });

      if (cuotasQueVencenManana.length > 0) {
        const recordatorioEnviadoHoy = financiamiento.notificaciones?.ultimoEnvio 
          ? normalizarFecha(financiamiento.notificaciones.ultimoEnvio).getTime() === normalizarFecha(hoy).getTime()
          : false;

        console.log(`[DEBUG] ✅ ${financiamiento.beneficiario.nombre} tiene ${cuotasQueVencenManana.length} cuota(s) que vencen mañana`);

        recordatoriosPendientes.push({
          financiamientoId: financiamiento._id,
          beneficiario: financiamiento.beneficiario,
          sucursal: financiamiento.sucursal,
          cuotas: cuotasQueVencenManana,
          recordatorioEnviado: recordatorioEnviadoHoy
        });
      }
    }

    console.log(`[DEBUG] Total: ${recordatoriosPendientes.length} recordatorios pendientes`);
    res.json(recordatoriosPendientes);
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/debug-fechas', checkAuth, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    const financiamientos = await Financiamiento.find({ estadoGeneral: 'Activo' })
      .populate('beneficiario', 'nombre');
    
    const debug = financiamientos.map(f => ({
      beneficiario: f.beneficiario?.nombre,
      cuotas: f.cuotas.map(c => ({
        numero: c.numero,
        fechaVencimiento: c.fechaVencimiento,
        fechaVencimientoStr: new Date(c.fechaVencimiento).toLocaleDateString(),
        estado: c.estado,
        esManana: new Date(c.fechaVencimiento).setHours(0,0,0,0) === manana.getTime()
      }))
    }));
    
    res.json({
      hoy: hoy.toISOString(),
      manana: manana.toISOString(),
      financiamientos: debug
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/:id/cuota/:numeroCuota/recordatorio', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario');

    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    const numeroCuota = parseInt(req.params.numeroCuota);
    const cuota = financiamiento.cuotas.find(c => c.numero === numeroCuota);

    if (!cuota) {
      return res.status(404).json({ message: 'Cuota no encontrada' });
    }

    if (cuota.estado === 'Pagado') {
      return res.status(400).json({ message: 'La cuota ya está pagada' });
    }

    if (cuota.recordatorioEnviado) {
      return res.status(400).json({ message: 'Ya se envió un recordatorio para esta cuota' });
    }

    // Enviar el recordatorio
    const { FinanciamientoNotificacionesService } = await import('../services/financiamientoNotificacionesService.js');
    
    await FinanciamientoNotificacionesService.enviarNotificacionVencimiento(
      financiamiento,
      cuota
    );

    // Marcar la cuota con recordatorioEnviado
    cuota.recordatorioEnviado = true;
    cuota.fechaEnvioRecordatorio = new Date();
    
    await financiamiento.save();

    console.log('[RECORDATORIO CUOTA] Enviado:', {
      financiamientoId: financiamiento._id,
      beneficiario: financiamiento.beneficiario.nombre,
      numeroCuota: cuota.numero,
      fechaEnvio: cuota.fechaEnvioRecordatorio
    });

    res.json({ 
      message: `Recordatorio de cuota #${numeroCuota} enviado exitosamente`,
      correo: financiamiento.beneficiario.correo,
      fechaEnvio: cuota.fechaEnvioRecordatorio
    });
  } catch (error) {
    console.error('Error enviando recordatorio de cuota:', error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/:id', checkAuth, async (req, res) => {
  try {
    console.log('[GET FINANCIAMIENTO] ID:', req.params.id);
    
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario', 'nombre apellido correo telefono')
      .populate('sucursal', 'nombre');
      // ⚠️ NO populamos historialEstados.usuario para evitar el error
      // Si necesitas el nombre del usuario, hazlo manualmente después

    if (!financiamiento) {
      console.error('[GET FINANCIAMIENTO] No encontrado:', req.params.id);
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    // Verificar permisos si es beneficiario
    if (req.tipo === 'beneficiario') {
      const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
      if (!beneficiario || financiamiento.beneficiario._id.toString() !== beneficiario._id.toString()) {
        console.error('[GET FINANCIAMIENTO] No autorizado');
        return res.status(403).json({ message: 'No autorizado' });
      }
    }

    console.log('[GET FINANCIAMIENTO] Encontrado exitosamente');
    res.json(financiamiento);
  } catch (error) {
    console.error('[GET FINANCIAMIENTO] Error:', error);
    res.status(500).json({ 
      message: 'Error al obtener financiamiento',
      error: error.message 
    });
  }
});
router.get('/:id/completo', checkAuth, async (req, res) => {
  try {
    console.log('[GET FINANCIAMIENTO COMPLETO] ID:', req.params.id);
    
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario', 'nombre apellido correo telefono')
      .populate('sucursal', 'nombre');

    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    // Popular manualmente el historial de estados
    if (financiamiento.historialEstados && financiamiento.historialEstados.length > 0) {
      const { Usuario } = await import('../models/Usuario.js');
      
      for (let i = 0; i < financiamiento.historialEstados.length; i++) {
        const historial = financiamiento.historialEstados[i];
        if (historial.usuario) {
          try {
            const usuario = await Usuario.findById(historial.usuario).select('nombre_usuario');
            if (usuario) {
              // Convertir a objeto plano y agregar info del usuario
              financiamiento.historialEstados[i] = {
                ...historial.toObject(),
                usuarioNombre: usuario.nombre_usuario
              };
            }
          } catch (err) {
            console.warn('[GET FINANCIAMIENTO] No se pudo cargar usuario del historial:', err.message);
          }
        }
      }
    }

    // Verificar permisos si es beneficiario
    if (req.tipo === 'beneficiario') {
      const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
      if (!beneficiario || financiamiento.beneficiario._id.toString() !== beneficiario._id.toString()) {
        return res.status(403).json({ message: 'No autorizado' });
      }
    }

    console.log('[GET FINANCIAMIENTO COMPLETO] Encontrado exitosamente');
    res.json(financiamiento);
  } catch (error) {
    console.error('[GET FINANCIAMIENTO COMPLETO] Error:', error);
    res.status(500).json({ 
      message: 'Error al obtener financiamiento',
      error: error.message 
    });
  }
});
router.get('/:id/simular-liquidacion', checkAuth, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id);
    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    if (financiamiento.liquidacionAnticipada?.aplicada) {
      return res.status(400).json({ message: 'Ya se aplicó una liquidación anticipada' });
    }

    // Obtener el número de cuota desde query params (opcional)
    const hastaCuota = req.query.hastaCuota ? parseInt(req.query.hastaCuota) : undefined;
    
    const simulacion = financiamiento.calcularLiquidacionAnticipada(hastaCuota);
    
    if (!simulacion) {
      return res.status(400).json({ message: 'No hay cuotas pendientes para liquidar' });
    }

    res.json(simulacion);
  } catch (error) {
    console.error('Error al simular liquidación:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/cuota/:numeroCuota', checkAuth, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario', 'nombre apellido codigo llave_unica');
    
    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    if (req.tipo === 'beneficiario') {
      const beneficiario = await Beneficiario.findOne({ usuario_id: req.usuario._id });
      if (financiamiento.beneficiario._id.toString() !== beneficiario._id.toString()) {
        return res.status(403).json({ message: 'No autorizado' });
      }
    }

    const cuota = financiamiento.cuotas.find(c => c.numero === parseInt(req.params.numeroCuota));
    if (!cuota) {
      return res.status(404).json({ message: 'Cuota no encontrada' });
    }

    if (!cuota.montoPrincipal || !cuota.montoInteres) {
      const capitalPorCuota = financiamiento.montoFinanciado / financiamiento.numeroPagos;
      const interesPorCuota = (financiamiento.montoIntereses || (financiamiento.montoFinanciado * financiamiento.tasaInteres / 100)) / financiamiento.numeroPagos;
      
      cuota.montoPrincipal = capitalPorCuota;
      cuota.montoInteres = interesPorCuota;
    }

    const estadoAnterior = cuota.estado;
    
    if (req.body.estado) cuota.estado = req.body.estado;
    if (req.body.comprobante) cuota.comprobante = req.body.comprobante;
    if (req.body.notas) cuota.notas = req.body.notas;
    
    if (req.body.estado === 'Pagado') {
      cuota.fechaPago = new Date();
      
      const montoPagado = req.body.montoPagado || cuota.monto;
      const intereseMoratorio = cuota.intereseMoratorio || 0;
      
      let restante = montoPagado;
      
      cuota.montoMoratorioPagado = Math.min(restante, intereseMoratorio);
      restante -= cuota.montoMoratorioPagado;
      
      cuota.montoInteresPagado = Math.min(restante, cuota.montoInteres);
      restante -= cuota.montoInteresPagado;
      
      cuota.montoPrincipalPagado = Math.min(restante, cuota.montoPrincipal);
      
      cuota.montoPagado = montoPagado;
      
      cuota.recordatorioEnviado = false;
      cuota.fechaEnvioRecordatorio = null;
    }

    await financiamiento.save();

    // REGISTRO EN BITÁCORA
    try {
      const beneficiarioNombre = `${financiamiento.beneficiario.nombre} ${financiamiento.beneficiario.apellido}`;
      const beneficiarioCodigo = financiamiento.beneficiario.codigo?.value || financiamiento.beneficiario.llave_unica;

      if (req.body.estado === 'Pagado' && estadoAnterior !== 'Pagado') {
        await registrarCuotaPagada(
          {
            beneficiario_nombre: beneficiarioNombre,
            beneficiario_id: financiamiento.beneficiario._id,
            beneficiario_codigo: beneficiarioCodigo,
            numero_cuota: cuota.numero,
            monto_pagado: cuota.montoPagado || cuota.monto,
            financiamiento_id: financiamiento._id,
            comprobante: cuota.comprobante,
          },
          req
        );
      } else if (req.body.estado === 'Moroso' && estadoAnterior !== 'Moroso') {
        const fechaVencimiento = new Date(cuota.fechaVencimiento);
        const hoy = new Date();
        const diasVencidos = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));
        
        await registrarCuotaMorosa(
          {
            beneficiario_nombre: beneficiarioNombre,
            beneficiario_id: financiamiento.beneficiario._id,
            beneficiario_codigo: beneficiarioCodigo,
            numero_cuota: cuota.numero,
            dias_vencidos: diasVencidos > 0 ? diasVencidos : 1,
            interes_moratorio: cuota.intereseMoratorio || 0,
            financiamiento_id: financiamiento._id,
          },
          req
        );
      } else if (req.body.estado === 'Litigio legal' && estadoAnterior !== 'Litigio legal') {
        await registrarCuotaLitigioLegal(
          {
            beneficiario_nombre: beneficiarioNombre,
            beneficiario_id: financiamiento.beneficiario._id,
            beneficiario_codigo: beneficiarioCodigo,
            numero_cuota: cuota.numero,
            financiamiento_id: financiamiento._id,
            notas: req.body.notas || 'Cuota marcada en litigio legal',
          },
          req
        );
      }
    } catch (bitacoraError) {
      console.error('Error registrando en bitácora:', bitacoraError);
    }

    res.json(financiamiento);
  } catch (error) {
    console.error('Error al actualizar cuota:', error);
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/estado', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario', 'nombre apellido codigo llave_unica');
    
    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    const estadoAnterior = financiamiento.estadoGeneral;
    const estadoNuevo = req.body.estadoGeneral;

    financiamiento.estadoGeneral = estadoNuevo;
    financiamiento.historialEstados.push({
      estado: estadoNuevo,
      usuario: req.usuario._id,
      notas: req.body.notas
    });

    await financiamiento.save();

    // REGISTRO EN BITÁCORA
    try {
      await registrarCambioEstadoFinanciamiento(
        {
          beneficiario_nombre: `${financiamiento.beneficiario.nombre} ${financiamiento.beneficiario.apellido}`,
          beneficiario_id: financiamiento.beneficiario._id,
          beneficiario_codigo: financiamiento.beneficiario.codigo?.value || financiamiento.beneficiario.llave_unica,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoNuevo,
          financiamiento_id: financiamiento._id,
          notas: req.body.notas,
        },
        req
      );
    } catch (bitacoraError) {
      console.error('Error registrando en bitácora:', bitacoraError);
    }

    res.json(financiamiento);
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/liquidacion-anticipada', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario', 'nombre apellido codigo llave_unica');
    
    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    if (financiamiento.liquidacionAnticipada?.aplicada) {
      return res.status(400).json({ message: 'Ya se aplicó una liquidación anticipada' });
    }

    const { hastaCuota, comprobante, notas } = req.body;

    if (!comprobante || !comprobante.trim()) {
      return res.status(400).json({ message: 'Debe proporcionar un comprobante de pago' });
    }

    if (!hastaCuota) {
      return res.status(400).json({ message: 'Debe especificar hasta qué cuota liquidar' });
    }

    const resultado = financiamiento.aplicarLiquidacionAnticipada(
      parseInt(hastaCuota),
      comprobante,
      notas
    );

    const cuotasRestantes = financiamiento.cuotas.filter(c => c.estado !== 'Pagado').length;
    const estadoFinal = cuotasRestantes === 0 ? 'Liquidado' : financiamiento.estadoGeneral;

    financiamiento.historialEstados.push({
      estado: estadoFinal,
      usuario: req.usuario._id,
      notas: `Liquidación anticipada hasta cuota #${hastaCuota}. Interés aplicado: ${resultado.porcentajeInteresAplicado}%, Interés condonado: ${resultado.montoInteresCondonado.toFixed(2)} ${financiamiento.moneda}. ${cuotasRestantes > 0 ? `Quedan ${cuotasRestantes} cuota(s) pendiente(s).` : 'Todas las cuotas liquidadas.'}`
    });

    await financiamiento.save();

    // REGISTRO EN BITÁCORA
    try {
      await registrarLiquidacionAnticipada(
        {
          beneficiario_nombre: `${financiamiento.beneficiario.nombre} ${financiamiento.beneficiario.apellido}`,
          beneficiario_id: financiamiento.beneficiario._id,
          beneficiario_codigo: financiamiento.beneficiario.codigo?.value || financiamiento.beneficiario.llave_unica,
          hasta_cuota: parseInt(hastaCuota),
          monto_final: resultado.montoFinal,
          interes_aplicado: resultado.montoInteresAplicado,
          interes_condonado: resultado.montoInteresCondonado,
          financiamiento_id: financiamiento._id,
          comprobante: comprobante,
        },
        req
      );
    } catch (bitacoraError) {
      console.error('Error registrando en bitácora:', bitacoraError);
    }

    res.json({
      mensaje: `Liquidación aplicada exitosamente hasta cuota #${hastaCuota}`,
      montoFinal: resultado.montoFinal,
      montoTotal: resultado.montoTotal,
      cuotasRestantes,
      detalles: resultado
    });
  } catch (error) {
    console.error('[LIQUIDACION] Error:', error);
    res.status(400).json({ message: error.message });
  }
});



router.post('/:id/calcular-moratorio', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    console.log('[CALCULAR MORATORIO] Iniciando para ID:', req.params.id);
    
    const financiamiento = await Financiamiento.findById(req.params.id);
    if (!financiamiento) {
      console.error('[CALCULAR MORATORIO] Financiamiento no encontrado');
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    console.log('[CALCULAR MORATORIO] Fecha actual:', hoy.toISOString());
    console.log('[CALCULAR MORATORIO] Total de cuotas:', financiamiento.cuotas.length);

    let cuotasActualizadas = 0;

    financiamiento.cuotas.forEach((cuota, index) => {
      console.log(`[CALCULAR MORATORIO] Cuota ${cuota.numero}:`, {
        estado: cuota.estado,
        fechaVencimiento: new Date(cuota.fechaVencimiento).toISOString()
      });

      // ✅ SOLO calcular si está marcada como "Moroso"
      if (cuota.estado === 'Moroso') {
        const fechaVencimiento = new Date(cuota.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);
        
        // Calcular días desde el vencimiento hasta hoy
        let diasVencidos = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));
        
        // IMPORTANTE: Si la fecha está en el futuro, usar al menos 1 día porque si está marcada como morosa, debe tener interés
        if (diasVencidos <= 0) {
          diasVencidos = 1; // Mínimo 1 día de interés moratorio
          console.log(`[CALCULAR MORATORIO] Cuota ${cuota.numero} - MOROSA con fecha futura, usando 1 día mínimo`);
        }
        
        console.log(`[CALCULAR MORATORIO] Cuota ${cuota.numero} - MOROSA - Días a calcular: ${diasVencidos}`);

        const tasaMoratoria = cuota.tasaMoratoria || 3; // 3% mensual defecto
        
        // Calcular interés diario proporcional
        const tasaDiaria = tasaMoratoria / 30; // Tasa diaria
        const porcentajeTotal = (tasaDiaria * diasVencidos) / 100;
        
        // Aplicar interés simple sobre el monto base
        const interesCalculado = cuota.monto * porcentajeTotal;
        cuota.intereseMoratorio = interesCalculado;
        
        console.log(`[CALCULAR MORATORIO] Cuota ${cuota.numero} - Interés calculado:`, {
          diasVencidos,
          tasaMoratoria: `${tasaMoratoria}% mensual`,
          tasaDiaria: `${tasaDiaria.toFixed(4)}% diario`,
          montoBase: cuota.monto,
          interesCalculado: interesCalculado.toFixed(2),
          totalAPagar: (cuota.monto + interesCalculado).toFixed(2)
        });

        cuotasActualizadas++;
      }
    });

    console.log(`[CALCULAR MORATORIO] Total de cuotas actualizadas: ${cuotasActualizadas}`);

    await financiamiento.save();
    console.log('[CALCULAR MORATORIO] Cambios guardados exitosamente');

    res.json({
      mensaje: `Se calcularon intereses moratorios para ${cuotasActualizadas} cuota(s) morosa(s)`,
      cuotasActualizadas,
      success: true
    });
  } catch (error) {
    console.error('[CALCULAR MORATORIO] Error:', error);
    res.status(500).json({ 
      message: error.message,
      error: error.toString()
    });
  }
});
router.post('/:id/enviar-recordatorio-manual', checkAuth, isEquipoBNP, async (req, res) => {
  try {
    const financiamiento = await Financiamiento.findById(req.params.id)
      .populate('beneficiario');

    if (!financiamiento) {
      return res.status(404).json({ message: 'Financiamiento no encontrado' });
    }

    const cuotasPendientes = financiamiento.cuotas.filter(c => c.estado !== 'Pagado');
    
    if (cuotasPendientes.length === 0) {
      return res.status(400).json({ message: 'No hay cuotas pendientes' });
    }

    const { FinanciamientoNotificacionesService } = await import('../services/financiamientoNotificacionesService.js');
    
    await FinanciamientoNotificacionesService.enviarNotificacionVencimiento(
      financiamiento,
      cuotasPendientes[0]
    );

    // ✅ IMPORTANTE: Actualizar el campo de notificaciones
    if (!financiamiento.notificaciones) {
      financiamiento.notificaciones = {};
    }
    
    financiamiento.notificaciones.ultimoEnvio = new Date();
    financiamiento.notificaciones.totalEnviados = (financiamiento.notificaciones.totalEnviados || 0) + 1;
    
    // Marcar la cuota con recordatorioEnviado
    if (cuotasPendientes[0]) {
      const cuota = financiamiento.cuotas.find(c => c.numero === cuotasPendientes[0].numero);
      if (cuota) {
        cuota.recordatorioEnviado = true;
        cuota.fechaEnvioRecordatorio = new Date();
      }
    }
    
    await financiamiento.save();

    console.log('[RECORDATORIO] Enviado y guardado:', {
      financiamientoId: financiamiento._id,
      beneficiario: financiamiento.beneficiario.nombre,
      ultimoEnvio: financiamiento.notificaciones.ultimoEnvio
    });

    res.json({ 
      message: 'Recordatorio enviado exitosamente',
      correo: financiamiento.beneficiario.correo,
      ultimoEnvio: financiamiento.notificaciones.ultimoEnvio
    });
  } catch (error) {
    console.error('Error enviando recordatorio:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;