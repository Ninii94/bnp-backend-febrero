

class MetodosPagoService {
  constructor() {
    this.baseURL = '/api/metodos-pago';
  }

  // Obtener el token de autenticación
  getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  // Configurar headers para las peticiones
  getHeaders() {
    const token = this.getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  // Manejar respuestas de la API
  async handleResponse(response) {
    console.log('📡 Respuesta de API:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error en respuesta:', errorData);
      
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Datos recibidos:', data);
    return data;
  }

  // Obtener todos los métodos de pago del beneficiario
  async obtenerMetodos() {
    try {
      console.log('📋 === OBTENIENDO MÉTODOS DE PAGO ===');
      console.log('🔗 URL:', `${this.baseURL}/mis-metodos`);
      
      const response = await fetch(`${this.baseURL}/mis-metodos`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await this.handleResponse(response);
      
      console.log('✅ Métodos obtenidos:', data.metodosPago?.length || 0);
      return data.metodosPago || [];
      
    } catch (error) {
      console.error('❌ Error obteniendo métodos:', error);
      throw error;
    }
  }

  // Crear un nuevo método de pago
  async crearMetodo(datosMetodo) {
    try {
      console.log('📝 === CREANDO MÉTODO DE PAGO ===');
      console.log('🔗 URL:', `${this.baseURL}/crear`);
      console.log('📤 Datos a enviar:', datosMetodo);

      // Validar datos básicos
      if (!datosMetodo.nombre || !datosMetodo.tipo_cuenta || !datosMetodo.informacion_bancaria) {
        throw new Error('Datos incompletos: nombre, tipo_cuenta e informacion_bancaria son requeridos');
      }

      const response = await fetch(`${this.baseURL}/crear`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(datosMetodo),
      });

      const data = await this.handleResponse(response);
      
      console.log('✅ Método creado:', data.metodoPago?._id);
      return data.metodoPago;
      
    } catch (error) {
      console.error('❌ Error creando método:', error);
      throw error;
    }
  }

  // Actualizar un método de pago existente
  async actualizarMetodo(metodoId, datosActualizacion) {
    try {
      console.log('📝 === ACTUALIZANDO MÉTODO DE PAGO ===');
      console.log('🔗 URL:', `${this.baseURL}/${metodoId}`);
      console.log('📤 Datos a actualizar:', datosActualizacion);

      if (!metodoId) {
        throw new Error('ID del método es requerido');
      }

      const response = await fetch(`${this.baseURL}/${metodoId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(datosActualizacion),
      });

      const data = await this.handleResponse(response);
      
      console.log('✅ Método actualizado:', data.metodoPago?._id);
      return data.metodoPago;
      
    } catch (error) {
      console.error('❌ Error actualizando método:', error);
      throw error;
    }
  }

  // Eliminar un método de pago
  async eliminarMetodo(metodoId) {
    try {
      console.log('🗑️ === ELIMINANDO MÉTODO DE PAGO ===');
      console.log('🔗 URL:', `${this.baseURL}/${metodoId}`);

      if (!metodoId) {
        throw new Error('ID del método es requerido');
      }

      const response = await fetch(`${this.baseURL}/${metodoId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      const data = await this.handleResponse(response);
      
      console.log('✅ Método eliminado exitosamente');
      return data;
      
    } catch (error) {
      console.error('❌ Error eliminando método:', error);
      throw error;
    }
  }

  // Obtener un método específico
  async obtenerMetodo(metodoId) {
    try {
      console.log('🔍 === OBTENIENDO MÉTODO ESPECÍFICO ===');
      console.log('🔗 URL:', `${this.baseURL}/${metodoId}`);

      if (!metodoId) {
        throw new Error('ID del método es requerido');
      }

      const response = await fetch(`${this.baseURL}/${metodoId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await this.handleResponse(response);
      
      console.log('✅ Método obtenido:', data.metodoPago?._id);
      return data.metodoPago;
      
    } catch (error) {
      console.error('❌ Error obteniendo método:', error);
      throw error;
    }
  }

  // Validar datos de método antes de enviar
  validarDatosMetodo(datosMetodo) {
    const errores = [];

    // Validaciones básicas
    if (!datosMetodo.nombre?.trim()) {
      errores.push('El nombre del método es requerido');
    }

    if (!datosMetodo.tipo_cuenta) {
      errores.push('El tipo de cuenta es requerido');
    }

    if (!datosMetodo.informacion_bancaria) {
      errores.push('La información bancaria es requerida');
    } else {
      const info = datosMetodo.informacion_bancaria;

      // Validar titular
      if (!info.nombre_titular?.trim()) {
        errores.push('El nombre del titular es requerido');
      }
      if (!info.apellido_titular?.trim()) {
        errores.push('El apellido del titular es requerido');
      }

      // Validaciones específicas por tipo
      switch (datosMetodo.tipo_cuenta) {
        case 'cuenta_bancaria':
          if (!info.nombre_banco?.trim()) {
            errores.push('El nombre del banco es requerido para cuentas bancarias');
          }
          if (!info.numero_cuenta?.trim()) {
            errores.push('El número de cuenta es requerido para cuentas bancarias');
          }
          break;

        case 'paypal':
          if (!info.email_paypal?.trim()) {
            errores.push('El email de PayPal es requerido');
          } else if (!this.validarEmail(info.email_paypal)) {
            errores.push('El email de PayPal no es válido');
          }
          break;

        case 'zelle':
          if (!info.telefono_zelle?.trim() && !info.email_zelle?.trim()) {
            errores.push('Se requiere teléfono o email para Zelle');
          }
          if (info.email_zelle && !this.validarEmail(info.email_zelle)) {
            errores.push('El email de Zelle no es válido');
          }
          break;

        case 'wise':
          if (!info.email_wise?.trim()) {
            errores.push('El email de Wise es requerido');
          } else if (!this.validarEmail(info.email_wise)) {
            errores.push('El email de Wise no es válido');
          }
          break;

        case 'transferencia_internacional':
          if (!info.codigo_swift?.trim()) {
            errores.push('El código SWIFT es requerido para transferencias internacionales');
          }
          break;
      }
    }

    return errores;
  }

  // Validar formato de email
  validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Formatear método para mostrar
  formatearMetodoParaMostrar(metodo) {
    if (!metodo) return null;

    const info = metodo.informacion_bancaria || {};
    
    return {
      _id: metodo._id,
      nombre: metodo.nombre,
      tipo_cuenta: metodo.tipo_cuenta,
      titular: `${info.nombre_titular || ''} ${info.apellido_titular || ''}`.trim(),
      detalles: this.obtenerDetallesMetodo(metodo),
      activo: metodo.activo,
      fecha_creacion: metodo.fecha_creacion,
      veces_utilizado: metodo.veces_utilizado || 0
    };
  }

  // Obtener detalles específicos del método para mostrar
  obtenerDetallesMetodo(metodo) {
    const info = metodo.informacion_bancaria || {};
    
    switch (metodo.tipo_cuenta) {
      case 'cuenta_bancaria':
        return `${info.nombre_banco || 'Banco'} - •••${(info.numero_cuenta || '').slice(-4)}`;
      case 'paypal':
        return info.email_paypal || 'PayPal';
      case 'zelle':
        return info.telefono_zelle || info.email_zelle || 'Zelle';
      case 'wise':
        return info.email_wise || 'Wise';
      case 'transferencia_internacional':
        return info.codigo_swift || 'Transferencia Internacional';
      default:
        return 'Método de pago';
    }
  }
}

// Crear instancia singleton del servicio
const metodosPageService = new MetodosPagoService();

export default metodosPageService;