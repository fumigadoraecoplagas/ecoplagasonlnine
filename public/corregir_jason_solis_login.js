// Script para corregir jason.solis y permitir login con jose.solis
// Ejecutar en la consola del navegador cuando estés autenticado como administrador

(async function corregirJasonSolisLogin() {
    console.log('🔧 ========== CORRIGIENDO jason.solis PARA LOGIN ==========');
    console.log('');
    
    try {
        const { getFirestore, doc, getDoc, updateDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = getAuth();
        
        // 1. Buscar documento de jason.solis
        console.log('1️⃣ Buscando documento de jason.solis...');
        const docRefJason = doc(db, 'empleados', 'jason.solis');
        const docSnapJason = await getDoc(docRefJason);
        
        if (!docSnapJason.exists()) {
            // Buscar en todos los documentos
            console.log('   🔍 No encontrado por ID, buscando en todos los documentos...');
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let encontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                if (emp.username === 'jason.solis' || emp.username === 'jose.solis') {
                    encontrado = { docRef: doc(db, 'empleados', doc.id), datos: emp };
                }
            });
            
            if (!encontrado) {
                alert('❌ No se encontró el documento de jason.solis');
                return;
            }
            
            console.log('   ✅ Documento encontrado con ID:', encontrado.datos.id);
            var docRef = encontrado.docRef;
            var datosJason = encontrado.datos;
        } else {
            var docRef = docRefJason;
            var datosJason = docSnapJason.data();
            console.log('   ✅ Documento encontrado');
        }
        
        console.log('   📄 Datos actuales:', datosJason);
        console.log('   📧 Email Firebase Auth actual:', datosJason.firebaseAuthEmail || 'No configurado');
        console.log('   🆔 UID Firebase Auth actual:', datosJason.firebaseAuthUID || 'No configurado');
        console.log('');
        
        // 2. Verificar Firebase Auth
        console.log('2️⃣ Verificando Firebase Auth...');
        const emailViejo = 'rh+jose.solis@ecoplagascr.com';
        const emailNuevo = 'rh+jason.solis@ecoplagascr.com';
        
        let emailFirebase = null;
        let uidFirebase = null;
        
        try {
            // Verificar si existe usuario con email viejo
            const signInMethodsViejo = await fetchSignInMethodsForEmail(auth, emailViejo);
            if (signInMethodsViejo.length > 0) {
                emailFirebase = emailViejo;
                console.log('   ✅ Usuario existe en Firebase Auth con email:', emailViejo);
                
                // Intentar obtener el UID (necesitamos que el usuario esté autenticado o usar Admin SDK)
                // Por ahora, usaremos el UID del documento si existe
                uidFirebase = datosJason.firebaseAuthUID || null;
                if (uidFirebase) {
                    console.log('   🆔 UID encontrado en documento:', uidFirebase);
                } else {
                    console.log('   ⚠️  UID no disponible en documento');
                    console.log('   💡 El UID se actualizará automáticamente cuando el usuario inicie sesión');
                }
            } else {
                // Verificar si existe con email nuevo
                const signInMethodsNuevo = await fetchSignInMethodsForEmail(auth, emailNuevo);
                if (signInMethodsNuevo.length > 0) {
                    emailFirebase = emailNuevo;
                    console.log('   ✅ Usuario existe en Firebase Auth con email:', emailNuevo);
                    uidFirebase = datosJason.firebaseAuthUID || null;
                } else {
                    console.log('   ❌ No se encontró usuario en Firebase Auth');
                    console.log('   💡 El usuario necesita ser creado en Firebase Auth');
                    alert('❌ No se encontró usuario en Firebase Auth.\n\n' +
                          'El usuario debe ser creado en Firebase Auth primero.\n' +
                          'Puedes hacerlo desde la sección de empleados.');
                    return;
                }
            }
        } catch (error) {
            console.warn('   ⚠️  Error verificando Firebase Auth:', error.message);
        }
        
        if (!emailFirebase) {
            alert('❌ No se pudo determinar el email de Firebase Auth');
            return;
        }
        
        // 3. Actualizar documento
        console.log('');
        console.log('3️⃣ Actualizando documento en Firestore...');
        
        const datosActualizados = {
            username: 'jason.solis', // Mantener username como jason.solis
            firebaseAuthEmail: emailFirebase, // Usar el email que existe en Firebase Auth
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            correccionLogin: {
                fecha: new Date().toISOString(),
                motivo: 'Corrección para permitir login con jose.solis mientras el documento tiene username jason.solis',
                emailConfigurado: emailFirebase,
                usernameDocumento: 'jason.solis',
                usernameLogin: 'jose.solis'
            }
        };
        
        // Si hay UID, mantenerlo o actualizarlo
        if (uidFirebase) {
            datosActualizados.firebaseAuthUID = uidFirebase;
        }
        
        await updateDoc(docRef, datosActualizados);
        console.log('   ✅ Documento actualizado');
        console.log('   📧 Email Firebase Auth configurado:', emailFirebase);
        console.log('   👤 Username:', 'jason.solis');
        if (uidFirebase) {
            console.log('   🆔 UID:', uidFirebase);
        }
        
        console.log('');
        console.log('✅ Corrección completada');
        console.log('');
        console.log('📝 RESUMEN:');
        console.log('   - El documento en Firestore tiene username: jason.solis');
        console.log('   - El firebaseAuthEmail se configuró como:', emailFirebase);
        console.log('   - El usuario puede iniciar sesión como: jose.solis');
        console.log('   - El sistema encontrará el documento por email o UID');
        console.log('');
        console.log('💡 INSTRUCCIONES:');
        console.log('   - El usuario debe iniciar sesión como: jose.solis');
        console.log('   - El sistema encontrará el documento con username: jason.solis');
        console.log('   - La búsqueda funcionará por email o UID de Firebase Auth');
        
        alert('✅ Corrección completada!\n\n' +
              'Documento actualizado:\n' +
              '- Username: jason.solis\n' +
              '- Email Firebase Auth: ' + emailFirebase + '\n\n' +
              'INSTRUCCIONES:\n' +
              'El usuario debe iniciar sesión como: jose.solis\n' +
              'El sistema encontrará el documento correctamente.');
        
    } catch (error) {
        console.error('❌ Error en la corrección:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('❌ Error: ' + error.message);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
