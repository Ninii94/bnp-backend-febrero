// models/Descuento.js
import mongoose from 'mongoose';

const descuentoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['PORCENTAJE', 'MONTO_FIJO'],
    required: true
  },
  valor: {
    type: Number,
    required: true
  },
  moneda: {
    type: String,
    enum: ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'BRL', 'BOB', 'PYG', 'UYU', 'VES'],
    default: 'USD'
  },
  valor_base_usd: {
    type: Number,
    required: function() { return this.tipo === 'MONTO_FIJO'; }
  },
  fecha_inicio: {
    type: Date,
    required: true
  },
  fecha_expiracion: {
    type: Date,
    required: true
  },
  usos_maximos: {
    type: Number,
    default: null
  },
  usos_actuales: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  },
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aliado',
    required: false
  },
  restricciones: {
    min_compra: {
      type: Number,
      default: 0
    },
    productos_aplicables: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto'
    }],
    categorias_aplicables: [{
      type: String
    }],
    paises_aplicables: [{
      type: String
    }]
  },
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  }
});

export const Descuento = mongoose.model('Descuento', descuentoSchema);

// controllers/DescuentoController.js
import { Descuento } from '../models/Descuento.js';
import axios from 'axios';

const DescuentoController = {
  // Obtener tasas de cambio actualizadas
  async obtenerTasasDeCambio() {
    try {
      // Usando API de tipo Exchange Rate API (puede reemplazarse con cualquier proveedor)
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      return response.data.rates;
    } catch (error) {
      console.error('Error al obtener tasas de cambio:', error);
      // Tasas de respaldo en caso de fallo en la API
      return {
        EUR: 0.91, MXN: 16.70, COP: 3800, ARS: 900, 
        CLP: 920, PEN: 3.70, BRL: 5.40, BOB: 6.90, 
        PYG: 7200, UYU: 38.5, VES: 36.5, USD: 1
      };
    }
  },
  
  // Crear un nuevo descuento
  async crearDescuento(req, res) {
    try {
      const { 
        nombre, codigo, tipo, valor, moneda, 
        fecha_inicio, fecha_expiracion, usos_maximos,
        aliado_id, restricciones, creado_por
      } = req.body;
      
      let valor_base_usd = valor;
      
      // Si es monto fijo, calcular el valor en USD para tener una referencia base
      if (tipo === 'MONTO_FIJO' && moneda !== 'USD') {
        const tasas = await DescuentoController.obtenerTasasDeCambio();
        valor_base_usd = valor / tasas[moneda];
      }
      
      const nuevoDescuento = new Descuento({
        nombre,
        codigo,
        tipo,
        valor,
        moneda,
        valor_base_usd,
        fecha_inicio,
        fecha_expiracion,
        usos_maximos,
        aliado_id,
        restricciones,
        creado_por
      });
      
      await nuevoDescuento.save();
      res.status(201).json({ mensaje: 'Descuento creado exitosamente', descuento: nuevoDescuento });
    } catch (error) {
      console.error('Error al crear descuento:', error);
      res.status(500).json({ error: 'Error al crear descuento', detalles: error.message });
    }
  },
  
  // Aplicar descuento a una transacción
  async aplicarDescuento(req, res) {
    try {
      const { codigo, monto_total, moneda_transaccion, productos, pais } = req.body;
      
      // Buscar descuento por código
      const descuento = await Descuento.findOne({ 
        codigo, 
        activo: true,
        fecha_inicio: { $lte: new Date() },
        fecha_expiracion: { $gte: new Date() },
        $or: [
          { usos_maximos: null },
          { usos_actuales: { $lt: "$usos_maximos" } }
        ]
      });
      
      if (!descuento) {
        return res.status(404).json({ error: 'Descuento no encontrado o no válido' });
      }
      
      // Verificar restricciones
      if (descuento.restricciones.min_compra > monto_total) {
        return res.status(400).json({ 
          error: 'No se cumple el monto mínimo de compra',
          min_compra: descuento.restricciones.min_compra
        });
      }
      
      if (descuento.restricciones.paises_aplicables.length > 0 && 
          !descuento.restricciones.paises_aplicables.includes(pais)) {
        return res.status(400).json({ 
          error: 'El descuento no es válido para este país',
          paises_validos: descuento.restricciones.paises_aplicables
        });
      }
      
      let montoDescuento = 0;
      const tasas = await DescuentoController.obtenerTasasDeCambio();
      
      if (descuento.tipo === 'PORCENTAJE') {
        // Descuento porcentual directo
        montoDescuento = (monto_total * descuento.valor) / 100;
      } else if (descuento.tipo === 'MONTO_FIJO') {
        // Para monto fijo, convertir según la moneda de la transacción
        if (moneda_transaccion === descuento.moneda) {
          montoDescuento = descuento.valor;
        } else {
          // Convertir el monto fijo a la moneda de la transacción
          const tasaDestino = tasas[moneda_transaccion];
          const tasaOrigen = tasas[descuento.moneda];
          montoDescuento = descuento.valor * (tasaDestino / tasaOrigen);
        }
        
        // El descuento no puede ser mayor que el monto total
        montoDescuento = Math.min(montoDescuento, monto_total);
      }
      
      // Actualizar contador de usos
      await Descuento.findByIdAndUpdate(descuento._id, {
        $inc: { usos_actuales: 1 }
      });
      
      res.json({
        descuento_aplicado: true,
        monto_original: monto_total,
        monto_descuento: montoDescuento,
        monto_final: monto_total - montoDescuento,
        moneda: moneda_transaccion,
        descuento_id: descuento._id,
        descuento_codigo: descuento.codigo,
        descuento_tipo: descuento.tipo,
        descuento_valor: descuento.valor,
        descuento_moneda: descuento.moneda
      });
    } catch (error) {
      console.error('Error al aplicar descuento:', error);
      res.status(500).json({ error: 'Error al aplicar descuento', detalles: error.message });
    }
  },
  
  // Listar todos los descuentos
  async listarDescuentos(req, res) {
    try {
      const { activos_solo, aliado_id } = req.query;
      
      let filtro = {};
      
      if (activos_solo === 'true') {
        filtro.activo = true;
        filtro.fecha_expiracion = { $gte: new Date() };
      }
      
      if (aliado_id) {
        filtro.aliado_id = aliado_id;
      }
      
      const descuentos = await Descuento.find(filtro)
        .populate('aliado_id')
        .populate('creado_por')
        .sort({ fecha_creacion: -1 });
        
      res.json(descuentos);
    } catch (error) {
      console.error('Error al listar descuentos:', error);
      res.status(500).json({ error: 'Error al listar descuentos', detalles: error.message });
    }
  },
  
  // Desactivar un descuento
  async desactivarDescuento(req, res) {
    try {
      const { id } = req.params;
      
      const descuento = await Descuento.findByIdAndUpdate(id, 
        { activo: false },
        { new: true }
      );
      
      if (!descuento) {
        return res.status(404).json({ error: 'Descuento no encontrado' });
      }
      
      res.json({ mensaje: 'Descuento desactivado exitosamente', descuento });
    } catch (error) {
      console.error('Error al desactivar descuento:', error);
      res.status(500).json({ error: 'Error al desactivar descuento', detalles: error.message });
    }
  }
};

export default DescuentoController;