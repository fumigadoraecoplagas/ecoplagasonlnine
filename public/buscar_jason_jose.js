// Script para buscar jason.solis o jose.solis en Firebase
// Ejecutar este script en la consola del navegador cuando estés autenticado en empleados.html

(async function buscarEmpleados() {
    try {
        console.log('\n🔍 Buscando empleados: jason.solis y jose.solis...\n');
        
        // Obtener db de window si está disponible
        let db;
        if (window.db) {
            db = window.db;
        } else {
            // Intentar importar Firestore
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
            const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
            const app = getApp();
            db = getFirestore(app);
        }
        
        const { doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const usuariosABuscar = ['jason.solis', 'jose.solis'];
        const resultados = {};
        
        // Buscar por ID del documento (username)
        console.log('📋 Buscando por ID del documento...');
        for (const username of usuariosABuscar) {
            try {
                const docRef = doc(db, 'empleados', username);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    resultados[username] = {
                        encontrado: true,
                        metodo: 'ID del documento',
                        idDocumento: username,
                        datos: docSnap.data()
                    };
                    console.log(`✅ ${username} encontrado por ID del documento`);
                } else {
                    resultados[username] = {
                        encontrado: false
                    };
                    console.log(`❌ ${username} NO encontrado por ID del documento`);
                }
            } catch (error) {
                resultados[username] = {
                    encontrado: false,
                    error: error.message
                };
                console.log(`❌ Error buscando ${username}:`, error.message);
            }
        }
        
        // Buscar en toda la colección por username o email
        console.log('\n📋 Buscando en toda la colección...');
        const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
        let encontradosEnColeccion = 0;
        
        empleadosSnapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            
            usuariosABuscar.forEach(usuarioBuscado => {
                // Verificar si coincide el ID del documento, username o email
                if (docId === usuarioBuscado || 
                    data.username === usuarioBuscado ||
                    (data.email && data.email.toLowerCase().includes(usuarioBuscado.replace('.', '.')))) {
                    
                    if (!resultados[usuarioBuscado] || !resultados[usuarioBuscado].encontrado) {
                        resultados[usuarioBuscado] = {
                            encontrado: true,
                            metodo: 'Búsqueda en colección',
                            idDocumento: docId,
                            datos: data
                        };
                        encontradosEnColeccion++;
                        console.log(`✅ ${usuarioBuscado} encontrado en colección (ID: ${docId})`);
                    }
                }
            });
        });
        
        // Mostrar resultados finales
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADOS FINALES');
        console.log('='.repeat(60));
        
        for (const [usuario, resultado] of Object.entries(resultados)) {
            console.log(`\n${resultado.encontrado ? '✅' : '❌'} ${usuario.toUpperCase()}`);
            console.log(`   Estado: ${resultado.encontrado ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
            
            if (resultado.encontrado) {
                console.log(`   Método: ${resultado.metodo}`);
                console.log(`   ID del documento: ${resultado.idDocumento}`);
                if (resultado.datos) {
                    console.log(`   Nombre: ${resultado.datos.primerNombre || 'N/A'} ${resultado.datos.primerApellido || 'N/A'}`);
                    console.log(`   Email: ${resultado.datos.email || 'N/A'}`);
                    console.log(`   Estado: ${resultado.datos.estado || 'N/A'}`);
                    console.log(`   Username: ${resultado.datos.username || resultado.idDocumento || 'N/A'}`);
                    console.log(`   Datos completos:`, resultado.datos);
                }
            } else {
                if (resultado.error) {
                    console.log(`   Error: ${resultado.error}`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Resumen
        const encontrados = Object.values(resultados).filter(r => r.encontrado).length;
        const noEncontrados = Object.values(resultados).filter(r => !r.encontrado).length;
        
        console.log(`\n📈 RESUMEN:`);
        console.log(`   Encontrados: ${encontrados}`);
        console.log(`   No encontrados: ${noEncontrados}`);
        
        if (encontrados > 0) {
            console.log(`\n✅ EXISTE AL MENOS UNO DE LOS USUARIOS BUSCADOS`);
        } else {
            console.log(`\n❌ NO SE ENCONTRÓ NINGUNO DE LOS USUARIOS`);
        }
        
        return resultados;
        
    } catch (error) {
        console.error('❌ Error en la búsqueda:', error);
        throw error;
    }
})();
