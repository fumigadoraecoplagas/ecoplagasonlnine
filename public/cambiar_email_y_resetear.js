// Script Node.js para cambiar email y resetear contraseña usando Firebase Admin SDK
// REQUIERE: Node.js instalado y Firebase Admin SDK
// Ejecutar: npm install firebase-admin
// Luego: node cambiar_email_y_resetear.js

const admin = require('firebase-admin');

// IMPORTANTE: Necesitas descargar la clave de servicio JSON desde Firebase Console
// 1. Ve a Firebase Console → Project Settings → Service Accounts
// 2. Haz clic en "Generate New Private Key"
// 3. Guarda el archivo JSON como "serviceAccountKey.json" en esta carpeta
// 4. Descomenta y ajusta la siguiente línea:

// const serviceAccount = require('./serviceAccountKey.json');

// O configura manualmente:
const serviceAccount = {
    projectId: "cursorwebapp-f376d",
    // Agrega aquí los datos de tu serviceAccountKey.json
};

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "cursorwebapp-f376d"
});

const db = admin.firestore();
const auth = admin.auth();

async function cambiarEmailYResetear() {
    try {
        const emailViejo = 'rh+jason.solis@ecoplagascr.com';
        const emailNuevo = 'desarrolloecoplagas@gmail.com';
        const passwordNueva = 'raiz2490';
        
        console.log('🔍 Buscando usuario...');
        console.log('Email actual:', emailViejo);
        
        // Obtener usuario por email viejo
        let user;
        try {
            user = await auth.getUserByEmail(emailViejo);
            console.log('✅ Usuario encontrado');
            console.log('UID:', user.uid);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('❌ Usuario no encontrado con email:', emailViejo);
                console.log('Intentando buscar por UID del documento...');
                
                // Intentar con el UID del documento
                const uidDelDocumento = 'PoIQzKLfLNdojEj1Htyw8dVY1vL2';
                try {
                    user = await auth.getUser(uidDelDocumento);
                    console.log('✅ Usuario encontrado por UID');
                    console.log('UID:', user.uid);
                    console.log('Email actual:', user.email);
                } catch (error2) {
                    console.log('❌ Usuario no encontrado');
                    throw new Error('No se pudo encontrar el usuario');
                }
            } else {
                throw error;
            }
        }
        
        console.log('\n📧 Cambiando email...');
        console.log('De:', user.email);
        console.log('A:', emailNuevo);
        
        // Cambiar email
        await auth.updateUser(user.uid, {
            email: emailNuevo,
            emailVerified: false
        });
        console.log('✅ Email cambiado');
        
        // Resetear contraseña
        console.log('\n🔑 Reseteando contraseña...');
        await auth.updateUser(user.uid, {
            password: passwordNueva
        });
        console.log('✅ Contraseña reseteada a:', passwordNueva);
        
        // Actualizar documento en Firestore
        console.log('\n📝 Actualizando documento en Firestore...');
        const docRef = db.collection('empleados').doc('jason.solis');
        
        await docRef.set({
            username: 'jason.solis',
            email: emailNuevo,
            firebaseAuthEmail: emailNuevo,
            firebaseAuthUID: user.uid,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Documento actualizado');
        
        // Enviar email de verificación al nuevo email
        console.log('\n📨 Enviando email de verificación...');
        const link = await auth.generateEmailVerificationLink(emailNuevo);
        console.log('Link de verificación:', link);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('UID:', user.uid);
        console.log('Email nuevo:', emailNuevo);
        console.log('Password:', passwordNueva);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

cambiarEmailYResetear()
    .then(() => {
        console.log('\n✅ Todo completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
