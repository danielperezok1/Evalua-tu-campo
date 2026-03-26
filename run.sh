#!/bin/bash

# Evalúa tu Campo - Script para ejecutar la app localmente (Mac/Linux)

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  Evalúa tu Campo - Servidor Local"
echo "========================================"
echo ""

# Intentar con Python 3
if command -v python3 &> /dev/null; then
    echo "✓ Python 3 detectado"
    echo "Iniciando servidor en http://localhost:8000"
    echo ""
    echo "Presionå Ctrl+C para detener el servidor"
    echo ""
    python3 -m http.server 8000
    exit 0
fi

# Intentar con Python
if command -v python &> /dev/null; then
    echo "✓ Python detectado"
    echo "Iniciando servidor en http://localhost:8000"
    echo ""
    echo "Presionå Ctrl+C para detener el servidor"
    echo ""
    python -m http.server 8000
    exit 0
fi

# Intentar con Node.js
if command -v npx &> /dev/null; then
    echo "✓ Node.js detectado"
    echo "Iniciando servidor con http-server en http://localhost:8000"
    echo ""
    echo "Presionå Ctrl+C para detener el servidor"
    echo ""
    npx http-server -p 8000
    exit 0
fi

# Intentar con PHP
if command -v php &> /dev/null; then
    echo "✓ PHP detectado"
    echo "Iniciando servidor en http://localhost:8000"
    echo ""
    echo "Presionå Ctrl+C para detener el servidor"
    echo ""
    php -S localhost:8000
    exit 0
fi

# Si ninguno está disponible
echo ""
echo "❌ ERROR: No se encontró Python, Node.js o PHP instalado"
echo ""
echo "SOLUCIONES:"
echo "1. Instalar Python:"
echo "   Mac: brew install python3"
echo "   Linux: sudo apt-get install python3"
echo ""
echo "2. O instalar Node.js desde https://nodejs.org/"
echo ""
echo "3. O instalar PHP desde https://www.php.net/downloads.php"
echo ""
echo "Después de instalar, ejecutå este script nuevamente."
echo ""
