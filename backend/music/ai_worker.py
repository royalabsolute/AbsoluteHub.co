import os
import subprocess
import threading
import uuid
import re
import time
import logging

# Silenciar advertencias de TensorFlow y TFLite
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('werkzeug').setLevel(logging.ERROR)
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pathlib
import traceback
import sys

# Version check for logs
AI_WORKER_VERSION = "1.0.2"

app = Flask(__name__)
CORS(app)

# Configuración de rutas internas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(BASE_DIR, 'inputs')
OUTPUT_DIR = os.path.join(BASE_DIR, 'outputs')

is_win = sys.platform == 'win32'

if is_win:
    FFMPEG_DIR = os.path.join(BASE_DIR, 'ffmpeg_bin', 'ffmpeg-8.0.1-essentials_build', 'bin')
    PYTHON_EXE = os.path.join(BASE_DIR, 'python_stable', 'python.exe')
    BP_EXE = os.path.join(BASE_DIR, 'python_stable', 'Scripts', 'basic-pitch.exe')
    # Añadir FFmpeg al PATH del sistema para este proceso
    os.environ["PATH"] += os.pathsep + FFMPEG_DIR
else:
    # En Linux buscamos primero si existe entorno local 'ai_venv'
    local_venv_python = os.path.join(BASE_DIR, 'ai_venv', 'bin', 'python3')
    local_venv_bp = os.path.join(BASE_DIR, 'ai_venv', 'bin', 'basic-pitch')
    if os.path.exists(local_venv_python):
        PYTHON_EXE = local_venv_python
        BP_EXE = local_venv_bp
    else:
        PYTHON_EXE = sys.executable
        BP_EXE = "basic-pitch" # Asumido en PATH
    FFMPEG_DIR = "" # Asumido en PATH

for d in [INPUT_DIR, OUTPUT_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

# Variable para rastrear el progreso global de los jobs
jobs = {}

def update_job_progress(job_id, percent):
    if job_id in jobs:
        jobs[job_id]['progress'] = percent

def process_track(job_id, source):
    """Lógica para procesar una canción: Descarga -> Separación -> Transcripción"""
    jobs[job_id]['status'] = 'processing'
    job_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    try:
        # 1. Descarga desde YouTube si es una URL
        audio_path = os.path.join(INPUT_DIR, f"{job_id}.mp3")
        if source.startswith('http'):
            jobs[job_id]['step'] = 'downloading'
            # --no-playlist asegura que solo baje el clip individual aunque la URL sea de una lista
            cmd_dl = [PYTHON_EXE, '-m', 'yt_dlp', '--no-playlist', '-x', '--audio-format', 'mp3', '-o', audio_path, source]
            subprocess.run(cmd_dl, check=True, capture_output=True, text=True)
        else:
            # Si no es URL, asume que es un archivo ya en inputs (o usa el string como path)
            audio_path = source

        # 2. Separación de Stems con Demucs
        jobs[job_id]['step'] = 'separating_stems'
        jobs[job_id]['progress'] = 0
        cmd_demucs = [PYTHON_EXE, '-m', 'demucs', '-n', 'htdemucs', '--mp3', '-o', job_dir, audio_path]
        
        # Ejecutamos con Popen para leer stdout en tiempo real y capturar progreso
        process = subprocess.Popen(cmd_demucs, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        
        for line in process.stdout:
            # Demucs usa tqdm, buscamos algo como " 45%|"
            match = re.search(r'(\d+)%\|', line)
            if match:
                percent = int(match.group(1))
                update_job_progress(job_id, percent)
                print(f"[AI] Progress {job_id}: {percent}%")
        
        process.wait()
        if process.returncode != 0:
            raise subprocess.CalledProcessError(process.returncode, cmd_demucs)
        
        # 3. Transcripción con Basic Pitch
        jobs[job_id]['step'] = 'transcribing'
        print(f"[AI] Iniciando transcripción in-process para {job_id}...")
        
        # Importación diferida para no retrasar el inicio de la API
        from basic_pitch.inference import predict_and_save, Model
        
        model = Model() # Usa el modelo ICASSP 2022 por defecto
        input_audio_list = [pathlib.Path(audio_path)]
        save_dir = pathlib.Path(job_dir)
        
        predict_and_save(
            input_audio_list,
            save_dir,
            save_midi=True,
            sonify_midi=False,
            save_model_outputs=False,
            save_note_events=False,
            model_or_model_path=model
        )
        
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['step'] = 'done'
        print(f"[AI] Job {job_id} finalizado con éxito.")
    except subprocess.CalledProcessError as e:
        error_msg = f"Command '{' '.join(e.cmd)}' failed with exit status {e.returncode}. Output: {e.stderr or e.stdout}"
        print(f"Error en Job {job_id}: {error_msg}")
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['error'] = error_msg
    except Exception as e:
        print(f"Error inesperado en Job {job_id}: {str(e)}")
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['error'] = str(e)

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    source = data.get('source') # URL o nombre de archivo
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {'status': 'queued', 'step': 'init'}
    
    thread = threading.Thread(target=process_track, args=(job_id, source))
    thread.start()
    
    return jsonify({'job_id': job_id})

@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    return jsonify(jobs.get(job_id, {'status': 'not_found'}))

@app.route('/files/<job_id>/<filename>', methods=['GET'])
def get_file(job_id, filename):
    return send_from_directory(os.path.join(OUTPUT_DIR, job_id), filename)

if __name__ == '__main__':
    print(f"[AI] Hub AI Worker v{AI_WORKER_VERSION} iniciado.")
    app.run(host='0.0.0.0', port=5000)
