// Sistema de Autenticación con Firebase Auth
// Este archivo será la nueva implementación que usa Firebase Authentication
// Se integrará gradualmente con auth.js existente

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
const auth = getAuth(app);
const db = getFirestore(app);

class FirebaseAuthManager {
    constructor() {
        this.currentUser = null;
        this.authStateListener = null;
        this.initializeAuthState();
    }

    // Inicializar listener de estado de autenticación
    initializeAuthState() {
        this.authStateListener = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Usuario autenticado en Firebase
                await this.loadUserDataFromFirestore(firebaseUser);
            } else {
                // Usuario no autenticado
                this.currentUser = null;
                this.saveUserToStorage();
            }
        });
    }

    // Cargar datos del usuario desde Firestore usando el email de Firebase Auth
    async loadUserDataFromFirestore(firebaseUser) {
        try {
            const email = firebaseUser.email.toLowerCase().trim();
            const username = email.replace('@ecoplagascr.com', '').replace(/^rh\+/, '');

            // Función para normalizar username (igual que en login)
            const normalizeUsername = (str) => {
                if (!str) return '';
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };

            const usernameNormalized = normalizeUsername(username);

            // Buscar empleado por firebaseAuthEmail, firebaseAuthUID, o username
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let empleadoEncontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                const empFirebaseEmail = (emp.firebaseAuthEmail || '').toLowerCase().trim();
                const empFirebaseEmailNormalized = empFirebaseEmail.replace('@ecoplagascr.com', '').replace(/^rh\+/, '');
                const empUsernameNormalized = normalizeUsername(emp.username || '');
                
                // Buscar por: firebaseAuthEmail, firebaseAuthUID, o username (normalizado)
                if (empFirebaseEmail === email ||
                    emp.firebaseAuthUID === firebaseUser.uid ||
                    empUsernameNormalized === usernameNormalized ||
                    normalizeUsername(empFirebaseEmailNormalized) === usernameNormalized) {
                    empleadoEncontrado = emp;
                }
            });

            if (empleadoEncontrado) {
                this.currentUser = {
                    id: empleadoEncontrado.username,
                    username: empleadoEncontrado.username,
                    nombre: `${empleadoEncontrado.primerNombre} ${empleadoEncontrado.primerApellido}`,
                    cedula: empleadoEncontrado.cedula,
                    tipoContrato: empleadoEncontrado.tipoContrato || 'Mensual',
                    permisos: empleadoEncontrado.permisos || {
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
                    firebaseUID: firebaseUser.uid,
                    firebaseEmail: email,
                    loginTime: new Date().toISOString()
                };
                this.saveUserToStorage();
            } else {
                console.warn('⚠️ Empleado no encontrado en Firestore para:', email);
            }
        } catch (error) {
            console.error('❌ Error cargando datos del usuario:', error);
        }
    }

    // Guardar usuario en localStorage (solo datos no sensibles)
    saveUserToStorage() {
        if (this.currentUser) {
            // No guardar datos sensibles, solo información básica
            const safeUserData = {
                id: this.currentUser.id,
                username: this.currentUser.username,
                nombre: this.currentUser.nombre,
                permisos: this.currentUser.permisos,
                loginTime: this.currentUser.loginTime
            };
            localStorage.setItem('currentUser', JSON.stringify(safeUserData));
        } else {
            localStorage.removeItem('currentUser');
        }
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

    // Login con Firebase Auth
    async login(username, password) {
        try {
            console.log(`🔐 Intentando login con Firebase Auth para: ${username}`);

            // Validar entrada
            if (!username || !password) {
                return { success: false, error: 'Usuario y contraseña son requeridos' };
            }

            // Normalizar username
            const normalizeUsername = (str) => {
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };

            const usernameNormalized = normalizeUsername(username);

            // Buscar empleado en Firestore primero para verificar que existe
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let empleadoEncontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                const empUsernameNormalized = normalizeUsername(emp.username || '');
                if (empUsernameNormalized === usernameNormalized) {
                    empleadoEncontrado = emp;
                }
            });

            if (!empleadoEncontrado) {
                return { success: false, error: 'Usuario no encontrado en el sistema' };
            }

            // Verificar si el empleado está activo
            const estadoEmpleado = empleadoEncontrado.estado || empleadoEncontrado.activo;
            if (estadoEmpleado !== 'Activo' && estadoEmpleado !== 'activo' && estadoEmpleado !== true) {
                return { success: false, error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' };
            }

        // Usar rh+username@ecoplagascr.com como email para Firebase Auth
            // Permite usar funcionalidad de recuperación de contraseña de Firebase
        const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();
            
            try {
                // Intentar login con Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Si el login es exitoso, onAuthStateChanged se encargará de cargar los datos
                // Pero esperamos un momento para que se complete
                await new Promise(resolve => setTimeout(resolve, 500));
                
                return { success: true, user: this.currentUser };
            } catch (firebaseError) {
                // Si el usuario no existe en Firebase Auth, crearlo automáticamente
                if (firebaseError.code === 'auth/user-not-found') {
                    console.log('📝 Usuario no encontrado en Firebase Auth, creando cuenta...');
                    
                    // Verificar contraseña contra hash en Firestore
                    const passwordMatch = await this.verifyPasswordAgainstFirestore(
                        password, 
                        empleadoEncontrado.password
                    );
                    
                    if (!passwordMatch) {
                        return { success: false, error: 'Contraseña incorrecta' };
                    }
                    
                    // Crear usuario en Firebase Auth
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    
                    // Actualizar documento de empleado con información de Firebase Auth
                    await updateDoc(doc(db, 'empleados', empleadoEncontrado.id), {
                        firebaseAuthUID: userCredential.user.uid,
                        firebaseAuthEmail: email,
                        firebaseAuthMigrated: true,
                        firebaseAuthMigratedAt: new Date().toISOString()
                    });
                    
                    // Esperar a que onAuthStateChanged cargue los datos
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    return { success: true, user: this.currentUser };
                } else if (firebaseError.code === 'auth/wrong-password') {
                    return { success: false, error: 'Contraseña incorrecta' };
                } else {
                    console.error('Error en Firebase Auth:', firebaseError);
                    return { success: false, error: `Error de autenticación: ${firebaseError.message}` };
                }
            }
        } catch (error) {
            console.error('❌ Error en login:', error);
            return { success: false, error: 'Error interno del servidor. Intenta nuevamente' };
        }
    }

    // Verificar contraseña contra hash en Firestore (para migración)
    async verifyPasswordAgainstFirestore(inputPassword, storedPassword) {
        if (!inputPassword || !storedPassword) {
            return false;
        }

        // Si la contraseña almacenada no está encriptada, comparar directamente
        if (!storedPassword.startsWith('bcrypt_')) {
            return inputPassword === storedPassword;
        }
        
        // Si está encriptada, verificar usando el mismo algoritmo de hash
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(inputPassword + 'ecoplagas_salt_2024');
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const hashedInput = 'bcrypt_' + hashHex;
            
            return hashedInput === storedPassword;
        } catch (error) {
            console.error('Error verificando contraseña:', error);
            return false;
        }
    }

    // Logout
    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            this.saveUserToStorage();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error en logout:', error);
            // Forzar logout local
            this.currentUser = null;
            this.saveUserToStorage();
            window.location.href = 'login.html';
        }
    }

    // Verificar si hay un usuario autenticado
    isAuthenticated() {
        return this.currentUser !== null && auth.currentUser !== null;
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
        if (!this.currentUser || !this.currentUser.username) {
            return false;
        }

        try {
            console.log('🔄 Refrescando permisos para:', this.currentUser.username);
            
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            const normalizeUsername = (str) => {
                return str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            };
            
            const usernameNormalized = normalizeUsername(this.currentUser.username);
            let empleadoEncontrado = null;
            
            empleadosSnapshot.forEach(doc => {
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

            const estadoEmpleado = empleadoEncontrado.estado || empleadoEncontrado.activo;
            if (estadoEmpleado !== 'Activo' && estadoEmpleado !== 'activo' && estadoEmpleado !== true) {
                console.log('🚫 Usuario desactivado, cerrando sesión');
                this.logout();
                return false;
            }

            const permisosActualizados = empleadoEncontrado.permisos || {};
            this.currentUser.permisos = permisosActualizados;
            this.currentUser.nombre = `${empleadoEncontrado.primerNombre} ${empleadoEncontrado.primerApellido}`;
            this.currentUser.cedula = empleadoEncontrado.cedula;
            this.currentUser.tipoContrato = empleadoEncontrado.tipoContrato || 'Mensual';
            
            this.saveUserToStorage();
            
            console.log('✅ Permisos actualizados:', permisosActualizados);
            return true;
            
        } catch (error) {
            console.error('❌ Error refrescando permisos:', error);
            return false;
        }
    }

    // Enviar email de recuperación de contraseña
    async sendPasswordReset(username) {
        try {
        const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();
            await sendPasswordResetEmail(auth, email);
            return { success: true, message: 'Email de recuperación enviado' };
        } catch (error) {
            console.error('Error enviando email de recuperación:', error);
            if (error.code === 'auth/user-not-found') {
                return { success: false, error: 'Usuario no encontrado en Firebase Auth' };
            }
            return { success: false, error: `Error: ${error.message}` };
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
                return { success: false, error: 'El usuario ya existe en Firebase Auth' };
            }
            return { success: false, error: `Error: ${error.message}` };
        }
    }

    // Resetear contraseña de usuario (para administradores)
    async resetUserPassword(username, newPassword) {
        try {
            // Verificar que el usuario tiene permisos de administrador
            if (!this.hasPermission('empleados')) {
                return { success: false, error: 'No tienes permisos para resetear contraseñas' };
            }

        const email = `rh+${username}@ecoplagascr.com`.toLowerCase().trim();

            // Buscar usuario en Firebase Auth por email
            // Nota: Firebase Admin SDK sería necesario para resetear directamente
            // Por ahora, enviamos email de recuperación
            await sendPasswordResetEmail(auth, email);
            
            return { 
                success: true, 
                message: 'Email de recuperación enviado al usuario. Debe seguir el enlace para cambiar su contraseña.' 
            };
        } catch (error) {
            console.error('Error reseteando contraseña:', error);
            if (error.code === 'auth/user-not-found') {
                return { success: false, error: 'Usuario no encontrado en Firebase Auth' };
            }
            return { success: false, error: `Error: ${error.message}` };
        }
    }
}

// Exportar para uso global
export { FirebaseAuthManager };

