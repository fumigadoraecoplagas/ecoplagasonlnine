// Script para verificar qué usuarios existen en Firebase Auth relacionados con jason/jose solis
// Ejecutar en la consola de empleados.html

(async function verificarFirebaseAuthJason() {
    console.log('\n🔍 ========== VERIFICANDO FIREBASE AUTH ==========\n');
    
    try {
        const { getAuth, fetchSignInMethodsForEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const auth = window.firebaseAuth || getAuth();
        const db = window.db || getFirestore();
        
        const emailsAVerificar = [
            'rh+jason.solis@ecoplagascr.com',
            'rh+jose.solis@ecoplagascr.com',
            'rh+jaison.solis@ecoplagascr.com'
        ];
        
        console.log('📋 Verificando emails en Firebase Auth:');
        console.log(emailsAVerificar);
        console.log('');
        
        const resultados = {};
        
        for (const email of emailsAVerificar) {
            console.log(`🔍 Verificando: ${email}`);
            try {
                const signInMethods = await fetchSignInMethodsForEmail(auth, email);
                resultados[email] = {
                    existe: signInMethods.length > 0,
                    signInMethods: signInMethods
                };
                
                if (signInMethods.length > 0) {
                    console.log('   ✅ EXISTE');
                    console.log('   Métodos:', signInMethods);
                } else {
                    console.log('   ❌ NO EXISTE');
                }
            } catch (error) {
                resultados[email] = {
                    existe: false,
                    error: error.message
                };
                console.log('   ❌ Error:', error.message);
            }
            console.log('');
        }
        
        // Verificar documento en Firestore
        console.log('📋 Verificando documento en Firestore...');
        const docRef = doc(db, 'empleados', 'jason.solis');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const datos = docSnap.data();
            console.log('   ✅ Documento encontrado');
            console.log('   Username:', datos.username);
            console.log('   Email:', datos.email);
            console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datos.firebaseAuthUID || 'N/A');
        } else {
            console.log('   ❌ Documento no encontrado');
        }
        
        // Resumen
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN');
        console.log('='.repeat(60));
        
        const emailsExistentes = Object.entries(resultados).filter(([email, res]) => res.existe);
        
        if (emailsExistentes.length > 0) {
            console.log('\n✅ Usuarios encontrados en Firebase Auth:');
            emailsExistentes.forEach(([email, res]) => {
                console.log(`   - ${email}`);
            });
        } else {
            console.log('\n❌ NO se encontró NINGÚN usuario en Firebase Auth');
            console.log('\n💡 SOLUCIÓN:');
            console.log('   Necesitas crear el usuario en Firebase Auth con:');
            console.log('   Email: rh+jason.solis@ecoplagascr.com');
            console.log('   Password: raiz2490');
            console.log('\n   Puedes hacerlo desde:');
            console.log('   1. Firebase Console → Authentication → Add User');
            console.log('   2. O ejecutar un script que lo cree automáticamente');
        }
        
        console.log('='.repeat(60) + '\n');
        
        return resultados;
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
})();
