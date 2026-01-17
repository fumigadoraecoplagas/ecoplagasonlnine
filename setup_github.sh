#!/bin/bash

# Script de configuración inicial de GitHub para el proyecto EcoPlagas
# Ejecuta este script después de crear el repositorio en GitHub

echo "🚀 Configuración de GitHub para Proyecto EcoPlagas"
echo "=================================================="
echo ""

# Verificar si Git está instalado
if ! command -v git &> /dev/null; then
    echo "❌ Git no está instalado. Por favor instálalo desde https://git-scm.com"
    exit 1
fi

echo "✅ Git está instalado: $(git --version)"
echo ""

# Verificar si ya es un repositorio Git
if [ -d ".git" ]; then
    echo "⚠️  Ya existe un repositorio Git en este directorio"
    read -p "¿Deseas continuar de todas formas? (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# Solicitar información del usuario
echo "📝 Información necesaria para configurar Git:"
echo ""

read -p "1. Tu nombre completo (para commits): " GIT_NAME
read -p "2. Tu email (para commits): " GIT_EMAIL
read -p "3. URL del repositorio GitHub (ej: https://github.com/usuario/repo.git): " GIT_REPO_URL

echo ""
echo "🔧 Configurando Git..."
echo ""

# Configurar Git globalmente (si no está configurado)
if [ -z "$(git config --global user.name)" ]; then
    git config --global user.name "$GIT_NAME"
    echo "✅ Nombre configurado: $GIT_NAME"
else
    echo "ℹ️  Nombre ya configurado: $(git config --global user.name)"
fi

if [ -z "$(git config --global user.email)" ]; then
    git config --global user.email "$GIT_EMAIL"
    echo "✅ Email configurado: $GIT_EMAIL"
else
    echo "ℹ️  Email ya configurado: $(git config --global user.email)"
fi

# Inicializar repositorio si no existe
if [ ! -d ".git" ]; then
    echo ""
    echo "📦 Inicializando repositorio Git..."
    git init
    echo "✅ Repositorio inicializado"
fi

# Agregar archivos
echo ""
echo "📁 Agregando archivos al repositorio..."
git add .
echo "✅ Archivos agregados"

# Hacer commit inicial
echo ""
echo "💾 Creando commit inicial..."
git commit -m "Commit inicial - Proyecto EcoPlagas completo"
echo "✅ Commit creado"

# Configurar rama main
echo ""
echo "🌿 Configurando rama main..."
git branch -M main
echo "✅ Rama main configurada"

# Agregar remote
echo ""
echo "🔗 Configurando conexión con GitHub..."
if git remote get-url origin &> /dev/null; then
    echo "⚠️  Ya existe un remote 'origin'"
    read -p "¿Deseas actualizarlo? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        git remote set-url origin "$GIT_REPO_URL"
        echo "✅ Remote actualizado"
    fi
else
    git remote add origin "$GIT_REPO_URL"
    echo "✅ Remote agregado"
fi

# Mostrar resumen
echo ""
echo "📊 Resumen de configuración:"
echo "=============================="
echo "Nombre: $(git config user.name)"
echo "Email: $(git config user.email)"
echo "Repositorio: $(git remote get-url origin)"
echo "Rama: $(git branch --show-current)"
echo ""

# Preguntar si desea hacer push
echo "🚀 ¿Deseas subir los archivos a GitHub ahora?"
echo "   (Necesitarás autenticarte con tu Personal Access Token)"
read -p "¿Continuar? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "📤 Subiendo archivos a GitHub..."
    echo "   (Si te pide credenciales, usa tu Personal Access Token como contraseña)"
    echo ""
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ ¡Configuración completada exitosamente!"
        echo ""
        echo "📚 Próximos pasos:"
        echo "   1. Revisa la guía en GUIA_GITHUB.md"
        echo "   2. Para trabajar desde otra computadora:"
        echo "      git clone $GIT_REPO_URL"
    else
        echo ""
        echo "⚠️  Error al subir archivos. Verifica:"
        echo "   1. Que el repositorio exista en GitHub"
        echo "   2. Que tengas permisos de escritura"
        echo "   3. Que uses un Personal Access Token válido"
        echo ""
        echo "Puedes intentar manualmente con:"
        echo "   git push -u origin main"
    fi
else
    echo ""
    echo "✅ Configuración completada localmente"
    echo ""
    echo "📤 Para subir los archivos más tarde, ejecuta:"
    echo "   git push -u origin main"
fi

echo ""
echo "✨ ¡Listo! Tu proyecto está configurado para trabajar con GitHub"
echo ""
