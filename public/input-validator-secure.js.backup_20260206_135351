// Sistema de Validación de Entrada para Módulos Secure - Eco Plagas
// Funciones helper específicas para validación de datos en módulos secure
// NO afecta sistema legacy

class InputValidatorSecure {
    constructor() {
        // Usar el InputValidator global si está disponible
        // InputValidator se carga desde input-validator.js y está en window.inputValidator
        this.validator = window.inputValidator;
        
        if (!this.validator) {
            console.warn('⚠️ InputValidator no está disponible. Cargando input-validator.js...');
            // Si no está disponible, intentar cargarlo
            const script = document.createElement('script');
            script.src = 'input-validator.js';
            script.onload = () => {
                this.validator = window.inputValidator;
                console.log('✅ InputValidator cargado');
            };
            document.head.appendChild(script);
        }
    }

    // Validar datos de ticket
    validateTicketData(data) {
        const errors = [];
        const sanitized = {};

        // Validar título
        if (data.titulo || data.title) {
            const title = data.titulo || data.title;
            const sanitizedTitle = this.validator.sanitizeStringSpecial(title);
            if (!sanitizedTitle || sanitizedTitle.length < 3) {
                errors.push('El título debe tener al menos 3 caracteres');
            } else {
                sanitized.titulo = sanitizedTitle;
                sanitized.title = sanitizedTitle;
            }
        } else {
            errors.push('El título es requerido');
        }

        // Validar descripción (opcional)
        if (data.descripcion || data.description) {
            const desc = data.descripcion || data.description;
            sanitized.descripcion = this.validator.sanitizeStringSpecial(desc);
            sanitized.description = sanitized.descripcion;
        }

        // Validar estado si existe
        if (data.estado || data.status) {
            const validStates = ['abierto', 'cerrado', 'en_proceso', 'pendiente', 'open', 'closed', 'in_progress', 'pending'];
            const estado = (data.estado || data.status).toLowerCase();
            if (validStates.includes(estado)) {
                sanitized.estado = estado;
                sanitized.status = estado;
            }
        }

        // Validar prioridad si existe
        if (data.prioridad || data.priority) {
            const validPriorities = ['baja', 'media', 'alta', 'urgente', 'low', 'medium', 'high', 'urgent'];
            const prioridad = (data.prioridad || data.priority).toLowerCase();
            if (validPriorities.includes(prioridad)) {
                sanitized.prioridad = prioridad;
                sanitized.priority = prioridad;
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    // Validar datos de cita
    validateCitaData(data) {
        const errors = [];
        const sanitized = {};

        // Validar fecha
        if (data.fecha) {
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (fechaRegex.test(data.fecha)) {
                sanitized.fecha = data.fecha;
            } else {
                errors.push('La fecha debe tener formato YYYY-MM-DD');
            }
        } else {
            errors.push('La fecha es requerida');
        }

        // Validar hora
        if (data.hora) {
            const horaRegex = /^\d{2}:\d{2}$/;
            if (horaRegex.test(data.hora)) {
                sanitized.hora = data.hora;
            } else {
                errors.push('La hora debe tener formato HH:MM');
            }
        } else {
            errors.push('La hora es requerida');
        }

        // Validar monto si existe
        if (data.monto !== undefined && data.monto !== null) {
            const monto = this.validator.sanitizeNumber(data.monto);
            if (monto >= 0) {
                sanitized.monto = monto;
            } else {
                errors.push('El monto debe ser un número positivo');
            }
        }

        // Validar cliente si existe
        if (data.cliente) {
            sanitized.cliente = this.validator.sanitizeString(data.cliente);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    // Validar datos de sesión de trabajo
    validateWorkSessionData(data) {
        const errors = [];
        const sanitized = {};

        // Validar username
        if (data.username) {
            const usernameValidation = this.validator.validateUsername(data.username);
            if (usernameValidation.valid) {
                sanitized.username = usernameValidation.sanitized;
            } else {
                errors.push(`Username: ${usernameValidation.message}`);
            }
        } else {
            errors.push('El username es requerido');
        }

        // Validar startTime (Timestamp) o fecha/horaInicio (formato antiguo)
        if (data.startTime) {
            // Formato nuevo: Timestamp
            sanitized.startTime = data.startTime;
        } else if (data.fecha && data.horaInicio) {
            // Formato antiguo: fecha y horaInicio
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            const horaRegex = /^\d{2}:\d{2}$/;
            if (fechaRegex.test(data.fecha)) {
                sanitized.fecha = data.fecha;
            } else {
                errors.push('La fecha debe tener formato YYYY-MM-DD');
            }
            if (horaRegex.test(data.horaInicio)) {
                sanitized.horaInicio = data.horaInicio;
            } else {
                errors.push('La hora de inicio debe tener formato HH:MM');
            }
        } else {
            errors.push('Se requiere startTime o fecha/horaInicio');
        }

        // Validar bodegaAPV si existe
        if (data.bodegaAPV) {
            sanitized.bodegaAPV = this.validator.sanitizeString(data.bodegaAPV);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    // Validar datos de inventario
    validateInventoryData(data) {
        const errors = [];
        const sanitized = {};

        // Validar producto
        if (data.productoId || data.producto) {
            sanitized.productoId = data.productoId || this.validator.sanitizeString(data.producto);
        } else {
            errors.push('El producto es requerido');
        }

        // Validar cantidad
        if (data.cantidad !== undefined && data.cantidad !== null) {
            const cantidad = this.validator.sanitizeNumber(data.cantidad);
            if (cantidad >= 0) {
                sanitized.cantidad = cantidad;
            } else {
                errors.push('La cantidad debe ser un número positivo');
            }
        } else {
            errors.push('La cantidad es requerida');
        }

        // Validar bodega si existe
        if (data.bodegaId || data.bodega) {
            sanitized.bodegaId = data.bodegaId || this.validator.sanitizeString(data.bodega);
        }

        // Validar tipo de movimiento si existe
        if (data.tipo) {
            const validTypes = ['entrada', 'salida', 'ajuste', 'transferencia', 'entrance', 'exit', 'adjustment', 'transfer'];
            const tipo = data.tipo.toLowerCase();
            if (validTypes.includes(tipo)) {
                sanitized.tipo = tipo;
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    // Validar datos de empleado (reutilizar del InputValidator)
    validateEmployeeData(data) {
        return this.validator.validateEmpleadoData(data);
    }

    // Validar datos de gasto
    validateGastoData(data) {
        const errors = [];
        const sanitized = {};

        // Validar monto
        if (data.monto !== undefined && data.monto !== null) {
            const monto = this.validator.sanitizeNumber(data.monto);
            if (monto > 0) {
                sanitized.monto = monto;
            } else {
                errors.push('El monto debe ser mayor a 0');
            }
        } else {
            errors.push('El monto es requerido');
        }

        // Validar descripción
        if (data.descripcion) {
            sanitized.descripcion = this.validator.sanitizeStringSpecial(data.descripcion);
        } else {
            errors.push('La descripción es requerida');
        }

        // Validar cuenta de gasto si existe
        if (data.cuentaGastoId || data.cuentaGasto) {
            sanitized.cuentaGastoId = data.cuentaGastoId || this.validator.sanitizeString(data.cuentaGasto);
        }

        // Validar fecha si existe
        if (data.fecha) {
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (fechaRegex.test(data.fecha)) {
                sanitized.fecha = data.fecha;
            } else {
                errors.push('La fecha debe tener formato YYYY-MM-DD');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }
}

// Exportar clase
window.InputValidatorSecure = InputValidatorSecure;

// Crear instancia global
window.inputValidatorSecure = new InputValidatorSecure();

console.log('🛡️ Input Validator Secure cargado - Validación de entrada para módulos secure activa');

