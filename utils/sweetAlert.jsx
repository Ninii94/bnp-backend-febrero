import Swal from 'sweetalert2';

// Configuración global para SweetAlert2
const defaultSwalConfig = {
  allowOutsideClick: false,
  allowEscapeKey: false,
  backdrop: 'rgba(0, 0, 0, 0.6)',
  customClass: {
    container: 'swal-high-z',
    popup: 'swal-popup-high-z'
  },
  didOpen: () => {
    // Forzar z-index alto en caso de que sea necesario
    const container = document.querySelector('.swal2-container');
    const popup = document.querySelector('.swal2-popup');
    if (container) {
      container.style.zIndex = '99999';
      container.style.position = 'fixed';
    }
    if (popup) {
      popup.style.zIndex = '100000';
    }
  }
};

// Inyectar estilos CSS personalizados
const injectCustomStyles = () => {
  if (!document.getElementById('swal-custom-styles')) {
    const style = document.createElement('style');
    style.id = 'swal-custom-styles';
    style.textContent = `
      .swal-high-z {
        z-index: 99999 !important;
        position: fixed !important;
      }
      .swal-popup-high-z {
        z-index: 100000 !important;
      }
      .swal2-container {
        z-index: 99999 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      .swal2-popup {
        z-index: 100000 !important;
        position: relative !important;
      }
      .swal2-backdrop-show {
        background-color: rgba(0, 0, 0, 0.6) !important;
      }
    `;
    document.head.appendChild(style);
  }
};

// Ejecutar inyección de estilos
injectCustomStyles();

export const SweetAlert = {
  // Confirmación para acciones destructivas
  confirmarAccion: async (titulo, texto, tipoBoton = 'warning') => {
    const colores = {
      warning: '#f59e0b',
      danger: '#dc2626',
      success: '#059669',
      info: '#0284c7'
    };

    return await Swal.fire({
      ...defaultSwalConfig,
      title: titulo,
      text: texto,
      icon: tipoBoton === 'danger' ? 'warning' : tipoBoton,
      showCancelButton: true,
      confirmButtonColor: colores[tipoBoton],
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      background: '#ffffff',
      customClass: {
        ...defaultSwalConfig.customClass,
        popup: 'rounded-2xl shadow-2xl swal-popup-high-z',
        title: 'text-xl font-bold',
        content: 'text-gray-600',
        confirmButton: 'px-6 py-3 rounded-xl font-semibold',
        cancelButton: 'px-6 py-3 rounded-xl font-semibold'
      },
      buttonsStyling: false
    });
  },

  // Éxito
  exito: (titulo, texto = '') => {
    return Swal.fire({
      ...defaultSwalConfig,
      title: titulo,
      text: texto,
      icon: 'success',
      confirmButtonText: '¡Perfecto!',
      confirmButtonColor: '#059669',
      background: '#ffffff',
      customClass: {
        ...defaultSwalConfig.customClass,
        popup: 'rounded-2xl shadow-2xl border-2 border-green-200 swal-popup-high-z',
        title: 'text-2xl font-bold text-green-800',
        content: 'text-green-600',
        confirmButton: 'px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all duration-300'
      },
      buttonsStyling: false,
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: true,
      allowOutsideClick: true // Permitir cerrar éxito clickeando afuera
    });
  },

  // Error
  error: (titulo, texto = '') => {
    return Swal.fire({
      ...defaultSwalConfig,
      title: titulo,
      text: texto,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#dc2626',
      background: '#ffffff',
      customClass: {
        ...defaultSwalConfig.customClass,
        popup: 'rounded-2xl shadow-2xl border-2 border-red-200 swal-popup-high-z',
        title: 'text-2xl font-bold text-red-800',
        content: 'text-red-600',
        confirmButton: 'px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 transition-all duration-300'
      },
      buttonsStyling: false,
      allowOutsideClick: true // Permitir cerrar error clickeando afuera
    });
  },

  // Advertencia
  advertencia: (titulo, texto = '') => {
    return Swal.fire({
      ...defaultSwalConfig,
      title: titulo,
      text: texto,
      icon: 'warning',
      confirmButtonText: 'De acuerdo',
      confirmButtonColor: '#f59e0b',
      background: '#ffffff',
      customClass: {
        ...defaultSwalConfig.customClass,
        popup: 'rounded-2xl shadow-2xl border-2 border-yellow-200 swal-popup-high-z',
        title: 'text-2xl font-bold text-yellow-800',
        content: 'text-yellow-600',
        confirmButton: 'px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700 transition-all duration-300'
      },
      buttonsStyling: false,
      allowOutsideClick: true
    });
  },

  // Información
  info: (titulo, texto = '') => {
    return Swal.fire({
      ...defaultSwalConfig,
      title: titulo,
      text: texto,
      icon: 'info',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#0284c7',
      background: '#ffffff',
      customClass: {
        ...defaultSwalConfig.customClass,
        popup: 'rounded-2xl shadow-2xl border-2 border-blue-200 swal-popup-high-z',
        title: 'text-2xl font-bold text-blue-800',
        content: 'text-blue-600',
        confirmButton: 'px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transition-all duration-300'
      },
      buttonsStyling: false,
      allowOutsideClick: true
    });
  },

  // Toast notification
  toast: (titulo, tipo = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      customClass: {
        popup: 'rounded-2xl shadow-xl border-2',
        title: 'font-bold'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
        // Asegurar z-index alto para toast
        toast.style.zIndex = '99999';
      }
    });

    const colores = {
      success: 'border-green-200 bg-green-50',
      error: 'border-red-200 bg-red-50',
      warning: 'border-yellow-200 bg-yellow-50',
      info: 'border-blue-200 bg-blue-50'
    };

    return Toast.fire({
      icon: tipo,
      title: titulo,
      customClass: {
        popup: `rounded-2xl shadow-xl ${colores[tipo]}`,
        title: 'font-bold'
      }
    });
  },

  // Confirmación específica para fondos
  confirmarFondo: {
    bloquear: async (nombreBeneficiario) => {
      return await Swal.fire({
        ...defaultSwalConfig,
        title: '🔒 ¿Bloquear Fondo?',
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 text-lg">
              ¿Estás seguro de que deseas <strong class="text-red-600">bloquear</strong> el fondo de:
            </p>
            <div class="bg-gray-100 p-4 rounded-xl border-2 border-gray-300">
              <p class="font-bold text-xl text-gray-800">👤 ${nombreBeneficiario}</p>
            </div>
            <div class="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200">
              <p class="text-yellow-800 font-semibold">⚠️ Efectos del bloqueo:</p>
              <ul class="text-yellow-700 mt-2 space-y-1">
                <li>• El beneficiario no podrá usar el fondo</li>
                <li>• Se requerirá un monto para desbloquearlo</li>
                <li>• Las solicitudes pendientes no se procesarán</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '🔒 Sí, bloquear fondo',
        cancelButtonText: '❌ Cancelar',
        reverseButtons: true,
        customClass: {
          ...defaultSwalConfig.customClass,
          popup: 'rounded-2xl shadow-2xl max-w-2xl swal-popup-high-z',
          title: 'text-2xl font-bold text-red-800',
          htmlContainer: 'text-left',
          confirmButton: 'px-6 py-3 rounded-xl font-bold',
          cancelButton: 'px-6 py-3 rounded-xl font-bold'
        },
        buttonsStyling: false
      });
    },

    desbloquear: async (nombreBeneficiario) => {
      return await Swal.fire({
        ...defaultSwalConfig,
        title: '🔓 ¿Desbloquear Fondo?',
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 text-lg">
              ¿Estás seguro de que deseas <strong class="text-green-600">desbloquear</strong> el fondo de:
            </p>
            <div class="bg-gray-100 p-4 rounded-xl border-2 border-gray-300">
              <p class="font-bold text-xl text-gray-800">👤 ${nombreBeneficiario}</p>
            </div>
            <div class="bg-green-50 p-4 rounded-xl border-2 border-green-200">
              <p class="text-green-800 font-semibold">✅ Efectos del desbloqueo:</p>
              <ul class="text-green-700 mt-2 space-y-1">
                <li>• El fondo estará disponible nuevamente</li>
                <li>• El beneficiario podrá hacer solicitudes</li>
                <li>• Se restaurará el acceso completo</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '🔓 Sí, desbloquear fondo',
        cancelButtonText: '❌ Cancelar',
        reverseButtons: true,
        customClass: {
          ...defaultSwalConfig.customClass,
          popup: 'rounded-2xl shadow-2xl max-w-2xl swal-popup-high-z',
          title: 'text-2xl font-bold text-green-800',
          htmlContainer: 'text-left',
          confirmButton: 'px-6 py-3 rounded-xl font-bold',
          cancelButton: 'px-6 py-3 rounded-xl font-bold'
        },
        buttonsStyling: false
      });
    },

    renovar: async (nombreBeneficiario, montoRenovacion) => {
      return await Swal.fire({
        ...defaultSwalConfig,
        title: '🔄 ¿Renovar Fondo?',
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 text-lg">
              ¿Estás seguro de que deseas <strong class="text-blue-600">renovar</strong> el fondo de:
            </p>
            <div class="bg-gray-100 p-4 rounded-xl border-2 border-gray-300">
              <p class="font-bold text-xl text-gray-800">👤 ${nombreBeneficiario}</p>
            </div>
            <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
              <p class="text-blue-800 font-semibold">🔄 Efectos de la renovación:</p>
              <ul class="text-blue-700 mt-2 space-y-1">
                <li>• El saldo se restaurará a <strong>${montoRenovacion}</strong></li>
                <li>• Se extenderá por un año más</li>
                <li>• El estado volverá a "Activo"</li>
                <li>• Se reiniciará el período de vencimiento</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '🔄 Sí, renovar fondo',
        cancelButtonText: '❌ Cancelar',
        reverseButtons: true,
        customClass: {
          ...defaultSwalConfig.customClass,
          popup: 'rounded-2xl shadow-2xl max-w-2xl swal-popup-high-z',
          title: 'text-2xl font-bold text-blue-800',
          htmlContainer: 'text-left',
          confirmButton: 'px-6 py-3 rounded-xl font-bold',
          cancelButton: 'px-6 py-3 rounded-xl font-bold'
        },
        buttonsStyling: false
      });
    },

    desactivar: async (nombreBeneficiario) => {
      return await Swal.fire({
        ...defaultSwalConfig,
        title: '💤 ¿Desactivar Fondo?',
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 text-lg">
              ¿Estás seguro de que deseas <strong class="text-gray-600">desactivar</strong> el fondo de:
            </p>
            <div class="bg-gray-100 p-4 rounded-xl border-2 border-gray-300">
              <p class="font-bold text-xl text-gray-800">👤 ${nombreBeneficiario}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
              <p class="text-gray-800 font-semibold">💤 Efectos de la desactivación:</p>
              <ul class="text-gray-700 mt-2 space-y-1">
                <li>• El fondo quedará inactivo temporalmente</li>
                <li>• El saldo se preservará por defecto</li>
                <li>• Se puede reactivar posteriormente</li>
                <li>• No se podrán crear nuevas solicitudes</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6b7280',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '💤 Sí, desactivar fondo',
        cancelButtonText: '❌ Cancelar',
        reverseButtons: true,
        customClass: {
          ...defaultSwalConfig.customClass,
          popup: 'rounded-2xl shadow-2xl max-w-2xl swal-popup-high-z',
          title: 'text-2xl font-bold text-gray-800',
          htmlContainer: 'text-left',
          confirmButton: 'px-6 py-3 rounded-xl font-bold',
          cancelButton: 'px-6 py-3 rounded-xl font-bold'
        },
        buttonsStyling: false
      });
    },

    reactivar: async (nombreBeneficiario, saldoPreservado) => {
      return await Swal.fire({
        ...defaultSwalConfig,
        title: '⚡ ¿Reactivar Fondo?',
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 text-lg">
              ¿Estás seguro de que deseas <strong class="text-green-600">reactivar</strong> el fondo de:
            </p>
            <div class="bg-gray-100 p-4 rounded-xl border-2 border-gray-300">
              <p class="font-bold text-xl text-gray-800">👤 ${nombreBeneficiario}</p>
            </div>
            <div class="bg-green-50 p-4 rounded-xl border-2 border-green-200">
              <p class="text-green-800 font-semibold">⚡ Efectos de la reactivación:</p>
              <ul class="text-green-700 mt-2 space-y-1">
                <li>• El fondo volverá al estado "Activo"</li>
                <li>• Saldo disponible: <strong>${saldoPreservado}</strong></li>
                <li>• Se establecerá nueva fecha de vencimiento</li>
                <li>• Se habilitarán las solicitudes de reembolso</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '⚡ Sí, reactivar fondo',
        cancelButtonText: '❌ Cancelar',
        reverseButtons: true,
        customClass: {
          ...defaultSwalConfig.customClass,
          popup: 'rounded-2xl shadow-2xl max-w-2xl swal-popup-high-z',
          title: 'text-2xl font-bold text-green-800',
          htmlContainer: 'text-left',
          confirmButton: 'px-6 py-3 rounded-xl font-bold',
          cancelButton: 'px-6 py-3 rounded-xl font-bold'
        },
        buttonsStyling: false
      });
    }
  }
};

// 3. Exportar mensajes de éxito predefinidos
export const MensajesExito = {
  fondo: {
    bloqueado: '🔒 ¡Fondo bloqueado exitosamente!',
    desbloqueado: '🔓 ¡Fondo desbloqueado exitosamente!',
    renovado: '🔄 ¡Fondo renovado exitosamente!',
    desactivado: '💤 ¡Fondo desactivado exitosamente!',
    reactivado: '⚡ ¡Fondo reactivado exitosamente!',
    creado: '✨ ¡Nuevo fondo creado exitosamente!',
    actualizado: '📝 ¡Fondo actualizado exitosamente!'
  },
  general: {
    guardado: '💾 ¡Cambios guardados exitosamente!',
    eliminado: '🗑️ ¡Elemento eliminado exitosamente!',
    enviado: '📤 ¡Información enviada exitosamente!'
  }
};

// 4. Hook personalizado para usar SweetAlert
import { useCallback } from 'react';

export const useSweetAlert = () => {
  const mostrarExito = useCallback((titulo, texto = '') => {
    return SweetAlert.exito(titulo, texto);
  }, []);

  const mostrarError = useCallback((titulo, texto = '') => {
    return SweetAlert.error(titulo, texto);
  }, []);

  const mostrarAdvertencia = useCallback((titulo, texto = '') => {
    return SweetAlert.advertencia(titulo, texto);
  }, []);

  const mostrarInfo = useCallback((titulo, texto = '') => {
    return SweetAlert.info(titulo, texto);
  }, []);

  const mostrarToast = useCallback((titulo, tipo = 'success') => {
    return SweetAlert.toast(titulo, tipo);
  }, []);

  const confirmarAccion = useCallback(async (titulo, texto, tipo = 'warning') => {
    return await SweetAlert.confirmarAccion(titulo, texto, tipo);
  }, []);

  const mostrarConfirmacion = useCallback(async (titulo, texto) => {
    return await SweetAlert.confirmarAccion(titulo, texto, 'warning');
  }, []);

  const confirmarFondo = useCallback(SweetAlert.confirmarFondo, []);

  return {
    mostrarExito,
    mostrarError,
    mostrarAdvertencia,
    mostrarInfo,
    mostrarToast,
    confirmarAccion,
    mostrarConfirmacion, 
    confirmarFondo
  };
};