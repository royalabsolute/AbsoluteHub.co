#!/bin/bash

# Absolute Terminal Hub - Linux Starter
echo "============================================"
echo "     ABSOLUTE HUB - TERMINAL MANAGER"
echo "============================================"
echo "Iniciando Hub de texto unificado..."

# Navegar al directorio del script
cd "$(dirname "$0")"

# Verificar si node está instalado
if ! command -v node &> /dev/null
then
    echo "[ERROR] 'node' no está instalado. Por favor instálalo."
    exit 1
fi

# Ejecutar el hub
node AbsoluteHub.js

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] El Hub se detuvo inesperadamente."
    read -p "Presiona Enter para salir..."
fi
