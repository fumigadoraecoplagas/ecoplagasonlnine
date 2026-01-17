#!/bin/bash

# Script para subir el proyecto a GitHub
# Ejecuta este script después de configurar tu identidad

echo "🚀 Subiendo proyecto a GitHub"
echo "=============================="
echo ""

cd /Users/desarrollo/Documents/cursor_ai

# Verificar que Git esté configurado
if [ -z "$(git config user.name)" ]; then
    echo "⚠️  Tu nombre no está configurado en Git"
    read -p "Ingresa tu nombre completo: " GIT_NAME
    git config --global user.name "$GIT_NAME"
fi

if [ -z "$(git config user.email)" ]; then
    echo "⚠️  Tu email no está configurado en Git"
    read -p "Ingresa tu email: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
fi

echo ""
echo "✅ Configuración actual:"
echo "   Nombre: $(git config user.name)"
echo "   Email: $(git config user.email)"
echo ""

# Verificar que hay un commit
if [ -z "$(git log --oneline 2>/dev/null)" ]; then
    echo "📦 Creando commit inicial..."
    git add .
    git commit -m "Commit inicial - Proyecto EcoPlagas completo"
fi

# Verificar rama
git branch -M main

echo ""
echo "📤 Subiendo archivos a GitHub..."
echo "   Repositorio: https://github.com/fumigadoraecoplagas/ecoplagasonlnine.git"
echo ""
echo "⚠️  IMPORTANTE: Si te pide credenciales:"
echo "   - Usuario: fumigadoraecoplagas"
echo "   - Contraseña: Usa un Personal Access Token (NO tu contraseña de GitHub)"
echo ""
echo "   Para crear un token:"
echo "   1. Ve a: https://github.com/settings/tokens"
echo "   2. Generate new token (classic)"
echo "   3. Selecciona permisos: repo (todos)"
echo "   4. Copia el token y úsalo como contraseña"
echo ""
read -p "¿Listo para subir? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ ¡Proyecto subido exitosamente a GitHub!"
        echo ""
        echo "🔗 Ver tu repositorio en:"
        echo "   https://github.com/fumigadoraecoplagas/ecoplagasonlnine"
        echo ""
        echo "📚 Próximos pasos:"
        echo "   1. Revisa la guía en GUIA_GITHUB.md"
        echo "   2. Para trabajar desde otra computadora:"
        echo "      git clone https://github.com/fumigadoraecoplagas/ecoplagasonlnine.git"
    else
        echo ""
        echo "❌ Error al subir. Posibles causas:"
        echo "   1. Problemas de autenticación (necesitas Personal Access Token)"
        echo "   2. No tienes permisos de escritura en el repositorio"
        echo ""
        echo "💡 Solución:"
        echo "   1. Crea un Personal Access Token en:"
        echo "      https://github.com/settings/tokens"
        echo "   2. Úsalo como contraseña cuando Git te la pida"
    fi
else
    echo ""
    echo "❌ Operación cancelada"
    echo ""
    echo "Para subir manualmente más tarde, ejecuta:"
    echo "   git push -u origin main"
fi
