// Script para crear el usuario en Firebase Auth con el email correcto
// Ejecutar en la consola de empleados.html

(async function crearUsuarioFirebaseAuthJason() {
    console.log('\n🔧 ========== CREANDO USUARIO EN FIREBASE AUTH ==========\n');
    
    try {
        const { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const auth = window.firebaseAuth || getAuth();
        const db = window.db || getFirestore();
        
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        
        console.log('📋 Datos:');
        console.log('   Email:', email);
        console.log('   Password:', '[OCULTO]');
        console.log('');
        
        // 1. Verificar si ya existe
        console.log('1️⃣ Verificando si ya existe...');
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                console.log('   ✅ El usuario YA EXISTE');
                console.log('   Métodos:', signInMethods);
                alert('El usuario ya existe en Firebase Auth');
                return;
            }
        } catch (error) {
            console.log('   ❌ No existe, se creará');
        }
        
        // 2. Crear usuario en Firebase Auth
        console.log('\n2️⃣ Creando usuario en Firebase Auth...');
        let userCredential;
        try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('   ✅ Usuario creado exitosamente');
            console.log('   🆔 UID:', userCredential.user.uid);
            console.log('   📧 Email:', userCredential.user.email);
        } catch (error) {
            console.log('   ❌ Error:', error.code);
            console.log('   Mensaje:', error.message);
            
            if (error.code === 'auth/email-already-in-use') {
                console.log('   ⚠️  El email ya está en uso');
                alert('El email ya está en uso. El usuario puede existir con otro método de autenticación.');
                return;
            } else {
                alert('Error creando usuario: ' + error.message);
                return;
            }
        }
        
        // 3. Cerrar sesión inmediatamente
        console.log('\n3️⃣ Cerrando sesión...');
        await signOut(auth);
        console.log('   🔒 Sesión cerrada');
        
        // 4. Actualizar documento en Firestore con el nuevo UID
        console.log('\n4️⃣ Actualizando documento en Firestore...');
        const docRef = doc(db, 'empleados', 'jason.solis');
        await setDoc(docRef, {
            firebaseAuthUID: userCredential.user.uid,
            firebaseAuthEmail: email,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        }, { merge: true });
        console.log('   ✅ Documento actualizado');
        console.log('   Nuevo UID:', userCredential.user.uid);
        
        // 5. Verificación final
        console.log('\n5️⃣ Verificación final...');
        const docVerificado = await getDoc(docRef);
        if (docVerificado.exists()) {
            const datos = docVerificado.data();
            console.log('   ✅ Documento verificado');
            console.log('   Username:', datos.username);
            console.log('   Email:', datos.email);
            console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datos.firebaseAuthUID);
        }
        
        // 6. Resumen
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('Firebase Auth: ✅ Usuario creado');
        console.log('Firestore: ✅ Documento actualizado');
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username: jason.solis');
        console.log('   Email:', email);
        console.log('   Password:', password);
        console.log('   UID:', userCredential.user.uid);
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Usuario creado exitosamente!\n\n' +
              'Firebase Auth: ✅ Usuario creado\n' +
              'Firestore: ✅ Documento actualizado\n\n' +
              'Ahora puedes iniciar sesión con:\n' +
              'Username: jason.solis\n' +
              'Email: ' + email + '\n' +
              'Password: ' + password);
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('Error: ' + error.message);
    }
})();
