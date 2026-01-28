// Script Node.js para obtener UID y actualizar documento usando Firebase Admin SDK
// Ejecutar: node obtener_uid_firebase_admin.js

const admin = require('firebase-admin');

// Configuración de Firebase Admin
const serviceAccount = {
    projectId: "cursorwebapp-f376d",
    // Necesitas descargar la clave de servicio desde Firebase Console
    // Project Settings → Service Accounts → Generate New Private Key
};

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "cursorwebapp-f376d"
});

const db = admin.firestore();
const auth = admin.auth();

async function obtenerUIDYActualizar() {
    try {
        const email = 'rh+jason.solis@ecoplagascr.com';
        
        console.log('🔍 Buscando usuario en Firebase Auth...');
        console.log('Email:', email);
        
        // Obtener usuario por email usando Admin SDK
        let user;
        try {
            user = await auth.getUserByEmail(email);
            console.log('✅ Usuario encontrado');
            console.log('UID:', user.uid);
            console.log('Email:', user.email);
            console.log('Email verificado:', user.emailVerified);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('❌ Usuario no encontrado');
                console.log('Necesitas crear el usuario primero');
                return;
            }
            throw error;
        }
        
        // Actualizar documento en Firestore
        console.log('\n📝 Actualizando documento en Firestore...');
        const docRef = db.collection('empleados').doc('jason.solis');
        
        await docRef.set({
            firebaseAuthUID: user.uid,
            firebaseAuthEmail: email,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Documento actualizado');
        
        // Resetear contraseña a "raiz2490"
        console.log('\n🔑 Reseteando contraseña...');
        await auth.updateUser(user.uid, {
            password: 'raiz2490'
        });
        console.log('✅ Contraseña reseteada a: raiz2490');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('UID:', user.uid);
        console.log('Email:', email);
        console.log('Password: raiz2490');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

obtenerUIDYActualizar()
    .then(() => {
        console.log('\n✅ Todo completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
