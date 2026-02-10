// ===========================================
// MIDDLEWARE DE VALIDACIÓN - middleware/validation.js
// ===========================================
import { body, validationResult } from 'express-validator';

// Middleware para validar contratos de equipo
export const validateContratoEquipo = [
  body('aliado_id')
    .optional() // Hacer opcional porque puede ser manual
    .isMongoId()
    .withMessage('ID del aliado debe ser un ObjectId válido'),
  
  body('contenido')
    .notEmpty()
    .withMessage('Contenido del contrato es requerido')
    .isLength({ min: 10 })
    .withMessage('El contenido debe tener al menos 10 caracteres'),
  
  body('tipo_contrato')
    .optional()
    .isIn(['equipo', 'alianza', 'servicio'])
    .withMessage('Tipo de contrato no válido'),
  
  body('estado')
    .optional()
    .isIn(['borrador', 'enviado', 'firmado', 'cancelado'])
    .withMessage('Estado no válido'),

  body('plantilla_usada')
    .optional()
    .isString()
    .withMessage('La plantilla usada debe ser un string'),

  body('notas')
    .optional()
    .isString()
    .withMessage('Las notas deben ser un string'),

  // Para datos de aliado manual
  body('datos_aliado_manual.nombre')
    .optional()
    .isString()
    .isLength({ min: 2 })
    .withMessage('El nombre del aliado manual debe tener al menos 2 caracteres'),

  body('datos_aliado_manual.correo')
    .optional()
    .isEmail()
    .withMessage('Email del aliado manual debe ser válido'),

  body('datos_aliado_manual.razon_social')
    .optional()
    .isString()
    .withMessage('La razón social debe ser un string'),

  body('datos_aliado_manual.ruc')
    .optional()
    .isString()
    .withMessage('El RUC debe ser un string'),

  // Middleware para manejar errores de validación
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    // Validación personalizada: debe tener aliado_id O datos_aliado_manual
    if (!req.body.aliado_id && !req.body.datos_aliado_manual) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un aliado_id o datos_aliado_manual'
      });
    }

    // Si tiene datos_aliado_manual, validar que tenga nombre y correo
    if (req.body.datos_aliado_manual) {
      const { nombre, correo } = req.body.datos_aliado_manual;
      if (!nombre || !correo) {
        return res.status(400).json({
          success: false,
          message: 'Para aliado manual, nombre y correo son requeridos'
        });
      }
    }

    next();
  }
];

// Middleware para validar actualización de contrato
export const validateUpdateContrato = [
  body('contenido')
    .optional()
    .isLength({ min: 10 })
    .withMessage('El contenido debe tener al menos 10 caracteres'),
  
  body('estado')
    .optional()
    .isIn(['borrador', 'enviado', 'firmado', 'cancelado'])
    .withMessage('Estado no válido'),

  body('notas')
    .optional()
    .isString()
    .withMessage('Las notas deben ser un string'),

  body('motivo_cambio')
    .optional()
    .isString()
    .withMessage('El motivo de cambio debe ser un string'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }
    next();
  }
];

// Middleware para validar envío a SignNow
export const validateSignNowSend = [
  body('email_mensaje')
    .optional()
    .isString()
    .isLength({ min: 10, max: 500 })
    .withMessage('El mensaje de email debe tener entre 10 y 500 caracteres'),

  body('fecha_vencimiento')
    .optional()
    .isISO8601()
    .withMessage('La fecha de vencimiento debe ser una fecha válida ISO8601'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    // Validar que la fecha de vencimiento sea futura
    if (req.body.fecha_vencimiento) {
      const fechaVencimiento = new Date(req.body.fecha_vencimiento);
      if (fechaVencimiento <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de vencimiento debe ser una fecha futura'
        });
      }
    }

    next();
  }
];

// Middleware para validar cancelación de contrato
export const validateCancelContrato = [
  body('motivo')
    .notEmpty()
    .withMessage('El motivo de cancelación es requerido')
    .isLength({ min: 5, max: 200 })
    .withMessage('El motivo debe tener entre 5 y 200 caracteres'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }
    next();
  }
];

// Middleware para validar parámetros de consulta
export const validateQueryParams = [
  (req, res, next) => {
    const { page, limit, estado, fecha_desde, fecha_hasta } = req.query;

    // Validar paginación
    if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro page debe ser un número entero mayor a 0'
      });
    }

    if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro limit debe ser un número entre 1 y 100'
      });
    }

    // Validar estado
    if (estado && !['borrador', 'enviado', 'firmado', 'cancelado'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
    }

    // Validar fechas
    if (fecha_desde && isNaN(Date.parse(fecha_desde))) {
      return res.status(400).json({
        success: false,
        message: 'fecha_desde debe ser una fecha válida'
      });
    }

    if (fecha_hasta && isNaN(Date.parse(fecha_hasta))) {
      return res.status(400).json({
        success: false,
        message: 'fecha_hasta debe ser una fecha válida'
      });
    }

    // Validar que fecha_desde sea anterior a fecha_hasta
    if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
      return res.status(400).json({
        success: false,
        message: 'fecha_desde debe ser anterior a fecha_hasta'
      });
    }

    next();
  }
];

// Middleware para validar ObjectId en parámetros de ruta
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: `Parámetro ${paramName} es requerido`
      });
    }

    // Validar formato de ObjectId de MongoDB
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: `${paramName} debe ser un ObjectId válido de MongoDB`
      });
    }

    next();
  };
};

// Middleware genérico para logs de validación
export const logValidation = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Validación:', {
      method: req.method,
      path: req.path,
      body: req.body,
      params: req.params,
      query: req.query
    });
  }
  next();
};

export default validateContratoEquipo;