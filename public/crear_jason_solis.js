// Script para crear jason.solis en Firebase Auth y Firestore
// Ejecutar en la consola del navegador cuando estés autenticado como administrador

(async function crearJasonSolis() {
    console.log('\n🔧 ========== CREANDO jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = getAuth();
        
        const username = 'jason.solis';
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        
        console.log('📋 Datos a crear:');
        console.log('   Username:', username);
        console.log('   Email:', email);
        console.log('   Password:', '[OCULTO]');
        console.log('');
        
        // 1. Verificar si ya existe en Firebase Auth
        console.log('1️⃣ Verificando si ya existe en Firebase Auth...');
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                console.log('   ⚠️  El usuario YA EXISTE en Firebase Auth');
                console.log('   Saltando creación en Firebase Auth...');
            } else {
                console.log('   ✅ No existe, se creará');
            }
        } catch (error) {
            console.log('   ⚠️  Error verificando:', error.message);
        }
        
        // 2. Verificar si ya existe en Firestore
        console.log('\n2️⃣ Verificando si ya existe en Firestore...');
        const docRef = doc(db, 'empleados', username);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            console.log('   ⚠️  El documento YA EXISTE en Firestore');
            console.log('   Datos actuales:', docSnap.data());
            const confirmar = confirm('El empleado ya existe en Firestore. ¿Deseas actualizarlo?');
            if (!confirmar) {
                console.log('   ❌ Operación cancelada');
                return;
            }
        } else {
            console.log('   ✅ No existe, se creará');
        }
        
        // 3. Crear/actualizar documento en Firestore
        console.log('\n3️⃣ Creando/actualizando documento en Firestore...');
        
        const empleadoData = {
            username: username,
            email: email,
            primerNombre: 'Jason',
            primerApellido: 'Solis',
            estado: 'Activo',
            activo: true,
            passwordPlain: password, // Guardar contraseña en texto plano para referencia
            firebaseAuthEmail: email,
            firebaseAuthMigrated: false,
            fechaCreacion: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString(),
            creadoPor: auth.currentUser?.email || 'sistema',
            permisos: {
                // Agregar permisos básicos según necesidad
            }
        };
        
        // Si ya existe, mantener datos existentes y solo actualizar campos necesarios
        if (docSnap.exists()) {
            const datosExistentes = docSnap.data();
            // Mantener campos importantes que ya existen
            empleadoData.permisos = datosExistentes.permisos || empleadoData.permisos;
            empleadoData.departamento = datosExistentes.departamento;
            empleadoData.cargo = datosExistentes.cargo;
            empleadoData.telefono = datosExistentes.telefono;
            empleadoData.fechaCreacion = datosExistentes.fechaCreacion || empleadoData.fechaCreacion;
        }
        
        await setDoc(docRef, empleadoData, { merge: true });
        console.log('   ✅ Documento creado/actualizado en Firestore');
        console.log('   ID del documento:', username);
        
        // 4. Crear usuario en Firebase Auth (si no existe)
        console.log('\n4️⃣ Creando usuario en Firebase Auth...');
        let uid = null;
        
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                console.log('   ⚠️  El usuario ya existe en Firebase Auth');
                console.log('   Necesitas obtener el UID manualmente o resetear la contraseña');
                console.log('   Email:', email);
            } else {
                // Crear usuario en Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                uid = userCredential.user.uid;
                console.log('   ✅ Usuario creado en Firebase Auth');
                console.log('   UID:', uid);
                console.log('   Email:', userCredential.user.email);
                
                // Cerrar sesión inmediatamente
                await signOut(auth);
                console.log('   🔒 Sesión cerrada');
                
                // Actualizar documento con UID
                await setDoc(docRef, {
                    firebaseAuthUID: uid,
                    firebaseAuthEmail: email,
                    firebaseAuthMigrated: true,
                    firebaseAuthMigratedAt: new Date().toISOString()
                }, { merge: true });
                console.log('   ✅ Documento actualizado con UID de Firebase Auth');
            }
        } catch (authError) {
            console.log('   ❌ Error creando usuario en Firebase Auth:', authError.code);
            console.log('   Mensaje:', authError.message);
            
            if (authError.code === 'auth/email-already-in-use') {
                console.log('   ⚠️  El email ya está en uso');
                console.log('   El documento en Firestore se creó, pero necesitas vincularlo manualmente');
            }
        }
        
        // 5. Verificación final
        console.log('\n5️⃣ Verificación final...');
        const docFinal = await getDoc(docRef);
        if (docFinal.exists()) {
            const datosFinales = docFinal.data();
            console.log('   ✅ Documento verificado en Firestore');
            console.log('   Username:', datosFinales.username);
            console.log('   Email:', datosFinales.email);
            console.log('   Firebase Auth Email:', datosFinales.firebaseAuthEmail || 'N/A');
            console.log('   Firebase Auth UID:', datosFinales.firebaseAuthUID || 'N/A');
            console.log('   Estado:', datosFinales.estado || 'N/A');
        }
        
        // Resumen final
        console.log('\n' + '='.repeat(60));
        console.log('✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));
        console.log('Firestore: ✅ Documento creado/actualizado');
        console.log('Firebase Auth:', uid ? '✅ Usuario creado' : '⚠️  Verificar manualmente');
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username:', username);
        console.log('   Email:', email);
        console.log('   Password:', password);
        console.log('='.repeat(60) + '\n');
        
        alert('✅ jason.solis creado exitosamente!\n\n' +
              'Firestore: ✅ Documento creado\n' +
              'Firebase Auth: ' + (uid ? '✅ Usuario creado' : '⚠️ Verificar manualmente') + '\n\n' +
              'Credenciales:\n' +
              'Username: ' + username + '\n' +
              'Email: ' + email + '\n' +
              'Password: ' + password);
        
    } catch (error) {
        console.error('\n❌ Error en la creación:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('❌ Error: ' + error.message);
        throw error;
    }
})();
