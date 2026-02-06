// Sistema de Rate Limiting - Eco Plagas
// Protege contra ataques de fuerza bruta

class RateLimiter {
    constructor() {
        this.attempts = new Map(); // Almacena intentos por IP/usuario
        this.maxAttempts = 5; // Máximo de intentos
        this.windowMs = 15 * 60 * 1000; // Ventana de tiempo: 15 minutos
        this.lockoutMs = 30 * 60 * 1000; // Bloqueo: 30 minutos
    }

    // Generar clave única para el intento
    generateKey(identifier, type = 'ip') {
        return `${type}:${identifier}`;
    }

    // Verificar si el usuario/IP puede hacer un intento
    canAttempt(identifier, type = 'ip') {
        const key = this.generateKey(identifier, type);
        const now = Date.now();
        
        // Obtener intentos existentes
        let attempts = this.attempts.get(key) || [];
        
        // Limpiar intentos antiguos (fuera de la ventana de tiempo)
        attempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
        
        // Verificar si está bloqueado
        if (attempts.length >= this.maxAttempts) {
            const lastAttempt = Math.max(...attempts);
            const timeSinceLastAttempt = now - lastAttempt;
            
            if (timeSinceLastAttempt < this.lockoutMs) {
                const remainingTime = Math.ceil((this.lockoutMs - timeSinceLastAttempt) / 1000 / 60);
                return {
                    allowed: false,
                    reason: 'blocked',
                    remainingMinutes: remainingTime,
                    attempts: attempts.length
                };
            } else {
                // Resetear intentos si el bloqueo expiró
                attempts = [];
            }
        }
        
        // Guardar intentos actualizados
        this.attempts.set(key, attempts);
        
        return {
            allowed: true,
            attempts: attempts.length,
            remainingAttempts: this.maxAttempts - attempts.length
        };
    }

    // Registrar un intento (exitoso o fallido)
    recordAttempt(identifier, type = 'ip', success = false) {
        const key = this.generateKey(identifier, type);
        const now = Date.now();
        
        let attempts = this.attempts.get(key) || [];
        
        if (success) {
            // Si es exitoso, limpiar todos los intentos
            attempts = [];
        } else {
            // Si es fallido, agregar el intento
            attempts.push(now);
        }
        
        this.attempts.set(key, attempts);
        
        return {
            attempts: attempts.length,
            remainingAttempts: this.maxAttempts - attempts.length
        };
    }

    // Obtener estadísticas de un usuario/IP
    getStats(identifier, type = 'ip') {
        const key = this.generateKey(identifier, type);
        const attempts = this.attempts.get(key) || [];
        const now = Date.now();
        
        // Filtrar intentos recientes
        const recentAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
        
        return {
            attempts: recentAttempts.length,
            remainingAttempts: this.maxAttempts - recentAttempts.length,
            isBlocked: recentAttempts.length >= this.maxAttempts,
            lastAttempt: attempts.length > 0 ? new Date(Math.max(...attempts)) : null
        };
    }

    // Limpiar intentos antiguos (mantenimiento)
    cleanup() {
        const now = Date.now();
        for (const [key, attempts] of this.attempts.entries()) {
            const recentAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
            if (recentAttempts.length === 0) {
                this.attempts.delete(key);
            } else {
                this.attempts.set(key, recentAttempts);
            }
        }
    }

    // Obtener todas las estadísticas (para administradores)
    getAllStats() {
        const stats = {};
        for (const [key, attempts] of this.attempts.entries()) {
            const now = Date.now();
            const recentAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
            stats[key] = {
                attempts: recentAttempts.length,
                isBlocked: recentAttempts.length >= this.maxAttempts,
                lastAttempt: attempts.length > 0 ? new Date(Math.max(...attempts)) : null
            };
        }
        return stats;
    }
}

// Crear instancia global
window.rateLimiter = new RateLimiter();

// Limpiar intentos antiguos cada 5 minutos
setInterval(() => {
    window.rateLimiter.cleanup();
}, 5 * 60 * 1000);

console.log('🛡️ Rate Limiter cargado - Protección contra fuerza bruta activa');






















