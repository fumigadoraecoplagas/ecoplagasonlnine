// Sistema de Logs de Seguridad - Eco Plagas
// Registra y monitorea intentos de acceso y actividades sospechosas

class SecurityLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Máximo de logs en memoria
        this.severityLevels = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            CRITICAL: 4
        };
    }

    // Obtener información del usuario/IP
    getUserInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer
        };
    }

    // Crear log de seguridad
    createLog(type, message, severity = 'MEDIUM', data = {}) {
        const log = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            type: type,
            message: message,
            severity: severity,
            severityLevel: this.severityLevels[severity],
            data: {
                ...this.getUserInfo(),
                ...data
            }
        };

        this.logs.push(log);
        
        // Mantener solo los logs más recientes
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Mostrar en consola para debugging
        this.logToConsole(log);

        return log;
    }

    // Generar ID único para el log
    generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Mostrar log en consola
    logToConsole(log) {
        const emoji = this.getSeverityEmoji(log.severity);
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        
        console.log(`${emoji} [${timestamp}] ${log.type}: ${log.message}`, log.data);
    }

    // Obtener emoji según severidad
    getSeverityEmoji(severity) {
        const emojis = {
            LOW: 'ℹ️',
            MEDIUM: '⚠️',
            HIGH: '🚨',
            CRITICAL: '🔥'
        };
        return emojis[severity] || '📝';
    }

    // Log de intento de login exitoso
    logLoginSuccess(username, userInfo = {}) {
        return this.createLog(
            'LOGIN_SUCCESS',
            `Login exitoso para usuario: ${username}`,
            'LOW',
            { username, ...userInfo }
        );
    }

    // Log de intento de login fallido
    logLoginFailure(username, reason, userInfo = {}) {
        return this.createLog(
            'LOGIN_FAILURE',
            `Login fallido para usuario: ${username} - Razón: ${reason}`,
            'MEDIUM',
            { username, reason, ...userInfo }
        );
    }

    // Log de intento de login (genérico - éxito o fallo)
    logLoginAttempt(username, success, status, data = {}) {
        if (success) {
            return this.logLoginSuccess(username, { status, ...data });
        } else {
            const reason = status || 'UNKNOWN';
            return this.logLoginFailure(username, reason, data);
        }
    }

    // Log de bloqueo por rate limiting
    logRateLimitBlock(identifier, type, attempts, userInfo = {}) {
        return this.createLog(
            'RATE_LIMIT_BLOCK',
            `Bloqueo por rate limiting - ${type}: ${identifier} (${attempts} intentos)`,
            'HIGH',
            { identifier, type, attempts, ...userInfo }
        );
    }

    // Log de intento de acceso no autorizado
    logUnauthorizedAccess(module, userInfo = {}) {
        return this.createLog(
            'UNAUTHORIZED_ACCESS',
            `Intento de acceso no autorizado al módulo: ${module}`,
            'HIGH',
            { module, ...userInfo }
        );
    }

    // Log de validación de entrada fallida
    logInputValidationFailure(input, errors, userInfo = {}) {
        return this.createLog(
            'INPUT_VALIDATION_FAILURE',
            `Validación de entrada fallida: ${errors.join(', ')}`,
            'MEDIUM',
            { input, errors, ...userInfo }
        );
    }

    // Log de actividad sospechosa
    logSuspiciousActivity(activity, details, userInfo = {}) {
        return this.createLog(
            'SUSPICIOUS_ACTIVITY',
            `Actividad sospechosa detectada: ${activity}`,
            'HIGH',
            { activity, details, ...userInfo }
        );
    }

    // Log de error de seguridad
    logSecurityError(error, context, userInfo = {}) {
        return this.createLog(
            'SECURITY_ERROR',
            `Error de seguridad: ${error.message}`,
            'CRITICAL',
            { error: error.message, stack: error.stack, context, ...userInfo }
        );
    }

    // Log de logout
    logLogout(username, userInfo = {}) {
        return this.createLog(
            'LOGOUT',
            `Logout del usuario: ${username}`,
            'LOW',
            { username, ...userInfo }
        );
    }

    // Log de cambio de contraseña
    logPasswordChange(username, userInfo = {}) {
        return this.createLog(
            'PASSWORD_CHANGE',
            `Cambio de contraseña para usuario: ${username}`,
            'MEDIUM',
            { username, ...userInfo }
        );
    }

    // Obtener logs por tipo
    getLogsByType(type) {
        return this.logs.filter(log => log.type === type);
    }

    // Obtener logs por severidad
    getLogsBySeverity(severity) {
        return this.logs.filter(log => log.severity === severity);
    }

    // Obtener logs recientes
    getRecentLogs(hours = 24) {
        const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
        return this.logs.filter(log => new Date(log.timestamp) > cutoff);
    }

    // Obtener estadísticas de seguridad
    getSecurityStats() {
        const recentLogs = this.getRecentLogs(24);
        
        return {
            totalLogs: this.logs.length,
            recentLogs: recentLogs.length,
            loginFailures: recentLogs.filter(log => log.type === 'LOGIN_FAILURE').length,
            rateLimitBlocks: recentLogs.filter(log => log.type === 'RATE_LIMIT_BLOCK').length,
            unauthorizedAccess: recentLogs.filter(log => log.type === 'UNAUTHORIZED_ACCESS').length,
            suspiciousActivity: recentLogs.filter(log => log.type === 'SUSPICIOUS_ACTIVITY').length,
            securityErrors: recentLogs.filter(log => log.type === 'SECURITY_ERROR').length,
            criticalLogs: recentLogs.filter(log => log.severity === 'CRITICAL').length,
            highSeverityLogs: recentLogs.filter(log => log.severity === 'HIGH').length
        };
    }

    // Exportar logs (para administradores)
    exportLogs(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'type', 'message', 'severity', 'username', 'ip'];
            const csvData = this.logs.map(log => [
                log.timestamp,
                log.type,
                log.message,
                log.severity,
                log.data.username || '',
                log.data.ip || ''
            ]);
            
            return [headers, ...csvData].map(row => row.join(',')).join('\n');
        }
        return this.logs;
    }

    // Limpiar logs antiguos
    cleanup(daysToKeep = 7) {
        const cutoff = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
        this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoff);
    }
}

// Crear instancia global
window.securityLogger = new SecurityLogger();

// Limpiar logs antiguos cada 24 horas
setInterval(() => {
    window.securityLogger.cleanup();
}, 24 * 60 * 60 * 1000);

console.log('🛡️ Security Logger cargado - Monitoreo de seguridad activo');
















