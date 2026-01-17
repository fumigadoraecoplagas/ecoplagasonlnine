// Script para verificar estado de contraseñas - Eco Plagas
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

// Función para verificar si una contraseña está encriptada
function isPasswordEncrypted(password) {
    return password && password.startsWith('bcrypt_');
}

// Función principal para verificar contraseñas
async function checkPasswords() {
    try {
        console.log('🔍 Verificando estado de contraseñas...');
        
        // Obtener todos los empleados
        const empleadosRef = collection(db, 'empleados');
        const querySnapshot = await getDocs(empleadosRef);
        
        console.log(`📊 Total de empleados encontrados: ${querySnapshot.size}`);
        
        let encrypted = 0;
        let notEncrypted = 0;
        const empleados = [];
        
        for (const docSnapshot of querySnapshot.docs) {
            const empleadoData = docSnapshot.data();
            const empleado = {
                id: docSnapshot.id,
                username: empleadoData.username,
                nombre: `${empleadoData.primerNombre} ${empleadoData.primerApellido}`,
                password: empleadoData.password,
                isEncrypted: isPasswordEncrypted(empleadoData.password),
                passwordEncrypted: empleadoData.passwordEncrypted || false,
                passwordMigrationDate: empleadoData.passwordMigrationDate || null
            };
            
            empleados.push(empleado);
            
            if (empleado.isEncrypted) {
                encrypted++;
            } else {
                notEncrypted++;
            }
        }
        
        console.log('\n📊 RESUMEN:');
        console.log(`✅ Contraseñas encriptadas: ${encrypted}`);
        console.log(`❌ Contraseñas NO encriptadas: ${notEncrypted}`);
        console.log(`📈 Total: ${encrypted + notEncrypted}`);
        
        console.log('\n👥 DETALLE POR EMPLEADO:');
        empleados.forEach(empleado => {
            const status = empleado.isEncrypted ? '✅ ENCRIPTADA' : '❌ NO ENCRIPTADA';
            const migrationDate = empleado.passwordMigrationDate ? 
                ` (Migrada: ${new Date(empleado.passwordMigrationDate).toLocaleDateString()})` : '';
            console.log(`${status} - ${empleado.nombre} (${empleado.username})${migrationDate}`);
        });
        
        if (notEncrypted === 0) {
            console.log('\n🎉 ¡TODAS LAS CONTRASEÑAS ESTÁN ENCRIPTADAS!');
        } else {
            console.log(`\n⚠️ ${notEncrypted} contraseñas necesitan ser encriptadas.`);
        }
        
        return {
            total: empleados.length,
            encrypted: encrypted,
            notEncrypted: notEncrypted,
            empleados: empleados
        };
        
    } catch (error) {
        console.error('❌ Error verificando contraseñas:', error);
        return null;
    }
}

// Exportar función para uso en consola
window.checkPasswords = checkPasswords;

console.log('🔐 Script de verificación de contraseñas cargado');
console.log('📝 Comando disponible: checkPasswords()');
console.log('💡 Ejecuta checkPasswords() en la consola para verificar el estado');






















