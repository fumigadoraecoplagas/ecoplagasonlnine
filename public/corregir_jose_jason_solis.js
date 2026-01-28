// Script para corregir el problema de jose.solis / jason.solis
// El documento tiene ID "jose.solis" pero username "jason.solis"
// Necesitamos sincronizar esto correctamente

(async function corregirJoseJasonSolis() {
    console.log('\n🔧 ========== CORRIGIENDO jose.solis / jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = window.firebaseAuth || getAuth();
        
        // 1. Verificar qué existe
        console.log('1️⃣ Verificando documentos en Firestore...');
        
        const docJose = doc(db, 'empleados', 'jose.solis');
        const docJason = doc(db, 'empleados', 'jason.solis');
        
        const snapJose = await getDoc(docJose);
        const snapJason = await getDoc(docJason);
        
        let documentoPrincipal = null;
        let datosDocumento = null;
        
        if (snapJose.exists()) {
            documentoPrincipal = docJose;
            datosDocumento = snapJose.data();
            console.log('   ✅ Documento encontrado: jose.solis');
            console.log('   Username en documento:', datosDocumento.username);
            console.log('   Email en documento:', datosDocumento.email);
            console.log('   Firebase Auth Email:', datosDocumento.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datosDocumento.firebaseAuthUID);
        } else if (snapJason.exists()) {
            documentoPrincipal = docJason;
            datosDocumento = snapJason.data();
            console.log('   ✅ Documento encontrado: jason.solis');
        } else {
            console.log('   ❌ No se encontró ningún documento');
            alert('No se encontró el documento');
            return;
        }
        
        // 2. Verificar Firebase Auth
        console.log('\n2️⃣ Verificando Firebase Auth...');
        
        const emailsAVerificar = [
            'rh+jose.solis@ecoplagascr.com',
            'rh+jason.solis@ecoplagascr.com'
        ];
        
        let emailFirebaseAuth = null;
        let uidFirebaseAuth = null;
        
        for (const email of emailsAVerificar) {
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, email);
                if (signInMethods.length > 0) {
                    emailFirebaseAuth = email;
                    console.log('   ✅ Usuario encontrado en Firebase Auth:', email);
                    // Intentar obtener UID del documento si existe
                    if (datosDocumento.firebaseAuthEmail === email && datosDocumento.firebaseAuthUID) {
                        uidFirebaseAuth = datosDocumento.firebaseAuthUID;
                        console.log('   UID encontrado en documento:', uidFirebaseAuth);
                    }
                    break;
                }
            } catch (error) {
                // Continuar con el siguiente email
            }
        }
        
        if (!emailFirebaseAuth) {
            console.log('   ❌ No se encontró usuario en Firebase Auth');
            console.log('   Necesitas crear el usuario en Firebase Auth primero');
            alert('No se encontró usuario en Firebase Auth. Crea el usuario primero.');
            return;
        }
        
        // 3. Determinar qué username usar
        console.log('\n3️⃣ Determinando configuración correcta...');
        
        // Extraer username del email de Firebase Auth
        const usernameDelEmail = emailFirebaseAuth.replace('rh+', '').replace('@ecoplagascr.com', '');
        console.log('   Username del email Firebase Auth:', usernameDelEmail);
        console.log('   Username en documento Firestore:', datosDocumento.username);
        
        // Decidir qué hacer:
        // Si el email es rh+jose.solis@... entonces el username debería ser jose.solis
        // Si el email es rh+jason.solis@... entonces el username debería ser jason.solis
        
        const usernameCorrecto = usernameDelEmail; // jose.solis o jason.solis
        const emailCorrecto = emailFirebaseAuth;
        
        console.log('   Username correcto:', usernameCorrecto);
        console.log('   Email correcto:', emailCorrecto);
        
        // 4. Actualizar documento
        console.log('\n4️⃣ Actualizando documento...');
        
        const datosActualizados = {
            username: usernameCorrecto, // Sincronizar username con el email de Firebase Auth
            firebaseAuthEmail: emailCorrecto,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        };
        
        // Mantener UID si existe
        if (uidFirebaseAuth || datosDocumento.firebaseAuthUID) {
            datosActualizados.firebaseAuthUID = uidFirebaseAuth || datosDocumento.firebaseAuthUID;
        }
        
        // Mantener otros campos importantes
        if (datosDocumento.email && datosDocumento.email !== emailCorrecto) {
            // Mantener el email original si es diferente
            datosActualizados.emailOriginal = datosDocumento.email;
        }
        
        await setDoc(documentoPrincipal, datosActualizados, { merge: true });
        console.log('   ✅ Documento actualizado');
        console.log('   Username:', usernameCorrecto);
        console.log('   Firebase Auth Email:', emailCorrecto);
        
        // 5. Si el ID del documento no coincide con el username, crear/actualizar el documento correcto
        const docIdActual = documentoPrincipal.id;
        if (docIdActual !== usernameCorrecto) {
            console.log('\n5️⃣ El ID del documento no coincide con el username...');
            console.log('   ID actual:', docIdActual);
            console.log('   Username correcto:', usernameCorrecto);
            
            // Crear documento con el ID correcto
            const docCorrecto = doc(db, 'empleados', usernameCorrecto);
            await setDoc(docCorrecto, {
                ...datosDocumento,
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
            console.log('   El sistema buscará por username, así que usará el documento con ID: ' + usernameCorrecto);
        }
        
        // 6. Resumen
        console.log('\n' + '='.repeat(60));
        console.log('✅ CORRECCIÓN COMPLETADA');
        console.log('='.repeat(60));
        console.log('Username configurado:', usernameCorrecto);
        console.log('Email Firebase Auth:', emailCorrecto);
        console.log('ID del documento:', documentoPrincipal.id);
        if (docIdActual !== usernameCorrecto) {
            console.log('Nuevo documento creado:', usernameCorrecto);
        }
        console.log('\n📋 Para iniciar sesión usa:');
        console.log('   Username: ' + usernameCorrecto);
        console.log('   Email: ' + emailCorrecto);
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Corrección completada!\n\n' +
              'Username configurado: ' + usernameCorrecto + '\n' +
              'Email Firebase Auth: ' + emailCorrecto + '\n\n' +
              'Ahora puedes iniciar sesión con:\n' +
              'Username: ' + usernameCorrecto + '\n' +
              'Email: ' + emailCorrecto);
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
