// Sistema de Validación de Entrada - Eco Plagas
// Sanitiza y valida todos los inputs del usuario

class InputValidator {
    constructor() {
        this.patterns = {
            username: /^[a-zA-Z0-9._-]{3,30}$/,
            password: /^.{6,50}$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^[\d\s\-\+\(\)]{7,15}$/,
            cedula: /^\d{9,20}$/,
            name: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/,
            alphanumeric: /^[a-zA-Z0-9\s]{1,100}$/,
            numeric: /^\d+$/,
            decimal: /^\d+(\.\d{1,2})?$/
        };
    }

    // Sanitizar string básico
    sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim() // Eliminar espacios al inicio y final
            .replace(/[<>]/g, '') // Eliminar caracteres HTML básicos
            .replace(/['"]/g, '') // Eliminar comillas
            .replace(/[;]/g, '') // Eliminar punto y coma
            .replace(/[()]/g, '') // Eliminar paréntesis
            .replace(/[{}]/g, '') // Eliminar llaves
            .replace(/[\[\]]/g, '') // Eliminar corchetes
            .replace(/[\\]/g, '') // Eliminar barras invertidas
            .replace(/[\/]/g, '') // Eliminar barras normales
            .replace(/[|]/g, '') // Eliminar pipes
            .replace(/[&]/g, '') // Eliminar ampersands
            .replace(/[=]/g, '') // Eliminar signos igual
            .replace(/[+]/g, '') // Eliminar signos más
            .replace(/[%]/g, '') // Eliminar porcentajes
            .replace(/[#]/g, '') // Eliminar numerales
            .replace(/[!]/g, '') // Eliminar exclamaciones
            .replace(/[@]/g, '') // Eliminar arrobas
            .replace(/[$]/g, '') // Eliminar signos de dólar
            .replace(/[^]/g, '') // Eliminar acentos circunflejos
            .replace(/[~]/g, '') // Eliminar tildes
            .replace(/[`]/g, '') // Eliminar backticks
            .replace(/[?]/g, '') // Eliminar signos de pregunta
            .replace(/[,]/g, '') // Eliminar comas
            .replace(/[0-9]/g, '') // Eliminar números (para nombres)
            .substring(0, 100); // Limitar longitud
    }

    // Sanitizar string manteniendo caracteres especiales necesarios
    sanitizeStringSpecial(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Eliminar caracteres HTML básicos
            .replace(/[;]/g, '') // Eliminar punto y coma
            .replace(/[{}]/g, '') // Eliminar llaves
            .replace(/[\[\]]/g, '') // Eliminar corchetes
            .replace(/[\\]/g, '') // Eliminar barras invertidas
            .replace(/[|]/g, '') // Eliminar pipes
            .replace(/[&]/g, '') // Eliminar ampersands
            .replace(/[=]/g, '') // Eliminar signos igual
            .replace(/[+]/g, '') // Eliminar signos más
            .replace(/[%]/g, '') // Eliminar porcentajes
            .replace(/[#]/g, '') // Eliminar numerales
            .replace(/[!]/g, '') // Eliminar exclamaciones
            .replace(/[$]/g, '') // Eliminar signos de dólar
            .replace(/[^]/g, '') // Eliminar acentos circunflejos
            .replace(/[~]/g, '') // Eliminar tildes
            .replace(/[`]/g, '') // Eliminar backticks
            .replace(/[?]/g, '') // Eliminar signos de pregunta
            .substring(0, 200); // Limitar longitud
    }

    // Sanitizar username (mantiene puntos, guiones, guiones bajos y caracteres con tilde)
    sanitizeUsername(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim()
            .toLowerCase() // Convertir a minúsculas
            .normalize('NFD') // Normalizar caracteres Unicode (separar tildes)
            .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos (tildes) pero mantener la letra base
            .replace(/[^a-zA-Z0-9._-]/g, '') // Solo permitir alfanuméricos, puntos, guiones y guiones bajos
            .substring(0, 30); // Limitar longitud
    }

    // Sanitizar número
    sanitizeNumber(input) {
        if (typeof input === 'number') return input;
        if (typeof input !== 'string') return 0;
        
        const cleaned = input.replace(/[^0-9.-]/g, '');
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    // Sanitizar email
    sanitizeEmail(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim()
            .toLowerCase()
            .replace(/[^a-zA-Z0-9@._-]/g, '')
            .substring(0, 100);
    }

    // Validar patrón
    validatePattern(input, pattern) {
        if (typeof input !== 'string') return false;
        return this.patterns[pattern] ? this.patterns[pattern].test(input) : false;
    }

    // Validar username
    validateUsername(username) {
        const sanitized = this.sanitizeUsername(username);
        return {
            valid: this.validatePattern(sanitized, 'username'),
            sanitized: sanitized,
            message: this.validatePattern(sanitized, 'username') ? 
                'Username válido' : 
                'Username debe tener 3-30 caracteres alfanuméricos, puntos, guiones o guiones bajos'
        };
    }

    // Validar contraseña
    validatePassword(password) {
        if (typeof password !== 'string') {
            return {
                valid: false,
                sanitized: '',
                message: 'Contraseña requerida'
            };
        }

        const sanitized = password.trim();
        const length = sanitized.length;
        
        return {
            valid: length >= 6 && length <= 50,
            sanitized: sanitized,
            message: length < 6 ? 
                'Contraseña debe tener al menos 6 caracteres' :
                length > 50 ?
                'Contraseña no puede tener más de 50 caracteres' :
                'Contraseña válida'
        };
    }

    // Validar nombre
    validateName(name) {
        const sanitized = this.sanitizeString(name);
        return {
            valid: this.validatePattern(sanitized, 'name'),
            sanitized: sanitized,
            message: this.validatePattern(sanitized, 'name') ? 
                'Nombre válido' : 
                'Nombre debe tener 2-50 caracteres alfabéticos'
        };
    }

    // Validar cédula
    validateCedula(cedula) {
        const sanitized = cedula.toString().replace(/[^0-9]/g, '');
        return {
            valid: this.validatePattern(sanitized, 'cedula'),
            sanitized: sanitized,
            message: this.validatePattern(sanitized, 'cedula') ? 
                'Cédula válida' : 
                'Cédula debe tener 9-20 dígitos'
        };
    }

    // Validar email
    validateEmail(email) {
        const sanitized = this.sanitizeEmail(email);
        return {
            valid: this.validatePattern(sanitized, 'email'),
            sanitized: sanitized,
            message: this.validatePattern(sanitized, 'email') ? 
                'Email válido' : 
                'Email debe tener formato válido'
        };
    }

    // Validar teléfono
    validatePhone(phone) {
        const sanitized = phone.toString().replace(/[^0-9\s\-\+\(\)]/g, '');
        return {
            valid: this.validatePattern(sanitized, 'phone'),
            sanitized: sanitized,
            message: this.validatePattern(sanitized, 'phone') ? 
                'Teléfono válido' : 
                'Teléfono debe tener 7-15 caracteres numéricos'
        };
    }

    // Validar datos de empleado
    validateEmpleadoData(data) {
        const errors = [];
        const sanitized = {};

        // Validar nombre
        const nombreValidation = this.validateName(data.primerNombre);
        if (!nombreValidation.valid) errors.push(`Primer nombre: ${nombreValidation.message}`);
        sanitized.primerNombre = nombreValidation.sanitized;

        // Validar apellido
        const apellidoValidation = this.validateName(data.primerApellido);
        if (!apellidoValidation.valid) errors.push(`Primer apellido: ${apellidoValidation.message}`);
        sanitized.primerApellido = apellidoValidation.sanitized;

        // Validar cédula
        const cedulaValidation = this.validateCedula(data.cedula);
        if (!cedulaValidation.valid) errors.push(`Cédula: ${cedulaValidation.message}`);
        sanitized.cedula = cedulaValidation.sanitized;

        // Validar teléfono si existe
        if (data.telefonoPersonal) {
            const phoneValidation = this.validatePhone(data.telefonoPersonal);
            if (!phoneValidation.valid) errors.push(`Teléfono: ${phoneValidation.message}`);
            sanitized.telefonoPersonal = phoneValidation.sanitized;
        }

        // Validar email si existe
        if (data.correoPersonal) {
            const emailValidation = this.validateEmail(data.correoPersonal);
            if (!emailValidation.valid) errors.push(`Email: ${emailValidation.message}`);
            sanitized.correoPersonal = emailValidation.sanitized;
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    // Validar datos de login
    validateLoginData(username, password) {
        const usernameValidation = this.validateUsername(username);
        const passwordValidation = this.validatePassword(password);

        return {
            valid: usernameValidation.valid && passwordValidation.valid,
            username: usernameValidation,
            password: passwordValidation,
            errors: [
                ...(usernameValidation.valid ? [] : [usernameValidation.message]),
                ...(passwordValidation.valid ? [] : [passwordValidation.message])
            ]
        };
    }
}

// Crear instancia global
window.inputValidator = new InputValidator();

console.log('🛡️ Input Validator cargado - Validación de entrada activa');
