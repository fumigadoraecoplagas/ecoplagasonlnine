// Sistema de Autenticación Seguro con Firebase Auth
// Este archivo es para el sistema paralelo seguro (iniciar_sesion.html)
// NO usa localStorage para autenticación, solo Firebase Auth

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    fetchSignInMethodsForEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc,
    getDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Importar sistemas de seguridad (si están disponibles)
let SecurityLogger = null;
let InputValidator = null;

// Cargar módulos de seguridad de forma asíncrona
if (typeof window !== 'undefined') {
    // Intentar cargar SecurityLogger
    if (window.SecurityLogger) {
        SecurityLogger = window.SecurityLogger;
    }
    // Intentar cargar InputValidator
    if (window.InputValidator) {
        InputValidator = window.InputValidator;
    }
}

// Configuración de Firebase (centralizada)
// NOTA: Las API keys de Firebase son públicas por diseño.
// La seguridad real está en:
// 1. Firestore Security Rules (firestore.rules) - ✅ Implementado
// 2. Firebase App Check (protección contra bots) - ⚠️ Requiere configuración en Console
// 3. Firebase Authentication (requiere autenticación) - ✅ Implementado

// Importar configuración centralizada
// Si el módulo no está disponible, usar configuración local como fallback
let firebaseConfig;
try {
    // Intentar importar configuración centralizada (si está disponible)
    if (typeof window !== 'undefined' && window.firebaseConfig) {
        firebaseConfig = window.firebaseConfig;
    } else {
        // Fallback: configuración local
        firebaseConfig = {
            projectId: "cursorwebapp-f376d",
            appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
            databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
            storageBucket: "cursorwebapp-f376d.firebasestorage.app",
            apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
            authDomain: "cursorwebapp-f376d.firebaseapp.com",
            messagingSenderId: "719990096116",
            measurementId: "G-DJXLKFR7CD"
        };
    }
} catch (error) {
    // Fallback: configuración local
    firebaseConfig = {
        projectId: "cursorwebapp-f376d",
        appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
        databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
        storageBucket: "cursorwebapp-f376d.firebasestorage.app",
        apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
        authDomain: "cursorwebapp-f376d.firebaseapp.com",
        messagingSenderId: "719990096116",
        measurementId: "G-DJXLKFR7CD"
    };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar db para uso en otros módulos
if (typeof window !== 'undefined') {
    window.db = db;
}

// Firebase App Check - Protección adicional contra bots y abuso
// IMPORTANTE: Requiere configuración previa en Firebase Console
// Pasos:
// 1. Ir a Firebase Console → App Check
// 2. Registrar tu dominio (ecoplagas.online)
// 3. Configurar reCAPTCHA v3 y obtener Site Key
// 4. Descomentar y configurar el código abajo
try {
    // Intentar cargar App Check si está disponible
    if (typeof window !== 'undefined') {
        // Cargar App Check de forma asíncrona
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js')
            .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
                // Solo inicializar si tenemos un Site Key configurado
                // Obtener Site Key de window.appCheckConfig o usar null para deshabilitar
                const reCaptchaSiteKey = window.appCheckConfig?.reCaptchaSiteKey || null;
                
                if (reCaptchaSiteKey && reCaptchaSiteKey !== 'TU_RECAPTCHA_SITE_KEY') {
                    try {
                        const appCheck = initializeAppCheck(app, {
                            provider: new ReCaptchaV3Provider(reCaptchaSiteKey),
                            isTokenAutoRefreshEnabled: true
                        });
                        console.log('✅ Firebase App Check inicializado correctamente');
                    } catch (error) {
                        console.warn('⚠️ Error inicializando App Check (puede requerir configuración en Console):', error);
                    }
                                } else {
                                    // Firebase App Check no configurado (sin log en producción)
                                    if (window.safeLogger && window.safeLogger.enableDetailedLogs) {
                                        window.safeLogger.info('ℹ️ Firebase App Check no configurado. Para habilitarlo:');
                                        window.safeLogger.info('   1. Ir a Firebase Console → App Check');
                                        window.safeLogger.info('   2. Registrar dominio y configurar reCAPTCHA v3');
                                        window.safeLogger.info('   3. Agregar Site Key en firebase-config.js');
                                    }
                                }
            })
            .catch((error) => {
                // App Check no está disponible o hay error de carga
                console.log('ℹ️ Firebase App Check no disponible (requiere configuración en Console)');
            });
    }
} catch (error) {
    // App Check no disponible, continuar sin él
    console.log('ℹ️ Firebase App Check no disponible');
}

// Exponer auth globalmente para que otros módulos lo usen (especialmente Storage)
if (typeof window !== 'undefined') {
    window.firebaseAuth = auth;
}

class SecureAuthManager {
    constructor() {
        this.currentUser = null;
        this.authStateListener = null;
        this.lastActivityTime = Date.now();
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 horas de inactividad
        this.activityCheckInterval = null;
        this.isTemporaryLogin = false; // Bandera para login temporal
        this.initializeAuthState();
        this.initializeActivityTracking();
    }

    // Inicializar listener de estado de autenticación
    initializeAuthState() {
        this.authStateListener = onAuthStateChanged(auth, async (firebaseUser) => {
            // Si es un login temporal, no cargar datos
            if (this.isTemporaryLogin) {
                return;
            }
            
            if (firebaseUser) {
                // Usuario autenticado en Firebase
                await this.loadUserDataFromFirestore(firebaseUser);
            } else {
                // Usuario no autenticado
                this.currentUser = null;
                this.clearStorage();
            }
        });
    }

    // Normalizar username (sin acentos, minúsculas)
    normalizeUsername(str) {
        if (!str) return '';
        return str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // Cargar datos del usuario desde Firestore
    async loadUserDataFromFirestore(firebaseUser) {
        try {
            // Si es un login temporal, no intentar cargar datos
            if (this.isTemporaryLogin) {
                return;
            }
            
            const email = firebaseUser.email.toLowerCase().trim();
            const username = email.replace('@ecoplagascr.com', '').replace(/^rh\+/, '');
            const usernameNormalized = this.normalizeUsername(username);

            // Buscar empleado en Firestore
            // NOTA: Esto requiere que las Firestore Rules permitan lectura
            // para usuarios autenticados. Ver firestore-secure.rules
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let empleadoEncontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                const empFirebaseEmail = (emp.firebaseAuthEmail || '').toLowerCase().trim();
                const empUsernameNormalized = this.normalizeUsername(emp.username || '');
                
                // Buscar por: firebaseAuthEmail, firebaseAuthUID, o username (normalizado)
                const empFirebaseEmailNormalized = empFirebaseEmail.replace('@ecoplagascr.com', '').replace(/^rh\+/, '');
                if (empFirebaseEmail === email ||
                    emp.firebaseAuthUID === firebaseUser.uid ||
                    empUsernameNormalized === usernameNormalized ||
                    this.normalizeUsername(empFirebaseEmailNormalized) === usernameNormalized) {
                    empleadoEncontrado = emp;
                }
            });

            if (!empleadoEncontrado) {
                throw new Error('Usuario no encontrado en la base de datos');
            }

            // Verificar que el empleado esté activo
            const estadoEmpleado = empleadoEncontrado.estado || empleadoEncontrado.activo;
            if (estadoEmpleado !== 'Activo' && estadoEmpleado !== 'activo' && estadoEmpleado !== true) {
                throw new Error('Usuario desactivado. Contacta al administrador.');
            }

            // Crear objeto de usuario seguro (sin datos sensibles)
            this.currentUser = {
                id: empleadoEncontrado.username,
                username: empleadoEncontrado.username,
                nombre: `${empleadoEncontrado.primerNombre} ${empleadoEncontrado.primerApellido}`,
                cedula: empleadoEncontrado.cedula,
                tipoContrato: empleadoEncontrado.tipoContrato || 'Mensual',
                permisos: empleadoEncontrado.permisos || {},
                firebaseUID: firebaseUser.uid,
                firebaseAuthUID: firebaseUser.uid, // Alias para compatibilidad
                firebaseEmail: email,
                loginTime: new Date().toISOString()
            };

            // Guardar en sessionStorage (más seguro que localStorage, se limpia al cerrar)
            this.saveUserToStorage();
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
            this.currentUser = null;
            this.clearStorage();
            throw error;
        }
    }

    // Guardar usuario en sessionStorage (solo datos no sensibles)
    saveUserToStorage() {
        if (this.currentUser) {
            // Solo guardar datos no sensibles
            const safeUserData = {
                id: this.currentUser.id,
                username: this.currentUser.username,
                nombre: this.currentUser.nombre,
                permisos: this.currentUser.permisos,
                firebaseUID: this.currentUser.firebaseUID,
                firebaseAuthUID: this.currentUser.firebaseAuthUID,
                loginTime: this.currentUser.loginTime
            };
            sessionStorage.setItem('currentUser', JSON.stringify(safeUserData));
            sessionStorage.setItem('firebaseAuthToken', 'authenticated');
        } else {
            this.clearStorage();
        }
    }

    // Cargar usuario desde sessionStorage (solo para UI, no para autenticación)
    loadUserFromStorage() {
        const stored = sessionStorage.getItem('currentUser');
        if (stored) {
            try {
                const userData = JSON.parse(stored);
                // Verificar que Firebase Auth todavía esté activo
                if (sessionStorage.getItem('firebaseAuthToken') === 'authenticated') {
                    this.currentUser = userData;
                } else {
                    this.clearStorage();
                }
            } catch (e) {
                console.error('Error parsing stored user:', e);
                this.clearStorage();
            }
        }
    }

    // Limpiar storage
    clearStorage() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('firebaseAuthToken');
    }

    // Validar y sanitizar input
    validateAndSanitizeInput(username, password) {
        if (InputValidator) {
            const usernameValidation = InputValidator.validateUsername(username);
            if (!usernameValidation.valid) {
                throw new Error(usernameValidation.message);
            }
            username = usernameValidation.sanitized;
        }
        return username;
    }

    // Login con Firebase Auth
    async login(username, password) {
        // Si el usuario ingresó el email completo, extraer solo el username
        if (username.includes('@')) {
            username = username.split('@')[0];
        }

        // Validar y sanitizar input
        try {
            username = this.validateAndSanitizeInput(username, password);
        } catch (error) {
            if (SecurityLogger) {
                const logger = new SecurityLogger();
                logger.logLoginAttempt(username, false, 'INVALID_INPUT', { error: error.message });
            }
            throw error;
        }

        const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();
        
        // Log de intento de login
        if (SecurityLogger) {
            const logger = new SecurityLogger();
            logger.logLoginAttempt(username, false, 'ATTEMPTING');
        }
        
        try {
            // Autenticar con Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Cargar datos del usuario desde Firestore
            await this.loadUserDataFromFirestore(userCredential.user);
            
            // Log de login exitoso
            if (SecurityLogger) {
                const logger = new SecurityLogger();
                logger.logLoginAttempt(username, true, 'SUCCESS', {
                    uid: userCredential.user.uid,
                    email: email
                });
            }
            
            // Resetear tiempo de actividad
            this.lastActivityTime = Date.now();
            
            return this.currentUser;
        } catch (error) {
            // Log de login fallido
            if (SecurityLogger) {
                const logger = new SecurityLogger();
                logger.logLoginAttempt(username, false, 'FAILED', {
                    errorCode: error.code,
                    errorMessage: error.message
                });
            }
            throw error;
        }
    }

    // Logout
    async logout() {
        const username = this.currentUser?.username || 'unknown';
        
        // Log de logout
        if (SecurityLogger) {
            const logger = new SecurityLogger();
            logger.logLogout(username);
        }
        
        // Limpiar tracking de actividad
        this.clearActivityTracking();
        
        await signOut(auth);
        this.currentUser = null;
        this.clearStorage();
    }

    // Verificar si hay un usuario autenticado
    isAuthenticated() {
        // Verificar tanto Firebase Auth como sessionStorage
        return auth.currentUser !== null && this.currentUser !== null;
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar permisos de módulo
    hasPermission(module) {
        if (!this.currentUser) return false;
        return this.currentUser.permisos && this.currentUser.permisos[module] === true;
    }

    // Refrescar permisos del usuario desde Firestore
    async refreshUserPermissions() {
        if (!auth.currentUser) {
            return false;
        }

        try {
            await this.loadUserDataFromFirestore(auth.currentUser);
            return true;
        } catch (error) {
            console.error('Error refrescando permisos:', error);
            return false;
        }
    }

    // Esperar hasta que el usuario autenticado esté disponible
    async waitForCurrentUser(timeoutMs = 8000) {
        const startTime = Date.now();

        // Intentar cargar desde storage si aún no existe
        if (!this.currentUser) {
            this.loadUserFromStorage();
        }

        while (Date.now() - startTime < timeoutMs) {
            if (this.isAuthenticated()) {
                return this.currentUser;
            }

            // Si Firebase Auth ya tiene usuario pero aún no cargamos datos, hacerlo
            if (auth.currentUser && !this.currentUser) {
                try {
                    await this.loadUserDataFromFirestore(auth.currentUser);
                    if (this.isAuthenticated()) {
                        return this.currentUser;
                    }
                } catch (error) {
                    console.error('Error sincronizando usuario durante waitForCurrentUser:', error);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return null;
    }

    // Función para encriptar contraseñas (compatible con auth.js)
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

    // Inicializar tracking de actividad para timeout de sesión
    initializeActivityTracking() {
        // Actualizar tiempo de actividad en eventos del usuario
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivityTime = Date.now();
            }, { passive: true });
        });

        // Verificar inactividad cada minuto
        this.activityCheckInterval = setInterval(() => {
            this.checkSessionTimeout();
        }, 60000); // Cada minuto
    }

    // Verificar si la sesión ha expirado por inactividad o por domingo a medianoche
    checkSessionTimeout() {
        if (!this.isAuthenticated()) {
            return;
        }

        // Verificar si es domingo a medianoche (00:00:00 - 00:00:59)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        if (dayOfWeek === 0 && hours === 0 && minutes === 0) {
            // Es domingo a medianoche, cerrar sesión
            if (SecurityLogger) {
                const logger = new SecurityLogger();
                logger.createLog(
                    'SESSION_TIMEOUT',
                    `Sesión expirada por política: domingo a medianoche para usuario: ${this.currentUser?.username || 'unknown'}`,
                    'MEDIUM',
                    {
                        username: this.currentUser?.username,
                        reason: 'sunday_midnight'
                    }
                );
            }
            
            // Cerrar sesión automáticamente
            this.logout().then(() => {
                // Redirigir a login
                if (!window.location.pathname.includes('iniciar_sesion.html')) {
                    window.location.replace('iniciar_sesion.html?timeout=1&reason=sunday');
                }
            });
            return; // No verificar inactividad si ya se cerró por domingo
        }

        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        
        if (timeSinceLastActivity >= this.sessionTimeout) {
            // Sesión expirada por inactividad
            if (SecurityLogger) {
                const logger = new SecurityLogger();
                logger.createLog(
                    'SESSION_TIMEOUT',
                    `Sesión expirada por inactividad para usuario: ${this.currentUser?.username || 'unknown'}`,
                    'MEDIUM',
                    {
                        username: this.currentUser?.username,
                        timeoutMinutes: this.sessionTimeout / 60000
                    }
                );
            }
            
            // Cerrar sesión automáticamente
            this.logout().then(() => {
                // Redirigir a login
                if (!window.location.pathname.includes('iniciar_sesion.html')) {
                    window.location.replace('iniciar_sesion.html?timeout=1');
                }
            });
        } else if (timeSinceLastActivity >= this.sessionTimeout - (5 * 60 * 1000)) {
            // Advertencia: 5 minutos antes de expirar
            const remainingMinutes = Math.ceil((this.sessionTimeout - timeSinceLastActivity) / 60000);
            // Podrías mostrar una notificación aquí
            console.warn(`⚠️ Tu sesión expirará en ${remainingMinutes} minutos por inactividad`);
        }
    }

    // Limpiar tracking de actividad
    clearActivityTracking() {
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
            this.activityCheckInterval = null;
        }
    }

    // Crear usuario en Firebase Auth (para administradores)
    async createUserInFirebaseAuth(username, password) {
        try {
            // Verificar que el usuario tiene permisos de administrador
            if (!this.hasPermission('empleados')) {
                return { success: false, error: 'No tienes permisos para crear usuarios' };
            }

            const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();

            // Buscar empleado en Firestore
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let empleadoEncontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                if (emp.username === username) {
                    empleadoEncontrado = emp;
                }
            });

            if (!empleadoEncontrado) {
                return { success: false, error: 'Empleado no encontrado en Firestore' };
            }

            // Verificar primero si el usuario ya existe
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, email);
                if (signInMethods.length > 0) {
                    // El usuario ya existe, retornar información para sincronización
                    return { 
                        success: false, 
                        error: 'El usuario ya existe en Firebase Auth',
                        emailExists: true,
                        email: email,
                        needsSync: true
                    };
                }
            } catch (checkError) {
                // Si hay error verificando, continuar con la creación
                console.log('No se pudo verificar si el usuario existe, intentando crear...');
            }

            // Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Actualizar documento de empleado
            await updateDoc(doc(db, 'empleados', empleadoEncontrado.id), {
                firebaseAuthUID: userCredential.user.uid,
                firebaseAuthEmail: email,
                firebaseAuthMigrated: true,
                firebaseAuthMigratedAt: new Date().toISOString()
            });

            return { 
                success: true, 
                message: 'Usuario creado en Firebase Auth',
                uid: userCredential.user.uid,
                email: email
            };
        } catch (error) {
            console.error('Error creando usuario en Firebase Auth:', error);
            if (error.code === 'auth/email-already-in-use') {
                // El usuario ya existe, retornar información para sincronización
                return { 
                    success: false, 
                    error: 'El usuario ya existe en Firebase Auth. Usa el botón de sincronización o proporciona la contraseña de Firebase Auth para actualizar el registro.',
                    emailExists: true,
                    email: `rh+${username}@ecoplagascr.com`,
                    needsSync: true
                };
            }
            return { success: false, error: `Error: ${error.message}` };
        }
    }

    // Sincronizar empleado con Firebase Auth (verificar si existe y actualizar UID)
    async sincronizarEmpleadoConFirebaseAuth(username) {
        try {
            // Verificar que el usuario tiene permisos de administrador
            if (!this.hasPermission('empleados')) {
                return { success: false, error: 'No tienes permisos para sincronizar usuarios' };
            }

            const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();

            // Verificar si el email existe en Firebase Auth
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, email);
                
                if (signInMethods.length === 0) {
                    return { success: false, error: 'El usuario no existe en Firebase Auth' };
                }

                // Si el email existe, intentar hacer login temporal para obtener el UID
                // Nota: Esto requiere la contraseña. Intentaremos con la contraseña por defecto
                // Si falla, el usuario deberá usar el botón "Crear en Firebase Auth" manualmente
                return { 
                    success: true, 
                    message: 'El usuario existe en Firebase Auth. Para actualizar el UID, usa el botón "Crear en Firebase Auth" o inicia sesión con ese usuario.',
                    emailExists: true
                };
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    return { success: false, error: 'El usuario no existe en Firebase Auth' };
                }
                return { success: false, error: `Error verificando usuario: ${error.message}` };
            }
        } catch (error) {
            console.error('Error sincronizando empleado con Firebase Auth:', error);
            return { success: false, error: `Error: ${error.message}` };
        }
    }

    // Obtener UID de usuario existente en Firebase Auth (requiere login temporal)
    async obtenerUIDDeUsuarioExistente(username, password) {
        try {
            const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();
            
            // Guardar el usuario actual antes de hacer login temporal
            const usuarioActual = auth.currentUser;
            const usuarioActualUID = usuarioActual ? usuarioActual.uid : null;
            const usuarioActualEmail = usuarioActual ? usuarioActual.email : null;
            
            // Activar bandera de login temporal para evitar cargar datos
            this.isTemporaryLogin = true;
            
            try {
                // Intentar login temporal para obtener el UID
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;
                const emailObtenido = userCredential.user.email;
                
                // Cerrar sesión del usuario temporal
                await signOut(auth);
                
                // Desactivar bandera de login temporal
                this.isTemporaryLogin = false;
                
                // Si había un usuario original, esperar un momento para que el signOut se complete
                if (usuarioActualUID && usuarioActualEmail) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                return { success: true, uid: uid, email: emailObtenido };
            } catch (loginError) {
                // Desactivar bandera en caso de error
                this.isTemporaryLogin = false;
                throw loginError;
            }
        } catch (error) {
            console.error('Error obteniendo UID de usuario existente:', error);
            if (error.code === 'auth/user-not-found') {
                return { success: false, error: 'El usuario no existe en Firebase Auth' };
            }
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                return { success: false, error: 'Contraseña incorrecta. Verifica que la contraseña sea la correcta de Firebase Authentication.' };
            }
            if (error.code === 'auth/invalid-email') {
                return { success: false, error: 'Email inválido' };
            }
            return { success: false, error: `Error: ${error.message}` };
        }
    }
}

// Crear instancia global
window.secureAuthManager = new SecureAuthManager();

// Exportar para uso en otros módulos
export { SecureAuthManager, auth, db };

