// Script para obtener el UID del usuario existente y actualizar el documento
// Ejecutar en la consola de empleados.html

(async function obtenerUIDYActualizar() {
    console.log('\n🔧 ========== OBTENIENDO UID Y ACTUALIZANDO ==========\n');
    
    try {
        const { getAuth, signInWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const auth = window.firebaseAuth || getAuth();
        const db = window.db || getFirestore();
        
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        
        console.log('📋 Intentando login para obtener UID...');
        console.log('Email:', email);
        
        // Intentar hacer login para obtener el UID
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            
            console.log('✅ Login exitoso');
            console.log('🆔 UID obtenido:', uid);
            console.log('📧 Email verificado:', userCredential.user.email);
            
            // Cerrar sesión inmediatamente
            await signOut(auth);
            console.log('🔒 Sesión cerrada');
            
            // Actualizar documento en Firestore
            console.log('\n📝 Actualizando documento en Firestore...');
            const docRef = doc(db, 'empleados', 'jason.solis');
            await setDoc(docRef, {
                firebaseAuthUID: uid,
                firebaseAuthEmail: email,
                firebaseAuthMigrated: true,
                firebaseAuthMigratedAt: new Date().toISOString(),
                fechaActualizacion: new Date().toISOString()
            }, { merge: true });
            
            console.log('✅ Documento actualizado');
            console.log('   UID:', uid);
            console.log('   Email:', email);
            
            // Verificación final
            const docVerificado = await getDoc(docRef);
            if (docVerificado.exists()) {
                const datos = docVerificado.data();
                console.log('\n📄 Datos finales del documento:');
                console.log('   Username:', datos.username);
                console.log('   Email:', datos.email);
                console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
                console.log('   Firebase Auth UID:', datos.firebaseAuthUID);
            }
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ PROCESO COMPLETADO');
            console.log('='.repeat(60));
            console.log('El usuario YA EXISTE en Firebase Auth');
            console.log('Documento actualizado con el UID correcto');
            console.log('\n📋 Credenciales de acceso:');
            console.log('   Username: jason.solis');
            console.log('   Email:', email);
            console.log('   Password:', password);
            console.log('   UID:', uid);
            console.log('='.repeat(60) + '\n');
            
            alert('✅ Proceso completado!\n\n' +
                  'El usuario YA EXISTE en Firebase Auth\n' +
                  'Documento actualizado con UID: ' + uid + '\n\n' +
                  'Ahora puedes iniciar sesión con:\n' +
                  'Username: jason.solis\n' +
                  'Email: ' + email + '\n' +
                  'Password: ' + password);
            
        } catch (loginError) {
            console.log('❌ Error en login:', loginError.code);
            console.log('Mensaje:', loginError.message);
            
            if (loginError.code === 'auth/wrong-password') {
                console.log('\n⚠️  La contraseña es incorrecta');
                console.log('El usuario existe pero la contraseña no es "raiz2490"');
                alert('El usuario existe pero la contraseña es incorrecta.\n\nNecesitas resetear la contraseña desde Firebase Console.');
            } else if (loginError.code === 'auth/user-not-found') {
                console.log('\n⚠️  El usuario no existe');
                alert('El usuario no existe en Firebase Auth.');
            } else {
                alert('Error: ' + loginError.message);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
