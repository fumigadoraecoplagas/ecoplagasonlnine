// Script para crear jason.solis en Firebase Auth solamente
// Ejecutar en la consola de empleados.html cuando estés autenticado

(async function crearFirebaseAuthJason() {
    console.log('\n🔧 ========== CREANDO jason.solis EN FIREBASE AUTH ==========\n');
    
    try {
        const { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const auth = window.firebaseAuth || getAuth();
        const db = window.db || getFirestore();
        
        const username = 'jason.solis';
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        
        console.log('📋 Datos:');
        console.log('   Username:', username);
        console.log('   Email:', email);
        console.log('   Password:', '[OCULTO]');
        console.log('');
        
        // 1. Verificar si ya existe
        console.log('1️⃣ Verificando si ya existe...');
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                console.log('   ⚠️  El usuario YA EXISTE en Firebase Auth');
                console.log('   Métodos:', signInMethods);
                alert('El usuario ya existe en Firebase Auth. No se necesita crear.');
                return;
            }
        } catch (error) {
            console.log('   ✅ No existe, se creará');
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
            alert('Error creando usuario: ' + error.message);
            return;
        }
        
        // 3. Cerrar sesión inmediatamente
        console.log('\n3️⃣ Cerrando sesión...');
        await signOut(auth);
        console.log('   🔒 Sesión cerrada');
        
        // 4. Actualizar documento en Firestore con el UID
        console.log('\n4️⃣ Actualizando documento en Firestore...');
        try {
            // El documento tiene ID "jose.solis" pero username "jason.solis"
            const docRefJose = doc(db, 'empleados', 'jose.solis');
            const docSnap = await getDoc(docRefJose);
            
            if (docSnap.exists()) {
                await setDoc(docRefJose, {
                    firebaseAuthUID: userCredential.user.uid,
                    firebaseAuthEmail: email,
                    firebaseAuthMigrated: true,
                    firebaseAuthMigratedAt: new Date().toISOString()
                }, { merge: true });
                console.log('   ✅ Documento actualizado con UID');
            } else {
                // Intentar con jason.solis como ID
                const docRefJason = doc(db, 'empleados', 'jason.solis');
                await setDoc(docRefJason, {
                    firebaseAuthUID: userCredential.user.uid,
                    firebaseAuthEmail: email,
                    firebaseAuthMigrated: true,
                    firebaseAuthMigratedAt: new Date().toISOString()
                }, { merge: true });
                console.log('   ✅ Documento actualizado con UID');
            }
        } catch (error) {
            console.log('   ⚠️  Error actualizando Firestore:', error.message);
            console.log('   El usuario en Firebase Auth se creó correctamente');
        }
        
        // 5. Resumen
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('Firebase Auth: ✅ Usuario creado');
        console.log('UID:', userCredential.user.uid);
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username: jason.solis');
        console.log('   Email:', email);
        console.log('   Password:', password);
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Usuario creado exitosamente en Firebase Auth!\n\n' +
              'UID: ' + userCredential.user.uid + '\n\n' +
              'Ahora puedes iniciar sesión con:\n' +
              'Username: jason.solis\n' +
              'Email: ' + email + '\n' +
              'Password: ' + password);
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        alert('❌ Error: ' + error.message);
    }
})();
