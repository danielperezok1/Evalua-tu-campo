# Evalúa tu Campo - Guía para Windows

## Opción más fácil: Hacer doble click en `run.bat`

1. Abrí la carpeta: `C:\Users\tu-usuario\Desktop\Evalua tu campo`
2. Buscar el archivo **`run.bat`**
3. **Doble click** para ejecutar

Si funciona:
- Se abrirá una ventana negra
- Dice "Iniciando servidor en http://localhost:8000"
- Abrí http://localhost:8000 en tu navegador

---

## Si no funciona: Instalación manual

### Paso 1: Instalar Python (la opción más fácil)

1. Ir a https://www.python.org/downloads/
2. Descargar la versión más reciente (Python 3.12+)
3. **MUY IMPORTANTE**: Al instalar, marcar ✅ **"Add Python to PATH"**
4. Seguir los pasos del instalador
5. Reiniciar Windows

### Paso 2: Abrir terminal

```
Shift + Click derecho en la carpeta → "Open PowerShell here"
```

### Paso 3: Ejecutar comando

```powershell
python -m http.server 8000
```

Si ves:
```
Serving HTTP on 0.0.0.0 port 8000...
```

✅ **¡Funcionando!** Abrí http://localhost:8000

---

## Alternativa: Usar Node.js

Si preferís Node.js:

1. Descargar desde https://nodejs.org/ (versión LTS)
2. Instalar (siguiente, siguiente, siguiente)
3. Abrir terminal en la carpeta
4. Ejecutar:
   ```powershell
   npx http-server -p 8000
   ```

---

## Alternativa: Usar GitHub Desktop

Si querés evitar terminal:

1. Instalar GitHub Desktop: https://desktop.github.com/
2. File → Clone Repository
3. URL: `https://github.com/tu-usuario/evalua-tu-campo.git`
4. Clone
5. Doble click en `run.bat`

---

## Solución de problemas

### "python: El término no se reconoce"

```
❌ ERROR: Python no está en el PATH
```

**Soluciones**:
1. Instalar Python nuevamente y marcar "Add to PATH"
2. Reiniciar Windows
3. Abrir nueva terminal
4. Intentar de nuevo

### "No se encuentra http-server"

```
❌ ERROR: npx no está disponible
```

**Soluciones**:
1. Instalar Node.js desde https://nodejs.org/
2. Reiniciar Windows
3. Intentar nuevamente

### "Puerto 8000 ya en uso"

```
❌ ERROR: Address already in use
```

**Soluciones**:
1. Cerrar otras instancias de `run.bat`
2. O cambiar el puerto en el comando:
   ```powershell
   python -m http.server 8001
   # Luego abrí http://localhost:8001
   ```

### "Acceso denegado"

```
❌ ERROR: Access denied
```

**Soluciones**:
1. Abrir PowerShell como **Administrador**
2. Ejecutar comando nuevamente

---

## ¿Necesitas ayuda?

1. **Verificá START.md** - Guía rápida
2. **Lee SETUP.md** - Instrucciones completas
3. **Consultá GUIA_USO.md** - Cómo usar la app

---

¡Listo! La app debería estar funcionando en http://localhost:8000 🎉
