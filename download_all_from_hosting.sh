#!/bin/bash

# Script para descargar TODOS los archivos desde Firebase Hosting
# Reemplaza automáticamente los archivos locales con los del hosting

# URL del hosting (puede usar cualquiera de las dos)
HOSTING_URL="https://ecoplagas.online"
# Alternativa: HOSTING_URL="https://cursorwebapp-f376d.web.app"
PUBLIC_DIR="public"
TEMP_DIR="temp_download_$(date +%Y%m%d_%H%M%S)"

echo "📥 Descargando archivos desde Firebase Hosting..."
echo "URL: $HOSTING_URL"
echo ""

# Crear directorio temporal
mkdir -p "$TEMP_DIR"

# Obtener lista de archivos desde el directorio local
cd "$PUBLIC_DIR" || exit 1

# Encontrar todos los archivos HTML, JS, CSS
FILES=$(find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) ! -name "*.min.js" ! -name "*.min.css" | sed 's|^\./||')

TOTAL=$(echo "$FILES" | wc -l | tr -d ' ')
SUCCESS=0
FAILED=0

echo "📋 Encontrados $TOTAL archivos para descargar"
echo ""

# Descargar cada archivo
for file in $FILES; do
    # Crear directorio si no existe
    mkdir -p "$TEMP_DIR/$(dirname "$file")"
    
    echo -n "  📄 Descargando $file... "
    HTTP_CODE=$(curl -s -o "$TEMP_DIR/$file" -w "%{http_code}" "$HOSTING_URL/$file" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ] && [ -s "$TEMP_DIR/$file" ]; then
        echo "✅"
        ((SUCCESS++))
    else
        echo "❌ (HTTP $HTTP_CODE)"
        rm -f "$TEMP_DIR/$file"
        ((FAILED++))
    fi
done

echo ""
echo "📊 Resumen:"
echo "  ✅ Exitosos: $SUCCESS"
echo "  ❌ Fallidos: $FAILED"
echo ""

if [ $SUCCESS -gt 0 ]; then
    echo "🔄 Reemplazando archivos locales..."
    cd ..
    
    for file in $(find "$TEMP_DIR" -type f | sed "s|^$TEMP_DIR/||"); do
        if [ -f "$TEMP_DIR/$file" ]; then
            mkdir -p "$PUBLIC_DIR/$(dirname "$file")"
            cp "$TEMP_DIR/$file" "$PUBLIC_DIR/$file"
        fi
    done
    
    echo "✅ Archivos reemplazados exitosamente"
    echo "🗑️  Limpiando archivos temporales..."
    rm -rf "$TEMP_DIR"
    echo ""
    echo "✨ Proceso completado. Los archivos locales han sido reemplazados con los del hosting."
else
    echo "⚠️  No se descargó ningún archivo. Verifica la URL del hosting."
    echo "Los archivos temporales están en: $TEMP_DIR"
fi
