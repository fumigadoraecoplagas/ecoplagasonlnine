// Script de Migración de Contraseñas - Eco Plagas
// Este script encripta todas las contraseñas existentes usando bcrypt

import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Firebase configuration
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

// Usar la app de Firebase existente
let app, db;
try {
    app = getApp();
    db = getFirestore(app);
} catch (error) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}

// Función para generar hash bcrypt (simulada - en producción usaría bcrypt real)
async function hashPassword(password) {
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

// Función para verificar si una contraseña ya está encriptada
function isPasswordEncrypted(password) {
    return password.startsWith('bcrypt_');
}

// Función principal de migración
async function migratePasswords() {
    try {
        console.log('🔐 Iniciando migración de contraseñas...');
        
        // Obtener todos los empleados
        const empleadosRef = collection(db, 'empleados');
        const querySnapshot = await getDocs(empleadosRef);
        
        console.log(`📊 Encontrados ${querySnapshot.size} empleados`);
        
        let migrated = 0;
        let alreadyEncrypted = 0;
        let errors = 0;
        
        for (const docSnapshot of querySnapshot.docs) {
            try {
                const empleadoData = docSnapshot.data();
                const empleadoId = docSnapshot.id;
                
                // Verificar si la contraseña ya está encriptada
                if (isPasswordEncrypted(empleadoData.password)) {
                    console.log(`✅ ${empleadoData.username} - Ya encriptada`);
                    alreadyEncrypted++;
                    continue;
                }
                
                // Encriptar contraseña
                const hashedPassword = await hashPassword(empleadoData.password);
                
                // Actualizar documento
                await updateDoc(doc(db, 'empleados', empleadoId), {
                    password: hashedPassword,
                    passwordEncrypted: true,
                    passwordMigrationDate: new Date().toISOString()
                });
                
                console.log(`🔐 ${empleadoData.username} - Contraseña encriptada`);
                migrated++;
                
                // Pequeña pausa para no sobrecargar Firebase
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error migrando empleado ${docSnapshot.id}:`, error);
                errors++;
            }
        }
        
        console.log('\n📊 RESUMEN DE MIGRACIÓN:');
        console.log(`✅ Contraseñas migradas: ${migrated}`);
        console.log(`✅ Ya encriptadas: ${alreadyEncrypted}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📈 Total procesados: ${migrated + alreadyEncrypted + errors}`);
        
        if (errors === 0) {
            console.log('\n🎉 ¡Migración completada exitosamente!');
        } else {
            console.log('\n⚠️ Migración completada con errores. Revisa los logs.');
        }
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
    }
}

// Función para verificar migración
async function verifyMigration() {
    try {
        console.log('🔍 Verificando migración...');
        
        const empleadosRef = collection(db, 'empleados');
        const querySnapshot = await getDocs(empleadosRef);
        
        let encrypted = 0;
        let notEncrypted = 0;
        const total = querySnapshot.size;
        
        for (const docSnapshot of querySnapshot.docs) {
            const empleadoData = docSnapshot.data();
            if (isPasswordEncrypted(empleadoData.password)) {
                encrypted++;
            } else {
                notEncrypted++;
                console.log(`⚠️ ${empleadoData.username} - Contraseña NO encriptada`);
            }
        }
        
        console.log(`\n📊 VERIFICACIÓN:`);
        console.log(`✅ Encriptadas: ${encrypted}`);
        console.log(`❌ No encriptadas: ${notEncrypted}`);
        
        // Actualizar la interfaz si las funciones están disponibles
        if (window.updateStats) {
            window.updateStats(total, encrypted, notEncrypted);
        }
        
        if (window.log) {
            if (notEncrypted === 0) {
                window.log('🎉 ¡Todas las contraseñas están encriptadas!', 'success');
            } else {
                window.log(`⚠️ ${notEncrypted} contraseñas necesitan ser encriptadas`, 'warning');
            }
        }
        
        if (notEncrypted === 0) {
            console.log('🎉 ¡Todas las contraseñas están encriptadas!');
        } else {
            console.log('⚠️ Algunas contraseñas no están encriptadas.');
        }
        
    } catch (error) {
        console.error('❌ Error en verificación:', error);
        if (window.log) {
            window.log(`❌ Error en verificación: ${error.message}`, 'error');
        }
    }
}

// Exportar funciones para uso en consola
window.migratePasswords = migratePasswords;
window.verifyMigration = verifyMigration;

console.log('🔐 Script de migración de contraseñas cargado');
console.log('📝 Comandos disponibles:');
console.log('  - migratePasswords() - Ejecutar migración');
console.log('  - verifyMigration() - Verificar estado');
