// Script Node.js para obtener UID y resetear contraseña usando Firebase Admin SDK
// NO cambia el email, solo obtiene el UID y resetea la contraseña
// REQUIERE: Clave de servicio de Firebase (serviceAccountKey.json)

const admin = require('firebase-admin');

// INSTRUCCIONES:
// 1. Ve a Firebase Console → Project Settings → Service Accounts
// 2. Haz clic en "Generate New Private Key"
// 3. Guarda el archivo JSON como "serviceAccountKey.json" en esta carpeta
// 4. El script lo cargará automáticamente

let serviceAccount;
try {
    // Intentar cargar la clave de servicio
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✅ Clave de servicio cargada');
} catch (error) {
    console.error('❌ Error: No se encontró serviceAccountKey.json');
    console.error('\n💡 INSTRUCCIONES:');
    console.error('1. Ve a: https://console.firebase.google.com/project/cursorwebapp-f376d/settings/serviceaccounts/adminsdk');
    console.error('2. Haz clic en "Generate New Private Key"');
    console.error('3. Guarda el archivo JSON como "serviceAccountKey.json" en esta carpeta');
    console.error('4. Ejecuta el script nuevamente');
    process.exit(1);
}

// Inicializar Firebase Admin
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "cursorwebapp-f376d"
    });
} catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.log('\n💡 Necesitas configurar serviceAccountKey.json primero');
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

async function obtenerUIDYResetear() {
    try {
        const email = 'rh+jason.solis@ecoplagascr.com';
        const passwordNueva = 'raiz2490';
        
        console.log('🔍 Buscando usuario en Firebase Auth...');
        console.log('Email:', email);
        
        // Obtener usuario por email
        let user;
        try {
            user = await auth.getUserByEmail(email);
            console.log('✅ Usuario encontrado');
            console.log('UID:', user.uid);
            console.log('Email:', user.email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('❌ Usuario no encontrado con email:', email);
                console.log('Intentando buscar por UID del documento...');
                
                // Intentar con el UID del documento
                const uidDelDocumento = 'PoIQzKLfLNdojEj1Htyw8dVY1vL2';
                try {
                    user = await auth.getUser(uidDelDocumento);
                    console.log('✅ Usuario encontrado por UID');
                    console.log('UID:', user.uid);
                    console.log('Email:', user.email);
                } catch (error2) {
                    console.log('❌ Usuario no encontrado');
                    throw new Error('No se pudo encontrar el usuario. Verifica que el email o UID sean correctos.');
                }
            } else {
                throw error;
            }
        }
        
        // Resetear contraseña directamente (sin cambiar email)
        console.log('\n🔑 Reseteando contraseña...');
        await auth.updateUser(user.uid, {
            password: passwordNueva
        });
        console.log('✅ Contraseña reseteada a:', passwordNueva);
        
        // Generar link de reseteo para enviar a desarrolloecoplagas@gmail.com
        console.log('\n📨 Generando link de reseteo de contraseña...');
        const resetLink = await auth.generatePasswordResetLink(email);
        console.log('✅ Link generado');
        console.log('\n' + '='.repeat(60));
        console.log('📧 LINK DE RESETEO DE CONTRASEÑA:');
        console.log('='.repeat(60));
        console.log(resetLink);
        console.log('='.repeat(60));
        console.log('\n💡 Copia este link y envíalo a desarrolloecoplagas@gmail.com');
        console.log('O usa este link para resetear la contraseña manualmente');
        
        // Actualizar documento en Firestore con el UID correcto
        console.log('\n📝 Actualizando documento en Firestore...');
        const docRef = db.collection('empleados').doc('jason.solis');
        
        await docRef.set({
            firebaseAuthUID: user.uid,
            firebaseAuthEmail: email, // Mantener el email original
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
            passwordReseteada: true,
            passwordReseteadaEn: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Documento actualizado');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('UID:', user.uid);
        console.log('Email (sin cambiar):', email);
        console.log('Password nueva:', passwordNueva);
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username: jason.solis');
        console.log('   Email:', email);
        console.log('   Password:', passwordNueva);
        console.log('='.repeat(60));
        
        // Guardar link en archivo
        const fs = require('fs');
        const contenido = `Link de reseteo de contraseña para jason.solis:\n\n${resetLink}\n\nCredenciales:\nUsername: jason.solis\nEmail: ${email}\nPassword: ${passwordNueva}\nUID: ${user.uid}`;
        fs.writeFileSync('link_reseteo_jason_solis.txt', contenido);
        console.log('\n💾 Link guardado en: link_reseteo_jason_solis.txt');
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    }
}

obtenerUIDYResetear()
    .then(() => {
        console.log('\n✅ Todo completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error.message);
        console.error('\n💡 Asegúrate de tener configurado serviceAccountKey.json');
        process.exit(1);
    });
