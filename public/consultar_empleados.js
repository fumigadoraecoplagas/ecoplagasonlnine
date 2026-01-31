// Script para consultar empleados en Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    projectId: "cursorwebapp-f376d",
    appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
    databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
    storageBucket: "cursorwebapp-f376d.firebasestorage.app",
    apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
    authDomain: "cursorwebapp-f376d.firebaseapp.com",
    messagingSenderId: "719990096116",
    measurementId: "G-DJXLKFR7CD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function buscarEmpleados() {
    console.log('\n🔍 Buscando empleados: jason.solis y jose.solis...\n');
    
    const usuariosABuscar = ['jason.solis', 'jose.solis'];
    const resultados = {};
    
    // Buscar por ID del documento
    for (const username of usuariosABuscar) {
        try {
            const docRef = doc(db, 'empleados', username);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                resultados[username] = {
                    encontrado: true,
                    metodo: 'ID del documento',
                    datos: docSnap.data()
                };
                console.log(`✅ ${username} - ENCONTRADO`);
                console.log(`   Nombre: ${docSnap.data().primerNombre || ''} ${docSnap.data().primerApellido || ''}`);
                console.log(`   Email: ${docSnap.data().email || 'N/A'}`);
            } else {
                resultados[username] = { encontrado: false };
                console.log(`❌ ${username} - NO ENCONTRADO`);
            }
        } catch (error) {
            resultados[username] = { encontrado: false, error: error.message };
            console.log(`❌ ${username} - ERROR: ${error.message}`);
        }
    }
    
    // Buscar en toda la colección
    try {
        const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
        empleadosSnapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            
            usuariosABuscar.forEach(usuarioBuscado => {
                if (docId === usuarioBuscado || 
                    data.username === usuarioBuscado ||
                    (data.email && data.email.toLowerCase().includes(usuarioBuscado))) {
                    if (!resultados[usuarioBuscado] || !resultados[usuarioBuscado].encontrado) {
                        resultados[usuarioBuscado] = {
                            encontrado: true,
                            metodo: 'Búsqueda en colección',
                            idDocumento: docId,
                            datos: data
                        };
                        console.log(`✅ ${usuarioBuscado} - ENCONTRADO (ID: ${docId})`);
                        console.log(`   Nombre: ${data.primerNombre || ''} ${data.primerApellido || ''}`);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error buscando en colección:', error.message);
    }
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN:');
    const encontrados = Object.values(resultados).filter(r => r.encontrado);
    if (encontrados.length > 0) {
        console.log(`✅ EXISTE: ${encontrados.map(r => Object.keys(resultados).find(k => resultados[k] === r)).join(', ')}`);
    } else {
        console.log('❌ NO SE ENCONTRÓ NINGUNO DE LOS DOS USUARIOS');
    }
    console.log('='.repeat(60) + '\n');
    
    return resultados;
}

buscarEmpleados().catch(console.error);
