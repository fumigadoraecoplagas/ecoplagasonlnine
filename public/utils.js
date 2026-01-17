// Utilidades centralizadas - Eco Plagas
// Funciones comunes para todo el sistema

// Formatear colones con separadores de miles sin decimales
function formatearColones(monto) {
    if (typeof monto !== 'number' || isNaN(monto)) {
        return '₡0';
    }
    
    // Redondear a número entero (sin decimales)
    const montoEntero = Math.round(monto);
    
    // Formatear con separadores de miles usando formato costarricense
    return `₡${montoEntero.toLocaleString('es-CR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    })}`;
}

// Formatear fecha para mostrar
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return fechaObj.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Formatear fecha y hora para mostrar
function formatearFechaHora(fecha) {
    if (!fecha) return 'N/A';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return fechaObj.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Formatear hora para mostrar
function formatearHora(fecha) {
    if (!fecha) return 'N/A';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return fechaObj.toLocaleTimeString('es-CR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Validar email
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Validar teléfono costarricense
function validarTelefono(telefono) {
    const regex = /^[0-9]{8}$/;
    return regex.test(telefono.replace(/\s/g, ''));
}

// Validar cédula costarricense
function validarCedula(cedula) {
    const regex = /^[0-9]{9}$/;
    return regex.test(cedula.replace(/\s/g, ''));
}

// Mostrar mensaje de error consistente
function mostrarMensaje(mensaje, tipo = 'info') {
    // Crear elemento de mensaje
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; min-width: 300px; max-width: 500px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);';
    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'danger' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            <span>${mensaje}</span>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Agregar al DOM
    document.body.appendChild(alertDiv);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.style.transition = 'opacity 0.5s ease-out';
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 500);
        }
    }, 5000);
}

// Validar formulario genérico
function validarFormulario(formulario, camposRequeridos = []) {
    const errores = [];
    
    camposRequeridos.forEach(campo => {
        const elemento = document.getElementById(campo);
        if (!elemento || !elemento.value.trim()) {
            errores.push(`El campo ${campo} es requerido`);
        }
    });
    
    if (errores.length > 0) {
        mostrarMensaje(errores.join('<br>'), 'warning');
        return false;
    }
    
    return true;
}

// Limpiar formulario
function limpiarFormulario(formularioId) {
    const formulario = document.getElementById(formularioId);
    if (formulario) {
        formulario.reset();
    }
}

// Convertir a minúsculas y trim
function normalizarTexto(texto) {
    return texto ? texto.toLowerCase().trim() : '';
}

// Generar ID único
function generarIdUnico() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce para búsquedas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Exportar funciones para uso global
window.formatearColones = formatearColones;
window.formatearFecha = formatearFecha;
window.formatearFechaHora = formatearFechaHora;
window.formatearHora = formatearHora;
window.validarEmail = validarEmail;
window.validarTelefono = validarTelefono;
window.validarCedula = validarCedula;
window.mostrarMensaje = mostrarMensaje;
window.validarFormulario = validarFormulario;
window.limpiarFormulario = limpiarFormulario;
window.normalizarTexto = normalizarTexto;
window.generarIdUnico = generarIdUnico;
window.debounce = debounce;
