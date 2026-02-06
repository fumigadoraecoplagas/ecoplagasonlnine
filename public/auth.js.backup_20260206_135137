// Sistema de Autenticación Eco Plagas
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuración de Firebase
const firebaseConfig = {
    projectId: "cursorwebapp-f376d",
    appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
    databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
    storageBucket: "cursorwebapp-f376d.firebasestorage.app",
    apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
    authDomain: "cursorwebapp-f376d.firebaseapp.com",
    messagingSenderId: "719990096116",
    measurementId: "G-DJXLKFR7CD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.loadUserFromStorage();
    }

    // Cargar usuario desde localStorage
    loadUserFromStorage() {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
            } catch (e) {
                console.error('Error parsing stored user:', e);
                localStorage.removeItem('currentUser');
            }
        }
    }

    // Guardar usuario en localStorage
    saveUserToStorage() {
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }

    // Verificar si hay un usuario autenticado
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Login del usuario
    async login(username, password) {
        try {
            console.log(`🔐 Intentando login para: ${username}`);
            
            // Validar entrada
            const validation = window.inputValidator ? window.inputValidator.validateLoginData(username, password) : { valid: true, username: { sanitized: username }, password: { sanitized: password }, errors: [] };
            if (!validation.valid) {
                if (window.securityLogger && typeof window.securityLogger.logInputValidationFailure === 'function') {
                    window.securityLogger.logInputValidationFailure(
                        { username, password: '***' }, 
                        validation.errors
                    );
                }
                return { success: false, error: validation.errors.join(', ') };
            }

            // Aplicar sanitización
            username = validation.username.sanitized;
            // La contraseña solo se trimea, no se modifica de otra manera (case-sensitive)
            password = validation.password.sanitized;
            
            // Verificar rate limiting
            const rateLimitCheck = window.rateLimiter ? window.rateLimiter.canAttempt(username, 'user') : { allowed: true };
            if (!rateLimitCheck.allowed) {
                if (window.securityLogger && typeof window.securityLogger.logRateLimitBlock === 'function') {
                    window.securityLogger.logRateLimitBlock(
                        username, 
                        'user', 
                        rateLimitCheck.attempts
                    );
                }
                return { 
                    success: false, 
                    error: `Demasiados intentos. Intenta nuevamente en ${rateLimitCheck.remainingMinutes} minutos` 
                };
            }
            
            // Validar que se proporcionen credenciales
            if (!username || !password) {
                if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                    window.rateLimiter.recordAttempt(username, 'user', false);
                }
                if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                    window.securityLogger.logLoginFailure(username, 'Credenciales vacías');
                }
                return { success: false, error: 'Usuario y contraseña son requeridos' };
            }

            // Buscar empleado en la base de datos
            // TEMPORAL: Usar query alternativa debido a problema de índices de Firestore
            const empleadosRef = collection(db, 'empleados');
            const querySnapshot = await getDocs(empleadosRef);
            
            // Filtrar en el cliente debido a problema de índices
            const empleados = [];
            querySnapshot.forEach(doc => {
                empleados.push({ id: doc.id, ...doc.data() });
            });
            
            // Normalizar username para comparación (eliminar tildes)
            const normalizeUsername = (str) => {
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };
            
            const usernameNormalized = normalizeUsername(username);
            const empleadoEncontrado = empleados.find(emp => {
                const empUsernameNormalized = normalizeUsername(emp.username || '');
                return empUsernameNormalized === usernameNormalized;
            });

            if (!empleadoEncontrado) {
                console.log(`❌ Usuario no encontrado: ${username}`);
                if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                    window.rateLimiter.recordAttempt(username, 'user', false);
                }
                if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                    window.securityLogger.logLoginFailure(username, 'Usuario no encontrado');
                }
                return { success: false, error: 'Usuario no encontrado en el sistema' };
            }

            // Usar el empleado encontrado
            const empleadoData = empleadoEncontrado;

            // Verificar si el empleado está activo (solo "Activo" permite login)
            const estadoEmpleado = empleadoData.estado || empleadoData.activo;
            if (estadoEmpleado !== 'Activo' && estadoEmpleado !== 'activo' && estadoEmpleado !== true) {
                console.log(`🚫 Usuario no activo: ${username} - Estado: ${estadoEmpleado}`);
                if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                    window.rateLimiter.recordAttempt(username, 'user', false);
                }
                if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                    window.securityLogger.logLoginFailure(username, `Usuario no activo - Estado: ${estadoEmpleado}`);
                }
                const mensajeError = estadoEmpleado === 'Inactivo' || estadoEmpleado === 'inactivo' 
                    ? 'Tu cuenta ha sido desactivada. Contacta al administrador.'
                    : `Tu cuenta está ${estadoEmpleado}. Contacta al administrador.`;
                return { success: false, error: mensajeError };
            }

            // Validar que el empleado tenga una contraseña configurada
            if (!empleadoData.password) {
                console.log(`❌ Usuario sin contraseña configurada: ${username}`);
                if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                    window.rateLimiter.recordAttempt(username, 'user', false);
                }
                if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                    window.securityLogger.logLoginFailure(username, 'Usuario sin contraseña configurada');
                }
                return { success: false, error: 'Error de configuración: Usuario sin contraseña. Contacta al administrador.' };
            }

            // Verificar contraseña (soporte para contraseñas encriptadas y no encriptadas)
            const passwordMatch = await this.verifyPassword(password, empleadoData.password);
            if (!passwordMatch) {
                console.log(`❌ Contraseña incorrecta para: ${username}`);
                if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                    window.rateLimiter.recordAttempt(username, 'user', false);
                }
                if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                    window.securityLogger.logLoginFailure(username, 'Contraseña incorrecta');
                }
                return { success: false, error: 'Contraseña incorrecta' };
            }

            // Login exitoso
            this.currentUser = {
                id: empleadoData.username, // ✅ Usar username como ID de referencia
                username: empleadoData.username,
                nombre: `${empleadoData.primerNombre} ${empleadoData.primerApellido}`,
                cedula: empleadoData.cedula,
                tipoContrato: empleadoData.tipoContrato || 'Mensual',
            permisos: empleadoData.permisos || {
                ventas: true,
                calendario: true,
                empleados: false,
                registro_horas: true,
                edicion_horas: false,
                operario_bodega: false,
                administrador_bodega: false,
                tickets: true,
                reportes_gerenciales: false,
            },
                loginTime: new Date().toISOString()
            };

            this.saveUserToStorage();
            
            // Registrar login exitoso
            if (window.rateLimiter && typeof window.rateLimiter.recordAttempt === 'function') {
                window.rateLimiter.recordAttempt(username, 'user', true);
            }
            if (window.securityLogger && typeof window.securityLogger.logLoginSuccess === 'function') {
                window.securityLogger.logLoginSuccess(username, { 
                    nombre: this.currentUser.nombre,
                    permisos: Object.keys(this.currentUser.permisos).filter(p => this.currentUser.permisos[p])
                });
            }
            
            console.log(`✅ Login exitoso: ${this.currentUser.nombre} (${username})`);
            console.log('🔐 Permisos del usuario:', this.currentUser.permisos);
            console.log('🎫 Permiso tickets específico:', this.currentUser.permisos?.tickets);
            return { success: true, user: this.currentUser };

        } catch (error) {
            console.error('❌ Error en login:', error);
            // Registrar error en security logger si está disponible
            if (window.securityLogger && typeof window.securityLogger.logLoginFailure === 'function') {
                window.securityLogger.logLoginFailure(username || 'desconocido', `Error interno: ${error.message || error}`);
            }
            return { success: false, error: 'Error interno del servidor. Intenta nuevamente' };
        }
    }

    // Logout del usuario
    logout() {
        const username = this.currentUser ? this.currentUser.username : 'desconocido';
        
        // Verificar si securityLogger está disponible
        if (window.securityLogger && typeof window.securityLogger.logLogout === 'function') {
            window.securityLogger.logLogout(username);
        }
        
        this.currentUser = null;
        this.saveUserToStorage();
        window.location.href = 'login.html';
    }

    // Verificar permisos de módulo
    hasPermission(module) {
        if (!this.currentUser) return false;
        return this.currentUser.permisos && this.currentUser.permisos[module] === true;
    }

    // Refrescar permisos del usuario desde Firestore
    async refreshUserPermissions() {
        if (!this.currentUser || !this.currentUser.username) {
            return false;
        }

        try {
            console.log('🔄 Refrescando permisos para:', this.currentUser.username);
            
            // Buscar empleado en Firestore
            const empleadosRef = collection(db, 'empleados');
            const querySnapshot = await getDocs(empleadosRef);
            
            // Normalizar username para comparación
            const normalizeUsername = (str) => {
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };
            
            const usernameNormalized = normalizeUsername(this.currentUser.username);
            let empleadoEncontrado = null;
            
            querySnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                const empUsernameNormalized = normalizeUsername(emp.username || '');
                if (empUsernameNormalized === usernameNormalized) {
                    empleadoEncontrado = emp;
                }
            });

            if (!empleadoEncontrado) {
                console.warn('⚠️ Usuario no encontrado al refrescar permisos');
                return false;
            }

            // Verificar si el empleado sigue activo
            const estadoEmpleado = empleadoEncontrado.estado || empleadoEncontrado.activo;
            if (estadoEmpleado !== 'Activo' && estadoEmpleado !== 'activo' && estadoEmpleado !== true) {
                console.log('🚫 Usuario desactivado, cerrando sesión');
                this.logout();
                return false;
            }

            // Actualizar permisos del usuario actual
            const permisosActualizados = empleadoEncontrado.permisos || {};
            this.currentUser.permisos = permisosActualizados;
            
            // Actualizar también otros datos que puedan haber cambiado
            this.currentUser.nombre = `${empleadoEncontrado.primerNombre} ${empleadoEncontrado.primerApellido}`;
            this.currentUser.cedula = empleadoEncontrado.cedula;
            this.currentUser.tipoContrato = empleadoEncontrado.tipoContrato || 'Mensual';
            
            // Guardar en localStorage
            this.saveUserToStorage();
            
            console.log('✅ Permisos actualizados:', permisosActualizados);
            return true;
            
        } catch (error) {
            console.error('❌ Error refrescando permisos:', error);
            return false;
        }
    }

    // Verificar contraseña (soporte para contraseñas encriptadas y no encriptadas)
    async verifyPassword(inputPassword, storedPassword) {
        // Validar que ambos parámetros existan
        if (!inputPassword || !storedPassword) {
            console.error('Error: Contraseña de entrada o almacenada es null/undefined');
            return false;
        }

        // Si la contraseña almacenada no está encriptada, comparar directamente (case-sensitive)
        if (!storedPassword.startsWith('bcrypt_')) {
            return inputPassword === storedPassword;
        }
        
        // Si está encriptada, verificar usando el mismo algoritmo de hash
        try {
            const hashedInput = await this.hashPassword(inputPassword);
            return hashedInput === storedPassword;
        } catch (error) {
            console.error('Error verificando contraseña encriptada:', error);
            return false;
        }
    }

    // Función para generar hash de contraseña (mismo algoritmo que el script de migración)
    async hashPassword(password) {
        // Simulación de bcrypt - en producción usarías: const bcrypt = require('bcrypt');
        // return await bcrypt.hash(password, 10);
        
        // Por ahora, usamos una función simple de hash para demostración
        // En producción, DEBES usar bcrypt real
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'ecoplagas_salt_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return 'bcrypt_' + hashHex; // Prefijo para identificar contraseñas encriptadas
    }
}

// Crear instancia global
window.authManager = new AuthManager();

// Exportar para uso en módulos
export { AuthManager };

// Funciones de utilidad globales
function requirePermission(module) {
    if (!window.authManager.hasPermission(module)) {
        alert(`No tienes permisos para acceder al módulo: ${module}`);
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function showUserInfo() {
    const userInfoElements = document.querySelectorAll('.user-info, #mobile-user-info');
    if (window.authManager.isAuthenticated()) {
        const user = window.authManager.getCurrentUser();
        userInfoElements.forEach(el => {
            el.innerHTML = `<i class="fas fa-user me-2"></i>${user.nombre}`;
        });
    } else {
        userInfoElements.forEach(el => {
            el.innerHTML = '<i class="fas fa-user me-2"></i>No autenticado';
        });
    }
}

function addLogoutButton() {
    const logoutButtons = document.querySelectorAll('.logout-btn, #mobile-logout-btn');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.authManager.logout();
        });
    });
}

// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // No ejecutar código del header en la página de login
    if (window.location.pathname.includes('login.html')) {
        console.log('🔐 Página de login detectada, omitiendo carga del header');
        return;
    }
    
    // Solo mostrar información del usuario si está autenticado
    if (window.authManager.isAuthenticated()) {
        showUserInfo();
        addLogoutButton();
    }
});

// Exportar funciones para uso global
export { showUserInfo, addLogoutButton };
