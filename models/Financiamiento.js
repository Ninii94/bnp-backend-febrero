import mongoose from 'mongoose';

const cuotaSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  monto: { type: Number, required: true },
  montoPrincipal: { type: Number }, 
  montoInteres: { type: Number },   
  fechaVencimiento: { type: Date, required: true },
  estado: {
    type: String,
    enum: ['En espera de pago', 'Pagado', 'Moroso', 'Litigio legal'],
    default: 'En espera de pago'
  },
  fechaPago: Date,
   fechaMarcadoMoroso: Date,
  comprobante: String,
  intereseMoratorio: { type: Number, default: 0 },
  tasaMoratoria: { type: Number, default: 3 },
  montoPagado: Number,
  montoPrincipalPagado: Number,
  montoInteresPagado: Number,
  montoMoratorioPagado: Number,
  notas: String, 
  recordatorioEnviado: { type: Boolean, default: false },
  fechaEnvioRecordatorio: Date
});
cuotaSchema.methods.calcularDiasVencidos = function() {
  if (!this.fechaMarcadoMoroso || this.estado !== 'Moroso') return 0;
  const ahora = new Date();
  const fechaMoroso = new Date(this.fechaMarcadoMoroso);
  const diferenciaMilisegundos = ahora.getTime() - fechaMoroso.getTime();
  return Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
};
const financiamientoSchema = new mongoose.Schema({
  beneficiario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiario',
    required: true
  },
  sucursal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sucursal'
  },
  costoMembresia: { type: Number, default: 0 },
  costoContratoCierre: { type: Number, default: 0 },
  porcentajeEnganche: { type: Number, default: 20 }, // ✅ Cambiado de 30% a 20%
  montoEnganche: { type: Number, default: 0 },
  porcentajeEngancheBeneficiario: { type: Number, default: 10 }, // ✅ NUEVO: Lo que pone el beneficiario
  montoEngancheBeneficiario: { type: Number, default: 0 },       // ✅ NUEVO
  porcentajeEngancheBNP: { type: Number, default: 20 },          // ✅ NUEVO: Lo que financia BNP
  montoEngancheBNP: { type: Number, default: 0 },                // ✅ NUEVO: Monto que BNP financia
  montoFinanciado: { type: Number, default: 0 },                 // ✅ Este es el que BNP financia
  moneda: {
    type: String,
    enum: ['BRL', 'USD'],
    default: 'USD'
  },
  tasaInteres: { type: Number, default: 7 },
  montoIntereses: { type: Number, default: 0 },                  // ✅ NUEVO: Intereses totales separados
  montoTotalConIntereses: { type: Number, default: 0 },
  numeroPagos: { type: Number, default: 6 },
  valorMensualidad: { type: Number, default: 0 },
  fechaPrimerVencimiento: Date,
  estadoGeneral: {
    type: String,
    enum: ['Activo', 'Normalizado', 'Liquidado', 'Cancelado con devolución', 'Cancelado sin devolución', 'Litigio legal', 'Pendiente'],
    default: 'Pendiente'
  },
  cuotas: [cuotaSchema],
  historialEstados: [{
    estado: String,
    fecha: { type: Date, default: Date.now },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    notas: String
  }],
  liquidacionAnticipada: {
    aplicada: { type: Boolean, default: false },
    fechaLiquidacion: Date,
    
    hastaCuotaNumero: Number,                       // ✅ AGREGADO
    cuotasPendientesAlMomento: Number,
    cuotasPendientesHastaLimite: Number,            // ✅ AGREGADO
    cuotasPagadasAnteriormente: Number,             // ✅ AGREGADO
    porcentajeInteresAplicado: Number,
    montoCapitalRestante: Number,
    montoInteresAplicado: Number,
    montoInteresCondonado: Number,
    montoPagadoAnteriormente: Number,
    montoPrincipalPagadoAnteriormente: Number,
    montoInteresPagadoAnteriormente: Number,
    montoMoratorioPagadoAnteriormente: Number,
    montoFinal: Number,
    montoTotal: Number,                             // ✅ AGREGADO
    comprobante: String,
    notas: String
  },
  notificaciones: {
    diasAntes: { type: Number, default: 1 },
    plantilla: String,
    ultimoEnvio: Date,
    totalEnviados: { type: Number, default: 0 }
  },
  activadoPorSincronizacion: { type: Boolean, default: false },
  requiereConfiguracion: { type: Boolean, default: true }
}, {
  timestamps: true
});

// ✅ NUEVO: Método para calcular liquidación anticipada correctamente
financiamientoSchema.methods.calcularLiquidacionAnticipada = function(hastaCuotaNumero) {
  // 1. Validar entrada
  if (!hastaCuotaNumero) {
    const primeraPendiente = this.cuotas.find(c => c.estado !== 'Pagado');
    if (!primeraPendiente) return null;
    hastaCuotaNumero = primeraPendiente.numero;
  }

  // 2. Obtener todas las cuotas hasta la especificada (inclusive)
  const cuotasHastaLimite = this.cuotas.filter(c => c.numero <= hastaCuotaNumero);
  
  // 3. Separar cuotas pagadas y pendientes
  const cuotasPagadas = cuotasHastaLimite.filter(c => c.estado === 'Pagado');
  const cuotasPendientes = cuotasHastaLimite.filter(c => c.estado !== 'Pagado');
  
  if (cuotasPendientes.length === 0) {
    return null;
  }

  // ✅ MIGRACIÓN AUTOMÁTICA: Calcular desglose si no existe
  const montoIntereses = this.montoIntereses || (this.montoFinanciado * this.tasaInteres / 100);
  const capitalPorCuota = this.montoFinanciado / this.numeroPagos;
  const interesPorCuota = montoIntereses / this.numeroPagos;

  // 4. Calcular cuánto capital e interés ya pagó (sin contar moratorios)
  const montoPrincipalPagado = cuotasPagadas.reduce((sum, c) => 
    sum + (c.montoPrincipalPagado || c.montoPrincipal || capitalPorCuota), 0
  );
  const montoInteresPagado = cuotasPagadas.reduce((sum, c) => 
    sum + (c.montoInteresPagado || c.montoInteres || interesPorCuota), 0
  );
  const montoMoratorioPagado = cuotasPagadas.reduce((sum, c) => 
    sum + (c.montoMoratorioPagado || 0), 0
  );

  // 5. Calcular capital restante hasta la cuota especificada
  const capitalRestanteHastaLimite = cuotasPendientes.reduce((sum, c) => 
    sum + (c.montoPrincipal || capitalPorCuota), 0
  );

  // 6. Calcular el % de interés a cobrar
  const porcentajeInteresAplicado = hastaCuotaNumero * 1;

  // 7. Calcular el monto de interés a cobrar sobre el CAPITAL ORIGINAL TOTAL
  const montoInteresAplicado = (this.montoFinanciado * porcentajeInteresAplicado) / 100;

  // 8. Calcular el interés total original
  const interesOriginalTotal = montoIntereses;

  // 9. Calcular cuánto interés se condona
  const montoInteresCondonado = interesOriginalTotal - montoInteresPagado - montoInteresAplicado;

  // 10. Monto final a pagar para liquidar HASTA esa cuota
  const montoFinal = capitalRestanteHastaLimite + (montoInteresAplicado - montoInteresPagado);

  // 11. Total acumulado que habrá pagado
  const montoTotal = montoPrincipalPagado + montoInteresAplicado + montoMoratorioPagado;

  return {
    hastaCuotaNumero,
    cuotasPendientesHastaLimite: cuotasPendientes.length,
    cuotasPagadasAnteriormente: cuotasPagadas.length,
    porcentajeInteresAplicado,
    montoCapitalRestante: capitalRestanteHastaLimite,
    montoInteresAplicado,
    montoInteresCondonado,
    montoPagadoAnteriormente: montoPrincipalPagado + montoInteresPagado + montoMoratorioPagado,
    montoPrincipalPagadoAnteriormente: montoPrincipalPagado,
    montoInteresPagadoAnteriormente: montoInteresPagado,
    montoMoratorioPagadoAnteriormente: montoMoratorioPagado,
    montoFinal,
    montoTotal
  };
};

// ✅ NUEVO: Aplicar liquidación anticipada
financiamientoSchema.methods.aplicarLiquidacionAnticipada = function(hastaCuotaNumero, comprobante, notas) {
  const calculo = this.calcularLiquidacionAnticipada(hastaCuotaNumero);
  
  if (!calculo) {
    throw new Error('No hay cuotas pendientes para liquidar');
  }

  // Marcar todas las cuotas HASTA la especificada como pagadas
  const fechaLiquidacion = new Date();
  this.cuotas.forEach(cuota => {
    if (cuota.numero <= hastaCuotaNumero && cuota.estado !== 'Pagado') {
      cuota.estado = 'Pagado';
      cuota.fechaPago = fechaLiquidacion;
      cuota.comprobante = comprobante;
      cuota.notas = notas || `Liquidación anticipada - antes de cuota #${hastaCuotaNumero}`;
      
      // Registrar el desglose del pago
      cuota.montoPrincipalPagado = cuota.montoPrincipal;
      cuota.montoInteresPagado = cuota.montoInteres;
      cuota.montoPagado = cuota.monto;
    }
  });

  // Registrar la liquidación
  this.liquidacionAnticipada = {
    aplicada: true,
    fechaLiquidacion,
    ...calculo,
    comprobante,
    notas
  };

  // Verificar si quedan más cuotas pendientes
  const cuotasRestantes = this.cuotas.filter(c => c.estado !== 'Pagado').length;
  
  if (cuotasRestantes === 0) {
    this.estadoGeneral = 'Liquidado';
  }

  return calculo;
};

// Índices
financiamientoSchema.index({ beneficiario: 1, estadoGeneral: 1 });
financiamientoSchema.index({ 'cuotas.fechaVencimiento': 1, 'cuotas.estado': 1 });

export default mongoose.model('Financiamiento', financiamientoSchema);