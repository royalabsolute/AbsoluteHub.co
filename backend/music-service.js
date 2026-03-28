const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class MusicService {
    constructor() {
        this.aiWorkerUrl = 'http://localhost:5000';
        this.musicPath = path.join(__dirname, 'music_data');
        this.activeJobs = new Set();
        fs.ensureDirSync(this.musicPath);
    }

    async startProcessing(source) {
        try {
            const response = await axios.post(`${this.aiWorkerUrl}/process`, { source });
            if (response.data.job_id) {
                this.activeJobs.add(response.data.job_id);
            }
            return response.data; // { job_id: '...' }
        } catch (e) {
            console.error("Error connecting to AI Worker:", e.message);
            throw new Error("El motor de IA no está respondiendo.");
        }
    }

    async getJobStatus(jobId) {
        try {
            const response = await axios.get(`${this.aiWorkerUrl}/status/${jobId}`);
            if (response.data.status === 'completed' || response.data.status === 'failed') {
                this.activeJobs.delete(jobId);
            }
            return response.data;
        } catch (e) {
            return { status: 'error', message: "No se pudo obtener el estado." };
        }
    }

    async getActiveJobsProgress() {
        if (this.activeJobs.size === 0) return [];
        const progresses = [];
        for (const jobId of this.activeJobs) {
            try {
                const res = await axios.get(`${this.aiWorkerUrl}/status/${jobId}`);
                if (res.data.status === 'processing') {
                    progresses.push({ job_id: jobId, progress: res.data.progress || 0 });
                } else {
                    this.activeJobs.delete(jobId);
                }
            } catch (e) { }
        }
        return progresses;
    }

    async getProjectFiles(jobId) {
        // En el sistema actual, Demucs genera una carpeta por modelo y track
        // Estructura: <jobId>/htdemucs/<jobId>/vocals.mp3
        const basePath = `${jobId}/htdemucs/${jobId}`;
        return [
            { name: `${basePath}/vocals.mp3`, type: 'stem', label: 'Voz' },
            { name: `${basePath}/drums.mp3`, type: 'stem', label: 'Batería' },
            { name: `${basePath}/bass.mp3`, type: 'stem', label: 'Bajo' },
            { name: `${basePath}/other.mp3`, type: 'stem', label: 'Instrumentos' },
            { name: `${jobId}/${jobId}_basic_pitch.mid`, type: 'score', label: 'Partitura' }
        ];
    }
}

module.exports = new MusicService();
