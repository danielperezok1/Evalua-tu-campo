# Evalúa tu Campo - Guía de Uso

## 🚀 Inicio Rápido

### 1. Descargá/Clonå la app

```bash
# Si tenés Git
git clone https://github.com/tu-usuario/evalua-tu-campo.git

# Si no, descargá como ZIP desde GitHub
```

### 2. Ejecutá localmente

```bash
# Opción A: Python (Windows/Mac/Linux)
python -m http.server 8000

# Opción B: Node.js
npx http-server

# Opción C: PHP
php -S localhost:8000
```

### 3. Abrí http://localhost:8000 en tu navegador

---

## 📋 Cómo usar la app

### Paso 1: Subí el límite del campo

**Dónde**: Zona superior izquierda "1. Subí el límite del campo"

**Formatos aceptados**:
- **ZIP con Shapefile**: Archivo de GIS comprimido (SHP + SHX + DBF)
- **KML**: Archivo XML de Google Earth
- **KMZ**: KML comprimido (usado por Google Earth)

**Cómo obtener el límite**:

#### Opción A: Desde Google Earth Pro
1. Abrí Google Earth Pro
2. Dibujá el polígono del campo
3. Click derecho → Guardar como KML
4. Subilo a la app

#### Opción B: Desde un SIG (QGIS)
1. Abrí QGIS
2. Dibujá o importá el límite
3. Click derecho en capa → Exportar como...
4. Elegí Shapefile
5. Comprimí la carpeta como ZIP
6. Subilo a la app

#### Opción C: Software de precisión agrícola
- Trimble, John Deere, Ag Leader, etc.
- Exportá como Shapefile o KML
- Convertí a ZIP si es necesario

### Paso 2: Seleccioná opciones

**Tipo de informe** (obligatorio):
- 🔑 **Alquiler**: Foco en IP, aptitud agrícola, valor
- 🏡 **Compra**: Detalle de limitaciones y series
- ⚙️ **Manejo**: Análisis de variabilidad, recomendaciones por zona

**Nombre del campo** (opcional):
- Para identificar el informe
- Aparecerá en el PDF

**Nivel de detalle**:
- **Básico**: Solo unidades y IP
- **Intermedio** (recomendado): + Composición
- **Detallado**: + Series de suelo

### Paso 3: Analizá

1. Hacé click en **"Analizar suelos"**
2. Esperá a que se carguen los datos (puede tardar 5-10 segundos si es primera vez)
3. La app mostrará:
   - **Mapa**: Con el límite del campo resaltado
   - **Informe**: Tabla de unidades de suelo

### Paso 4: Revisá el informe

**Información mostrada**:

| Sección | Qué significa |
|---------|--------------|
| **Superficie** | Hectáreas totales del campo |
| **IP Promedio** | Índice de Productividad ponderado (0-100) |
| **Unidades** | Cantidad de tipos de suelo diferentes |
| **Cobertura** | % del campo con datos disponibles |
| **Tabla de Suelos** | Detalle de cada unidad (ha, %, clase de uso) |
| **Observaciones** | Advertencias y recomendaciones |

**Interpretar la tabla**:

```
Unidad | Sup (ha) | %   | Clase | IP | Composición
-------|----------|-----|-------|----|-----------
L      | 25.3     | 45  | IIe   | 65 | Lagunas
Lu     | 18.7     | 33  | III   | 52 | Luvisol
Lb     | 11.2     | 22  | IVe   | 38 | Limo oscuro
```

**Clases de uso (Clase)**:
- **I-II**: Excelente para agricultura
- **III**: Bueno, con cuidados
- **IV**: Limitaciones moderadas
- **V-VI**: Mejor ganadería
- **VII-VIII**: Uso restrictivo

**IP (Índice de Productividad)**:
- **65+**: Muy bueno
- **40-65**: Bueno
- **-40**: Regular/malo

### Paso 5: Exportá a PDF (opcional)

1. Hacé click en **"Exportar PDF"**
2. Se descargará automáticamente
3. Podés imprimirlo o compartirlo

---

## ❓ Preguntas Frecuentes

### ¿Qué es el IP (Índice de Productividad)?

Es un número (0-100) que indica la capacidad del suelo para producir. Cuanto más alto, mejor.

**Relación con alquiler agrícola**:
- IP 65+: Prima agrícola
- IP 50-65: Precio normal
- IP -50: Posible baja de valor

### ¿Por qué dice "Cobertura 80%"?

Significa que solo se encontró información de suelos para el 80% del campo. El otro 20% está fuera del área relevada por IDECOR o es una zona sin datos.

**Qué hacer**:
- Si es poco, el informe es válido
- Si es muy poco (<50%), contactá a IDECOR

### ¿Puedo usar esto en lugar de un estudio a campo?

**NO.** Las Cartas de Suelo IDECOR son semi-detalladas (escala 1:50,000). Son útiles para:
- ✅ Análisis preliminar
- ✅ Valuación rápida
- ✅ Decisiones de manejo
- ❌ NO para compra sin verificación

**Siempre** hacé un estudio de suelos a campo antes de decidir.

### ¿Qué pasa si subo un campo fuera de Córdoba?

La app dirá "El campo no está en el área relevada". IDECOR solo cubre Córdoba. Para otras provincias, contactá a:
- INTA (Instituto Nacional de Tecnología Agropecuaria)
- Ministerios de agricultura provinciales

### ¿Por qué algunos campos dan error?

Razones posibles:
1. **Formato incorrecto**: Verificá que sea SHP/KML/KMZ válido
2. **Fuera del área**: El campo debe estar en Córdoba
3. **Coordenadas raras**: Asegurate que la proyección sea correcta (WGS84)

### ¿Puedo reutilizar campos?

Sí. La app guarda en el navegador todo temporalmente. Si limpias el caché, se borra.

Para guardar permanently:
1. Exportá el PDF
2. O guardá el GeoJSON en tu computadora

### ¿Es seguro subir archivos?

**Totalmente.** La app es 100% cliente-side (en tu navegador). Los archivos NO se envían a ningún servidor.

---

## 🛠️ Troubleshooting

### La app no carga

**Solución**:
1. Verificá que el servidor está corriendo
2. Probá con `http://localhost:8000/test.html`
3. Revisá la consola (F12) para mensajes de error

### Error: "El archivo no es válido"

**Soluciones**:
- ¿Es realmente SHP/KML/KMZ?
- ¿Está corrupto? Intentá descargarlo nuevamente
- ¿Es un Shapefile? Asegurate de comprimir todos los archivos (.shp, .shx, .dbf, etc.)

### El PDF se ve mal

**Soluciones**:
- Usa nivel de detalle "Básico"
- Probá imprimiendo como PDF desde el navegador (Ctrl+P)
- Exportá la tabla como imagen

### Tardó mucho en cargar datos

Primero es normal (descarga los datos de IDECOR). Después es más rápido porque quedan en caché.

---

## 💡 Tips & Trucos

### Comparar dos campos

1. Subí Campo A → Anotá resultados
2. Click en "Quitar" → Cargá Campo B
3. Comparás manualmente los resultados

(Futura versión tendrá esta opción automática)

### Optimizar para impresión

1. Seleccioná "Nivel: Básico"
2. Tipo: El que necesites
3. Exportá PDF → Abrí en Adobe Reader
4. Ajustá márgenes antes de imprimir

### Obtener datos de GIS

Si tenés QGIS instalado:

```bash
# Abrí QGIS
# Importá el shapefile del campo
# Click derecho → Exportar como
# Elegí Shapefile → Guardar
# Comprimí los archivos (.shp, .shx, .dbf, .prj)
# Subilo como ZIP a la app
```

---

## 📞 Soporte

¿Tenés problemas?

1. **Verificá SETUP.md** - Instrucciones de instalación
2. **Abrí un issue** en GitHub
3. **Escribime** directamente

---

## 📚 Recursos

- **IDECOR**: https://suelos.cba.gov.ar/
- **INTA Córdoba**: https://www.inta.gob.ar/
- **GoogleEarth Pro**: https://www.google.com/earth/versions/

---

¡Listo! Ya podés usar Evalúa tu Campo. 🌾
