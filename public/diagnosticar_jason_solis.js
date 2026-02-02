// Script de diagnóstico para jason.solis / jaison.solis
// Ejecutar en la consola del navegador cuando estés autenticado

(async function diagnosticarJasonSolis() {
    console.log('\n🔍 ========== DIAGNÓSTICO DE LOGIN ==========\n');
    
    try {
        const { getFirestore, doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getAuth, signInWithEmailAndPassword, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const db = window.db || getFirestore();
        const auth = window.firebaseAuth || getAuth();
        
        const usuariosABuscar = ['jason.solis', 'jaison.solis'];
        const password = 'raiz2490';
        
        console.log('📋 Usuarios a verificar:', usuariosABuscar);
        console.log('🔑 Password a probar:', password);
        console.log('');
        
        // 1. Buscar en Firestore
        console.log('1️⃣ BUSCANDO EN FIRESTORE (colección empleados)');
        console.log('='.repeat(60));
        
        const empleadosEncontrados = {};
        
        for (const username of usuariosABuscar) {
            console.log(`\n🔍 Buscando: ${username}`);
            
            // Buscar por ID del documento
            const docRef = doc(db, 'empleados', username);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const datos = docSnap.data();
                empleadosEncontrados[username] = {
                    encontrado: true,
                    metodo: 'ID del documento',
                    datos: datos,
                    docId: username
                };
                console.log('   ✅ ENCONTRADO por ID del documento');
                console.log('   📄 Datos:', {
                    username: datos.username,
                    email: datos.email,
                    primerNombre: datos.primerNombre,
                    primerApellido: datos.primerApellido,
                    estado: datos.estado || datos.activo,
                    firebaseAuthEmail: datos.firebaseAuthEmail,
                    firebaseAuthUID: datos.firebaseAuthUID
                });
            } else {
                console.log('   ❌ No encontrado por ID del documento');
            }
        }
        
        // Buscar en toda la colección por username o email
        console.log('\n🔍 Buscando en toda la colección...');
        const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
        empleadosSnapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            
            usuariosABuscar.forEach(username => {
                if (!empleadosEncontrados[username] || !empleadosEncontrados[username].encontrado) {
                    if (docId === username || 
                        data.username === username ||
                        data.username?.toLowerCase() === username.toLowerCase() ||
                        (data.email && data.email.toLowerCase().includes(username))) {
                        empleadosEncontrados[username] = {
                            encontrado: true,
                            metodo: 'Búsqueda en colección',
                            datos: data,
                            docId: docId
                        };
                        console.log(`   ✅ ${username} encontrado en colección (ID: ${docId})`);
                        console.log('   📄 Datos:', {
                            docId: docId,
                            username: data.username,
                            email: data.email,
                            primerNombre: data.primerNombre,
                            primerApellido: data.primerApellido,
                            estado: data.estado || data.activo,
                            firebaseAuthEmail: data.firebaseAuthEmail,
                            firebaseAuthUID: data.firebaseAuthUID
                        });
                    }
                }
            });
        });
        
        // 2. Verificar Firebase Auth
        console.log('\n\n2️⃣ VERIFICANDO FIREBASE AUTHENTICATION');
        console.log('='.repeat(60));
        
        const authVerificados = {};
        
        for (const username of usuariosABuscar) {
            const email = `rh+${username}@ecoplagascr.com`;
            console.log(`\n🔍 Verificando email: ${email}`);
            
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, email);
                if (signInMethods.length > 0) {
                    authVerificados[username] = {
                        existe: true,
                        email: email,
                        signInMethods: signInMethods
                    };
                    console.log('   ✅ Usuario EXISTE en Firebase Auth');
                    console.log('   📋 Métodos de autenticación:', signInMethods);
                } else {
                    authVerificados[username] = {
                        existe: false,
                        email: email
                    };
                    console.log('   ❌ Usuario NO EXISTE en Firebase Auth');
                }
            } catch (error) {
                authVerificados[username] = {
                    existe: false,
                    email: email,
                    error: error.message
                };
                console.log('   ⚠️  Error verificando:', error.message);
            }
        }
        
        // 3. Intentar login con cada usuario
        console.log('\n\n3️⃣ PROBANDO LOGIN');
        console.log('='.repeat(60));
        
        const resultadosLogin = {};
        
        for (const username of usuariosABuscar) {
            const email = `rh+${username}@ecoplagascr.com`;
            console.log(`\n🔐 Intentando login con: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
            
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                resultadosLogin[username] = {
                    exito: true,
                    uid: userCredential.user.uid,
                    email: userCredential.user.email
                };
                console.log('   ✅ LOGIN EXITOSO');
                console.log('   🆔 UID:', userCredential.user.uid);
                console.log('   📧 Email:', userCredential.user.email);
                
                // Cerrar sesión inmediatamente
                const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
                await signOut(auth);
                console.log('   🔒 Sesión cerrada');
                
            } catch (loginError) {
                resultadosLogin[username] = {
                    exito: false,
                    error: loginError.code,
                    mensaje: loginError.message
                };
                console.log('   ❌ LOGIN FALLIDO');
                console.log('   Código:', loginError.code);
                console.log('   Mensaje:', loginError.message);
                
                // Explicar el error
                if (loginError.code === 'auth/user-not-found') {
                    console.log('   💡 EXPLICACIÓN: El usuario NO EXISTE en Firebase Auth');
                    console.log('   💡 SOLUCIÓN: Crear el usuario en Firebase Auth');
                } else if (loginError.code === 'auth/wrong-password') {
                    console.log('   💡 EXPLICACIÓN: La contraseña es INCORRECTA');
                    console.log('   💡 SOLUCIÓN: Verificar la contraseña o resetearla');
                } else if (loginError.code === 'auth/invalid-email') {
                    console.log('   💡 EXPLICACIÓN: El email es INVÁLIDO');
                    console.log('   💡 SOLUCIÓN: Verificar el formato del email');
                } else if (loginError.code === 'auth/invalid-credential') {
                    console.log('   💡 EXPLICACIÓN: Credenciales inválidas (usuario no existe o contraseña incorrecta)');
                    console.log('   💡 SOLUCIÓN: Verificar que el usuario existe y la contraseña es correcta');
                } else {
                    console.log('   💡 EXPLICACIÓN: Error desconocido');
                }
            }
        }
        
        // 4. Análisis y diagnóstico
        console.log('\n\n4️⃣ ANÁLISIS Y DIAGNÓSTICO');
        console.log('='.repeat(60));
        
        for (const username of usuariosABuscar) {
            console.log(`\n📊 Análisis para: ${username}`);
            
            const existeEnFirestore = empleadosEncontrados[username]?.encontrado || false;
            const existeEnAuth = authVerificados[username]?.existe || false;
            const loginFunciona = resultadosLogin[username]?.exito || false;
            
            console.log(`   Firestore: ${existeEnFirestore ? '✅ EXISTE' : '❌ NO EXISTE'}`);
            console.log(`   Firebase Auth: ${existeEnAuth ? '✅ EXISTE' : '❌ NO EXISTE'}`);
            console.log(`   Login: ${loginFunciona ? '✅ FUNCIONA' : '❌ NO FUNCIONA'}`);
            
            if (!existeEnFirestore && !existeEnAuth) {
                console.log(`\n   ❌ PROBLEMA: ${username} NO EXISTE en ningún sistema`);
                console.log(`   💡 SOLUCIÓN: Crear el usuario en ambos sistemas`);
            } else if (existeEnFirestore && !existeEnAuth) {
                console.log(`\n   ⚠️  PROBLEMA: ${username} existe en Firestore pero NO en Firebase Auth`);
                console.log(`   💡 SOLUCIÓN: Crear el usuario en Firebase Auth con el email: rh+${username}@ecoplagascr.com`);
            } else if (!existeEnFirestore && existeEnAuth) {
                console.log(`\n   ⚠️  PROBLEMA: ${username} existe en Firebase Auth pero NO en Firestore`);
                console.log(`   💡 SOLUCIÓN: Crear el documento en Firestore con username: ${username}`);
            } else if (existeEnFirestore && existeEnAuth && !loginFunciona) {
                const error = resultadosLogin[username]?.error;
                console.log(`\n   ⚠️  PROBLEMA: ${username} existe en ambos sistemas pero el login falla`);
                console.log(`   Error: ${error}`);
                if (error === 'auth/wrong-password') {
                    console.log(`   💡 SOLUCIÓN: La contraseña "${password}" es incorrecta`);
                    console.log(`   💡 SOLUCIÓN: Resetear la contraseña en Firebase Auth o verificar la contraseña correcta`);
                } else if (error === 'auth/invalid-credential') {
                    console.log(`   💡 SOLUCIÓN: Las credenciales son inválidas. Verificar:`);
                    console.log(`      - Que el email sea correcto: rh+${username}@ecoplagascr.com`);
                    console.log(`      - Que la contraseña sea correcta`);
                    console.log(`      - Que el usuario esté activo en Firestore`);
                }
            } else if (existeEnFirestore && existeEnAuth && loginFunciona) {
                console.log(`\n   ✅ TODO ESTÁ CORRECTO: ${username} funciona correctamente`);
            }
        }
        
        // 5. Resumen final
        console.log('\n\n5️⃣ RESUMEN FINAL');
        console.log('='.repeat(60));
        
        console.log('\n📋 Estado de los usuarios:');
        for (const username of usuariosABuscar) {
            const existeEnFirestore = empleadosEncontrados[username]?.encontrado || false;
            const existeEnAuth = authVerificados[username]?.existe || false;
            const loginFunciona = resultadosLogin[username]?.exito || false;
            
            console.log(`\n${username}:`);
            console.log(`   Firestore: ${existeEnFirestore ? '✅' : '❌'}`);
            console.log(`   Firebase Auth: ${existeEnAuth ? '✅' : '❌'}`);
            console.log(`   Login funciona: ${loginFunciona ? '✅' : '❌'}`);
            
            if (existeEnFirestore) {
                const datos = empleadosEncontrados[username].datos;
                console.log(`   Email en Firestore: ${datos.email || 'N/A'}`);
                console.log(`   Firebase Auth Email: ${datos.firebaseAuthEmail || 'N/A'}`);
                console.log(`   Estado: ${datos.estado || datos.activo || 'N/A'}`);
            }
        }
        
        // Nota sobre "jaison" vs "jason"
        if (usuariosABuscar.includes('jaison.solis') && usuariosABuscar.includes('jason.solis')) {
            console.log('\n\n⚠️  NOTA IMPORTANTE:');
            console.log('   Estás intentando iniciar sesión con "jaison.solis" (con "i")');
            console.log('   Pero el email correcto podría ser "jason.solis" (sin "i")');
            console.log('   Verifica cuál es el username correcto en Firestore');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        return {
            empleadosEncontrados,
            authVerificados,
            resultadosLogin
        };
        
    } catch (error) {
        console.error('\n❌ Error en el diagnóstico:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        throw error;
    }
})();
