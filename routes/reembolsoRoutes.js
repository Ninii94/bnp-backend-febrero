import express from 'express';
import { 
  crearCodigoReembolso,
  obtenerCodigoReembolso,
  cambiarEstadoCodigoReembolso,
  editarCodigoReembolso,
  eliminarCodigoReembolso,
  regenerarCodigoReembolso,
  verificarCodigoReembolso,
  aplicarCodigoReembolso,
  listarCodigosReembolso,
  obtenerHistorialCodigoReembolso,
  buscarBeneficiarios
} from '../controllers/reembolsoController.js';


import { checkAuth, isEquipoBNP } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas (sin autenticación)
router.get('/verificar/:codigo', verificarCodigoReembolso);

// Rutas protegidas
router.use(checkAuth);

// Ruta de búsqueda de usuarios 
router.get('/buscar-beneficiarios', isEquipoBNP, buscarBeneficiarios);

// Rutas para beneficiarios (compatibilidad con código existente)
router.post('/beneficiarios/:beneficiarioId', crearCodigoReembolso);
router.get('/beneficiarios/:beneficiarioId', obtenerCodigoReembolso);
router.put('/beneficiarios/:beneficiarioId', editarCodigoReembolso);
router.delete('/beneficiarios/:beneficiarioId', eliminarCodigoReembolso);
router.post('/beneficiarios/:beneficiarioId/regenerar', regenerarCodigoReembolso);
router.patch('/beneficiarios/:beneficiarioId/estado', cambiarEstadoCodigoReembolso);
router.get('/beneficiarios/:beneficiarioId/historial', obtenerHistorialCodigoReembolso);

// Rutas para usuarios (nuevas rutas para el componente GestionReembolsos)
router.post('/usuarios/:beneficiarioId', crearCodigoReembolso);
router.get('/usuarios/:beneficiarioId', obtenerCodigoReembolso);
router.put('/usuarios/:beneficiarioId', editarCodigoReembolso);
router.delete('/usuarios/:beneficiarioId', eliminarCodigoReembolso);
router.post('/usuarios/:beneficiarioId/regenerar', regenerarCodigoReembolso);
router.patch('/usuarios/:beneficiarioId/estado', cambiarEstadoCodigoReembolso);
router.get('/usuarios/:beneficiarioId/historial', obtenerHistorialCodigoReembolso);

// Rutas para administración
router.get('/', isEquipoBNP, listarCodigosReembolso);
router.post('/aplicar/:codigo', isEquipoBNP, aplicarCodigoReembolso);

export default router;