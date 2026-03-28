#!/bin/bash
# Script de instalación para correr el motor IA de Absolute en Linux
echo "Preparando el entorno aislado para el Motor de IA (Demucs & Basic-Pitch)..."
python3 -m venv ai_venv
source ai_venv/bin/activate
pip install --upgrade pip
pip install setuptools wheel
pip install flask flask-cors yt-dlp demucs basic-pitch
echo "=========================================================="
echo "¡Entorno 'ai_venv' creado exitosamente!"
echo "Ahora cuando corras 'node index.js' y active el AI worker, usará automáticamente estas herramientas."
echo "Si quieres iniciar el worker manualmente, usa: ./ai_venv/bin/python ai_worker.py"
