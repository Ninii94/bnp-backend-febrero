const API_BASE = '/api/certificados';

export const certificadosAPI = {
  // Fondos
  obtenerFondos: () => axios.get(`${API_BASE}/fondos`),
  activarFondo: (beneficiarioId, monto) => 
    axios.post(`${API_BASE}/fondos/activar`, { beneficiario_id: beneficiarioId, monto }),
  desactivarFondo: (beneficiarioId, motivo) => 
    axios.put(`${API_BASE}/fondos/desactivar/${beneficiarioId}`, { motivo }),
  
  // Medios de pago
  obtenerMediosPago: () => axios.get(`${API_BASE}/medios-pago`),
  crearMedioPago: (data) => axios.post(`${API_BASE}/medios-pago`, data),
  
  // Boletos
  obtenerBoletos: () => axios.get(`${API_BASE}/boletos`),
  crearBoleto: (formData) => 
    axios.post(`${API_BASE}/boletos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Para equipo
  obtenerSolicitudesRevision: () => axios.get(`${API_BASE}/boletos/revision`),
  procesarSolicitud: (boletoId, data) => 
    axios.put(`${API_BASE}/boletos/${boletoId}/procesar`, data),
};