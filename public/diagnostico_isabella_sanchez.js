// Script de diagnóstico para isabella.sanchez
// Ejecutar en la consola del navegador cuando estés autenticado

(async function diagnosticarIsabellaSanchez() {
    console.log('🔍 ========== DIAGNÓSTICO: isabella.sanchez ==========');
    console.log('');
    
    try {
        const username = 'isabella.sanchez';
        const { getFirestore, doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = getAuth();
        
        // 1. Verificar documento en Firestore
        console.log('1️⃣ VERIFICANDO DOCUMENTO EN FIRESTORE...');
        const docRef = doc(db, 'empleados', username);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const datos = docSnap.data();
            console.log('   ✅ Documento encontrado');
            console.log('   📄 Datos:', datos);
            console.log('   👤 Username:', datos.username);
            console.log('   📧 Email Firebase Auth:', datos.firebaseAuthEmail || 'No configurado');
            console.log('   🆔 UID Firebase Auth:', datos.firebaseAuthUID || 'No configurado');
            console.log('   🔑 passwordPlain:', datos.passwordPlain ? 'Existe' : 'No existe');
            console.log('   🔐 Estado:', datos.estado || datos.activo || 'No especificado');
            console.log('   🔑 Permisos:', datos.permisos || 'No configurados');
        } else {
            console.log('   ❌ Documento NO encontrado por ID');
            console.log('   🔍 Buscando en todos los documentos...');
            
            const empleadosRef = collection(db, 'empleados');
            const empleadosSnapshot = await getDocs(empleadosRef);
            
            let encontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                if (emp.username === username || 
                    emp.username?.toLowerCase() === username.toLowerCase() ||
                    emp.username?.includes('isabella') ||
                    emp.username?.includes('sanchez')) {
                    encontrado = emp;
                }
            });
            
            if (encontrado) {
                console.log('   ✅ Empleado encontrado (ID del documento:', encontrado.id, ')');
                console.log('   📄 Datos:', encontrado);
            } else {
                console.log('   ❌ Empleado NO encontrado en ningún documento');
            }
        }
        
        console.log('');
        
        // 2. Verificar Firebase Auth
        console.log('2️⃣ VERIFICANDO FIREBASE AUTH...');
        const emailEsperado = `rh+${username}@ecoplagascr.com`;
        console.log('   Email esperado:', emailEsperado);
        
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, emailEsperado);
            if (signInMethods.length > 0) {
                console.log('   ✅ Usuario existe en Firebase Auth');
                console.log('   📧 Email:', emailEsperado);
                console.log('   🔐 Métodos de autenticación:', signInMethods);
            } else {
                console.log('   ❌ Usuario NO existe en Firebase Auth');
                console.log('   💡 El usuario necesita ser creado en Firebase Auth');
            }
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('   ❌ Usuario NO existe en Firebase Auth');
            } else {
                console.log('   ⚠️  Error verificando Firebase Auth:', error.message);
            }
        }
        
        console.log('');
        
        // 3. Verificar posibles variaciones del email
        console.log('3️⃣ VERIFICANDO VARIACIONES DEL EMAIL...');
        const variaciones = [
            'rh+isabella.sanchez@ecoplagascr.com',
            'rh+isabellasanchez@ecoplagascr.com',
            'rh+isabella_sanchez@ecoplagascr.com'
        ];
        
        for (const emailVar of variaciones) {
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, emailVar);
                if (signInMethods.length > 0) {
                    console.log('   ✅ Usuario encontrado con email:', emailVar);
                }
            } catch (e) {
                // Ignorar errores
            }
        }
        
        console.log('');
        console.log('✅ Diagnóstico completado');
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
