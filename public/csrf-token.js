// Sistema de Tokens CSRF - Eco Plagas
// Protege contra ataques Cross-Site Request Forgery

class CSRFProtection {
    constructor() {
        this.tokenKey = 'csrf_token';
        this.tokenExpiry = 24 * 60 * 60 * 1000; // 24 horas
        this.generateToken();
    }

    // Generar token CSRF único
    generateToken() {
        const existingToken = this.getStoredToken();
        
        // Si hay un token válido, usarlo
        if (existingToken && !this.isTokenExpired(existingToken)) {
            return existingToken.token;
        }
        
        // Generar nuevo token
        const token = this.createRandomToken();
        const tokenData = {
            token: token,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.tokenExpiry
        };
        
        // Guardar en sessionStorage (más seguro que localStorage)
        sessionStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
        
        return token;
    }

    // Crear token aleatorio
    createRandomToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Obtener token almacenado
    getStoredToken() {
        try {
            const stored = sessionStorage.getItem(this.tokenKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error obteniendo token CSRF:', e);
        }
        return null;
    }

    // Verificar si el token expiró
    isTokenExpired(tokenData) {
        return Date.now() > tokenData.expiresAt;
    }

    // Obtener token actual
    getToken() {
        const tokenData = this.getStoredToken();
        if (!tokenData || this.isTokenExpired(tokenData)) {
            return this.generateToken();
        }
        return tokenData.token;
    }

    // Validar token
    validateToken(token) {
        const storedToken = this.getStoredToken();
        
        if (!storedToken) {
            return false;
        }
        
        if (this.isTokenExpired(storedToken)) {
            // Token expirado, generar uno nuevo
            this.generateToken();
            return false;
        }
        
        return storedToken.token === token;
    }

    // Agregar token a un objeto de datos
    addTokenToData(data) {
        if (typeof data === 'object' && data !== null) {
            data._csrf = this.getToken();
        }
        return data;
    }

    // Agregar token a headers de fetch
    addTokenToHeaders(headers = {}) {
        headers['X-CSRF-Token'] = this.getToken();
        return headers;
    }

    // Limpiar token (al hacer logout)
    clearToken() {
        sessionStorage.removeItem(this.tokenKey);
    }

    // Verificar origen de la request
    validateOrigin() {
        const origin = window.location.origin;
        const referrer = document.referrer;
        
        // Si no hay referrer, es una navegación directa (OK)
        if (!referrer) {
            return true;
        }
        
        // Verificar que el referrer sea del mismo origen
        try {
            const referrerOrigin = new URL(referrer).origin;
            return referrerOrigin === origin;
        } catch (e) {
            // Si hay error parseando URL, denegar por seguridad
            return false;
        }
    }

    // Validar request completa (token + origen)
    validateRequest(token) {
        return this.validateToken(token) && this.validateOrigin();
    }
}

// Exportar clase a window para uso global
window.CSRFProtection = CSRFProtection;

// Crear instancia global
window.csrfProtection = new CSRFProtection();

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSRFProtection;
}

