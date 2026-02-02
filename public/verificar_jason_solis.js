// Script para verificar credenciales de jason.solis
// Ejecutar en la consola del navegador cuando estés autenticado

(async function verificarJasonSolis() {
    console.log('\n🔍 ========== VERIFICANDO CREDENCIALES DE jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, signInWithEmailAndPassword, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = getAuth();
        
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        const username = 'jason.solis';
        
        console.log('📧 Email a verificar:', email);
        console.log('👤 Username:', username);
        console.log('');
        
        // 1. Verificar si existe en Firebase Auth
        console.log('1️⃣ Verificando Firebase Authentication...');
        let signInMethods = [];
        try {
            signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                console.log('   ✅ Usuario EXISTE en Firebase Auth');
                console.log('   📋 Métodos de autenticación:', signInMethods);
            } else {
                console.log('   ❌ Usuario NO EXISTE en Firebase Auth');
                console.log('   ⚠️  El usuario necesita ser creado en Firebase Auth');
            }
        } catch (error) {
            console.log('   ⚠️  Error verificando Firebase Auth:', error.message);
        }
        
        // 2. Verificar si existe en Firestore
        console.log('\n2️⃣ Verificando Firestore (colección empleados)...');
        let empleadoEncontrado = null;
        let docId = null;
        
        // Buscar por ID del documento
        try {
            const docRef = doc(db, 'empleados', username);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                empleadoEncontrado = { id: docSnap.id, ...docSnap.data() };
                docId = docSnap.id;
                console.log('   ✅ Documento encontrado por ID:', docId);
            } else {
                console.log('   ❌ No encontrado por ID del documento');
            }
        } catch (error) {
            console.log('   ⚠️  Error buscando por ID:', error.message);
        }
        
        // Si no se encontró, buscar en toda la colección
        if (!empleadoEncontrado) {
            console.log('   🔍 Buscando en toda la colección...');
            try {
                const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
                empleadosSnapshot.forEach(doc => {
                    const data = doc.data();
                    const id = doc.id;
                    
                    if (id === username || 
                        data.username === username ||
                        data.email === email ||
                        (data.firebaseAuthEmail && data.firebaseAuthEmail === email)) {
                        empleadoEncontrado = { id: id, ...data };
                        docId = id;
                        console.log('   ✅ Encontrado en colección con ID:', id);
                    }
                });
            } catch (error) {
                console.log('   ⚠️  Error buscando en colección:', error.message);
            }
        }
        
        if (empleadoEncontrado) {
            console.log('\n   📄 Datos del empleado encontrado:');
            console.log('      - ID del documento:', docId);
            console.log('      - Username:', empleadoEncontrado.username || 'N/A');
            console.log('      - Nombre:', `${empleadoEncontrado.primerNombre || ''} ${empleadoEncontrado.primerApellido || ''}`.trim() || 'N/A');
            console.log('      - Email:', empleadoEncontrado.email || 'N/A');
            console.log('      - Firebase Auth Email:', empleadoEncontrado.firebaseAuthEmail || 'N/A');
            console.log('      - Firebase Auth UID:', empleadoEncontrado.firebaseAuthUID || 'N/A');
            console.log('      - Estado:', empleadoEncontrado.estado || empleadoEncontrado.activo || 'N/A');
        } else {
            console.log('\n   ❌ NO se encontró el empleado en Firestore');
        }
        
        // 3. Intentar login con las credenciales proporcionadas
        console.log('\n3️⃣ Intentando login con las credenciales proporcionadas...');
        console.log('   Email:', email);
        console.log('   Password: [OCULTO]');
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('   ✅ LOGIN EXITOSO');
            console.log('   🆔 UID:', userCredential.user.uid);
            console.log('   📧 Email verificado:', userCredential.user.email);
            console.log('   ✅ Las credenciales son CORRECTAS');
            
            // Cerrar sesión inmediatamente para no dejar sesión abierta
            await auth.signOut();
            console.log('   🔒 Sesión cerrada');
            
        } catch (loginError) {
            console.log('   ❌ LOGIN FALLIDO');
            console.log('   Código de error:', loginError.code);
            console.log('   Mensaje:', loginError.message);
            
            if (loginError.code === 'auth/user-not-found') {
                console.log('   ⚠️  El usuario NO EXISTE en Firebase Auth');
            } else if (loginError.code === 'auth/wrong-password') {
                console.log('   ⚠️  La contraseña es INCORRECTA');
            } else if (loginError.code === 'auth/invalid-email') {
                console.log('   ⚠️  El email es INVÁLIDO');
            } else {
                console.log('   ⚠️  Error desconocido:', loginError.code);
            }
        }
        
        // 4. Resumen final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN FINAL');
        console.log('='.repeat(60));
        
        const existeEnAuth = signInMethods && signInMethods.length > 0;
        const existeEnFirestore = empleadoEncontrado !== null;
        
        console.log('Firebase Auth:', existeEnAuth ? '✅ EXISTE' : '❌ NO EXISTE');
        console.log('Firestore:', existeEnFirestore ? '✅ EXISTE' : '❌ NO EXISTE');
        
        if (existeEnAuth && existeEnFirestore) {
            console.log('\n✅ El usuario está configurado correctamente en ambos sistemas');
        } else if (!existeEnAuth && existeEnFirestore) {
            console.log('\n⚠️  PROBLEMA: El usuario existe en Firestore pero NO en Firebase Auth');
            console.log('   SOLUCIÓN: Crear el usuario en Firebase Auth con el email:', email);
        } else if (existeEnAuth && !existeEnFirestore) {
            console.log('\n⚠️  PROBLEMA: El usuario existe en Firebase Auth pero NO en Firestore');
            console.log('   SOLUCIÓN: Crear el documento en Firestore con username:', username);
        } else {
            console.log('\n❌ PROBLEMA: El usuario NO EXISTE en ningún sistema');
            console.log('   SOLUCIÓN: Crear el usuario en ambos sistemas');
        }
        
        console.log('='.repeat(60) + '\n');
        
        return {
            existeEnAuth,
            existeEnFirestore,
            empleadoEncontrado,
            docId
        };
        
    } catch (error) {
        console.error('\n❌ Error en la verificación:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        throw error;
    }
})();
