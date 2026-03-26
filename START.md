# 🚀 COMENZAR AQUÍ - Evalúa tu Campo

## Opción A: Ejecutar ahora en tu computadora (1 minuto)

### Paso 1: Abrí terminal en esta carpeta

```bash
# Windows - Si no ves terminal, Shift+Click derecho en la carpeta → "Open PowerShell here"
cd "C:\Users\tu-usuario\Desktop\Evalua tu campo"
```

### Paso 2: Iniciá servidor

```bash
# Opción 1: Python (probablemente tengas instalado)
python -m http.server 8000

# Opción 2: Node.js
npx http-server

# Opción 3: PHP
php -S localhost:8000
```

### Paso 3: Abrí en navegador

```
http://localhost:8000
```

✅ **¡Listo! La app está funcionando.**

---

## Opción B: Publicar gratis online (5 minutos)

### GitHub Pages (lo más recomendado)

```bash
# 1. Crear repo en GitHub: https://github.com/new
#    Nombre: evalua-tu-campo
#    Marcar: Public

# 2. Desde terminal en la carpeta:
git remote add origin https://github.com/tu-usuario/evalua-tu-campo.git
git branch -M main
git push -u origin main

# 3. En GitHub → Settings → Pages
#    Source: Deploy from a branch
#    Branch: main / (root)
#    Esperar 1-2 minutos

# 4. Tu app está en:
#    https://tu-usuario.github.io/evalua-tu-campo/
```

### Alternativas rápidas:
- **Netlify**: https://app.netlify.com/ → Drag & drop esta carpeta
- **Vercel**: https://vercel.com/new → Connect GitHub

---

## 📚 Documentación

| Archivo | Para qué | Leer si... |
|---------|----------|-----------|
| **README.md** | Visión general | Querés saber qué es la app |
| **GUIA_USO.md** | Manual del usuario | Querés aprender a usarla |
| **SETUP.md** | Instalación detallada | Tenés problemas al instalar |
| **COMPLETADO.md** | Detalles técnicos | Sos desarrollador |

---

## 🎯 Usar la app en 3 pasos

### 1️⃣ Subí el límite del campo
- Archivos aceptados: ZIP (Shapefile), KML, KMZ
- Drag & drop en la app
- O hacé click en la zona de carga

### 2️⃣ Completá opciones
- **Tipo**: Alquiler / Compra / Manejo
- **Nombre**: Opcional (para identificar)
- **Nivel**: Básico / Intermedio / Detallado

### 3️⃣ Analizá y exportá
- Click en **"Analizar suelos"**
- Esperá a que cargue (5-10 seg primera vez)
- Click en **"Exportar PDF"** para descargar

---

## ❓ Preguntas rápidas

**¿Es seguro subir mis archivos?**
✅ SÍ. La app es 100% local. Los archivos quedan en tu navegador, no se envían a ningún servidor.

**¿Funciona sin internet?**
❌ NO. Necesita internet para descargar datos de IDECOR la primera vez. Después, quedan cacheados.

**¿Qué es el IP?**
El Índice de Productividad (0-100) indica la calidad del suelo. Más alto = mejor.

**¿Reemplaza un estudio a campo?**
❌ NO. Esto es orientativo. Siempre hacé un estudio de suelos con agrónomo antes de decidir.

---

## 🔧 Si algo no funciona

1. **Verificá que estés en http://localhost:8000** (no en file://)
2. **Probá con http://localhost:8000/test.html** para debuggear
3. **Abrí la consola** (F12) y buscá errores rojo
4. **Lee SETUP.md** para solucionar problemas

---

## 📞 Próximos pasos

- [ ] Ejecutar localmente (`python -m http.server 8000`)
- [ ] Subir un campo de prueba (descargá límite de Google Earth)
- [ ] Probar los 3 tipos de informe
- [ ] Exportar a PDF
- [ ] (Opcional) Publicar en GitHub Pages

---

## 💡 Recursos útiles

- **Descargar límite del campo**: https://www.google.com/earth/
- **Datos de suelo**: https://suelos.cba.gov.ar/
- **Documentación técnica**: SETUP.md y COMPLETADO.md

---

¡Bienvenido! 🌾 Ahora tenés una herramienta profesional y gratuita en tu computadora.
