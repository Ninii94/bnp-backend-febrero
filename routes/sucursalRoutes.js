import express from 'express';
import { Sucursal } from '../models/Sucursal.js';
import { Usuario } from '../models/Usuario.js';

const router = express.Router();

router.get('/aliado/:aliadoId', async (req, res) => {
    try {
      console.log('Buscando sucursales para aliado:', req.params.aliadoId);
      const sucursales = await Sucursal.find({
        aliado_id: req.params.aliadoId,
        activo: true
      });
      
      console.log('Sucursales encontradas:', sucursales);
      res.json(sucursales);
    } catch (error) {
      console.error('Error al obtener sucursales:', error);
      res.status(500).json({
        message: 'Error al obtener sucursales',
        error: error.message
      });
    }
  });

router.get('/lista-nombres', async (req, res) => {
  try {
    const sucursales = await Sucursal.find({ activo: true })
      .select('_id nombre')
      .sort({ nombre: 1 });
    
    res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener lista de sucursales:', error);
    res.status(500).json({
      message: 'Error al obtener lista de sucursales',
      error: error.message
    });
  }
});

router.put('/actualizar', async (req, res) => {
  try {
    const { _id, direccion, telefono, correo } = req.body;
    
    if (!_id) {
      return res.status(400).json({ message: 'ID de sucursal es requerido' });
    }
    
    const updatedSucursal = await Sucursal.findByIdAndUpdate(
      _id,
      { direccion, telefono, correo },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!updatedSucursal) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }
    
    res.json(updatedSucursal);
  } catch (error) {
    res.status(500).json({
      message: 'Error al actualizar sucursal',
      error: error.message
    });
  }
});

export default router;