# Instrucciones para Otra Computadora

## 📋 Información de Acceso

**Usuario GitHub:** fumigadoraecoplagas  
**Token:** [CONSULTA AL ADMINISTRADOR DEL PROYECTO]  
**Repositorio:** https://github.com/fumigadoraecoplagas/ecoplagasonlnine.git

---

## 🚀 Comandos para Pegar en Cursor AI

### 1. Clonar el Repositorio

```bash
# Navegar a donde quieres el proyecto (ejemplo: Documents)
cd ~/Documents

# Clonar el repositorio
git clone https://[TOKEN]@github.com/fumigadoraecoplagas/ecoplagasonlnine.git cursor_ai

# Entrar al directorio
cd cursor_ai
```

### 2. Configurar Git (Solo Primera Vez)

```bash
# Configurar identidad
git config --global user.name "Fumigadora EcoPlagas"
git config --global user.email "fumigadoraecoplagas@users.noreply.github.com"

# Verificar configuración
git config --global --list
```

### 3. Actualizar Remote (Remover Token de la URL por Seguridad)

```bash
# Actualizar remote sin token visible
git remote set-url origin https://github.com/fumigadoraecoplagas/ecoplagasonlnine.git

# Verificar
git remote -v
```

### 4. Instalar Dependencias (Si es Necesario)

```bash
npm install
```

---

## 🔄 Flujo de Trabajo Diario

### Al Iniciar el Día (Obtener Últimos Cambios)

```bash
cd ~/Documents/cursor_ai
git pull origin main
```

### Al Finalizar el Día (Guardar Cambios)

```bash
cd ~/Documents/cursor_ai

# Ver qué cambió
git status

# Agregar cambios
git add .

# Guardar con mensaje
git commit -m "Descripción de los cambios realizados"

# Subir a GitHub (usará el token si está configurado)
git push origin main
```

**Nota:** Si pide credenciales al hacer push:
- Username: `fumigadoraecoplagas`
- Password: `[CONSULTA AL ADMINISTRADOR DEL PROYECTO]`

### Desplegar Cambios (Opcional)

```bash
firebase deploy --only hosting
```

---

## 🔐 Configurar Token Permanente (Opcional)

Para no tener que ingresar el token cada vez:

### macOS (Keychain)

```bash
# Git guardará el token en el keychain
git config --global credential.helper osxkeychain
```

Luego, la primera vez que hagas `git push`, ingresa:
- Username: `fumigadoraecoplagas`
- Password: `[CONSULTA AL ADMINISTRADOR DEL PROYECTO]`

Git lo guardará automáticamente.

---

## ✅ Verificación Rápida

```bash
# Verificar que todo está bien
cd ~/Documents/cursor_ai
git status
git remote -v
git log --oneline -5
```

---

## 🆘 Si Hay Problemas

### Error de Autenticación

```bash
# Usar token directamente en la URL (temporal)
git remote set-url origin https://[TOKEN]@github.com/fumigadoraecoplagas/ecoplagasonlnine.git

# Hacer push
git push origin main

# Volver a remover token de la URL
git remote set-url origin https://github.com/fumigadoraecoplagas/ecoplagasonlnine.git
```

### Conflictos al Hacer Pull

```bash
# Si hay conflictos, resolver manualmente y luego:
git add .
git commit -m "Resolver conflictos"
git push origin main
```
