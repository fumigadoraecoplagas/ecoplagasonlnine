// Script completo: Crear usuario en Firebase Auth y corregir documento
// Ejecutar en la consola de empleados.html

(async function crearYCorregirJasonSolis() {
    console.log('\n🔧 ========== CREAR Y CORREGIR jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = window.firebaseAuth || getAuth();
        
        // 1. Verificar documento
        console.log('1️⃣ Verificando documento en Firestore...');
        const docRef = doc(db, 'empleados', 'jose.solis');
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.log('❌ Documento no encontrado');
            alert('Documento no encontrado');
            return;
        }
        
        const datos = docSnap.data();
        console.log('   ✅ Documento encontrado');
        console.log('   Username actual:', datos.username);
        console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
        console.log('   Firebase Auth UID:', datos.firebaseAuthUID || 'N/A');
        
        // Determinar email a usar
        const emailFirebase = datos.firebaseAuthEmail || 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        const usernameCorrecto = datos.username || 'jason.solis';
        
        console.log('\n   Email a usar:', emailFirebase);
        console.log('   Username correcto:', usernameCorrecto);
        
        // 2. Verificar si existe en Firebase Auth
        console.log('\n2️⃣ Verificando Firebase Auth...');
        let signInMethods = [];
        try {
            signInMethods = await fetchSignInMethodsForEmail(auth, emailFirebase);
            if (signInMethods.length > 0) {
                console.log('   ✅ Usuario YA EXISTE en Firebase Auth');
                console.log('   Métodos:', signInMethods);
            } else {
                console.log('   ❌ Usuario NO EXISTE en Firebase Auth');
            }
        } catch (error) {
            console.log('   ⚠️  Error verificando:', error.message);
        }
        
        // 3. Crear usuario en Firebase Auth si no existe
        let uid = null;
        if (signInMethods.length === 0) {
            console.log('\n3️⃣ Creando usuario en Firebase Auth...');
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, emailFirebase, password);
                uid = userCredential.user.uid;
                console.log('   ✅ Usuario creado exitosamente');
                console.log('   🆔 UID:', uid);
                console.log('   📧 Email:', userCredential.user.email);
                
                // Cerrar sesión inmediatamente
                await signOut(auth);
                console.log('   🔒 Sesión cerrada');
            } catch (error) {
                console.log('   ❌ Error creando usuario:', error.code);
                console.log('   Mensaje:', error.message);
                if (error.code === 'auth/email-already-in-use') {
                    console.log('   ⚠️  El email ya está en uso (puede ser que exista pero no se detectó)');
                    // Intentar obtener el UID del documento si existe
                    if (datos.firebaseAuthUID) {
                        uid = datos.firebaseAuthUID;
                        console.log('   Usando UID del documento:', uid);
                    }
                } else {
                    alert('Error creando usuario: ' + error.message);
                    return;
                }
            }
        } else {
            // Usuario ya existe, obtener UID del documento o intentar obtenerlo
            if (datos.firebaseAuthUID) {
                uid = datos.firebaseAuthUID;
                console.log('   Usando UID del documento:', uid);
            } else {
                console.log('   ⚠️  Usuario existe pero no hay UID en el documento');
                console.log('   Necesitas obtener el UID manualmente desde Firebase Console');
            }
        }
        
        // 4. Actualizar documento en Firestore
        console.log('\n4️⃣ Actualizando documento en Firestore...');
        
        const datosActualizados = {
            username: usernameCorrecto, // Mantener o corregir username
            firebaseAuthEmail: emailFirebase,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        };
        
        if (uid) {
            datosActualizados.firebaseAuthUID = uid;
        }
        
        // Mantener otros campos importantes
        if (datos.email) {
            datosActualizados.email = datos.email;
        }
        
        await setDoc(docRef, datosActualizados, { merge: true });
        console.log('   ✅ Documento actualizado');
        console.log('   Username:', usernameCorrecto);
        console.log('   Firebase Auth Email:', emailFirebase);
        if (uid) {
            console.log('   Firebase Auth UID:', uid);
        }
        
        // 5. Si el ID del documento no coincide con el username, crear documento con ID correcto
        const docIdActual = docRef.id; // 'jose.solis'
        if (docIdActual !== usernameCorrecto && usernameCorrecto === 'jason.solis') {
            console.log('\n5️⃣ El ID del documento no coincide con el username...');
            console.log('   ID actual:', docIdActual);
            console.log('   Username correcto:', usernameCorrecto);
            console.log('   Creando documento con ID correcto...');
            
            const docCorrecto = doc(db, 'empleados', usernameCorrecto);
            await setDoc(docCorrecto, {
                ...datos,
                ...datosActualizados,
                idDocumentoOriginal: docIdActual,
                migradoDesde: docIdActual,
                fechaMigracion: new Date().toISOString()
            }, { merge: true });
            
            console.log('   ✅ Documento creado con ID correcto:', usernameCorrecto);
            console.log('\n⚠️  IMPORTANTE:');
            console.log('   Ahora existen DOS documentos:');
            console.log('   1. ' + docIdActual + ' (documento original)');
            console.log('   2. ' + usernameCorrecto + ' (documento nuevo con ID correcto)');
            console.log('   El sistema buscará por username, así que usará: ' + usernameCorrecto);
        }
        
        // 6. Verificación final
        console.log('\n6️⃣ Verificación final...');
        const docFinal = await getDoc(docRef);
        if (docFinal.exists()) {
            const datosFinales = docFinal.data();
            console.log('   ✅ Documento verificado');
            console.log('   Username:', datosFinales.username);
            console.log('   Firebase Auth Email:', datosFinales.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datosFinales.firebaseAuthUID || 'N/A');
        }
        
        // 7. Resumen
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('Firebase Auth:', uid ? '✅ Usuario creado/verificado' : '⚠️  Verificar manualmente');
        console.log('Firestore: ✅ Documento actualizado');
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username:', usernameCorrecto);
        console.log('   Email:', emailFirebase);
        console.log('   Password:', password);
        if (uid) {
            console.log('   UID:', uid);
        }
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Proceso completado!\n\n' +
              'Firebase Auth: ' + (uid ? '✅ Usuario creado' : '⚠️ Verificar') + '\n' +
              'Firestore: ✅ Documento actualizado\n\n' +
              'Credenciales:\n' +
              'Username: ' + usernameCorrecto + '\n' +
              'Email: ' + emailFirebase + '\n' +
              'Password: ' + password);
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('Error: ' + error.message);
    }
})();
