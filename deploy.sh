#!/bin/bash

# Script de despliegue a Firebase Hosting
# Ejecuta este script después de hacer: firebase login

echo "🚀 Iniciando despliegue a Firebase Hosting..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: No se encontró firebase.json. Asegúrate de estar en el directorio correcto."
    exit 1
fi

# Configurar proyecto
echo "📋 Configurando proyecto: cursorwebapp-f376d"
firebase use cursorwebapp-f376d

# Verificar autenticación
echo "🔐 Verificando autenticación..."
if ! firebase projects:list &>/dev/null; then
    echo "❌ Error: No estás autenticado. Ejecuta primero: firebase login"
    exit 1
fi

# Desplegar solo hosting
echo "📤 Desplegando a Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Despliegue completado!"
