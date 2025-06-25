import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import logging

# Configuração
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)


@app.route('/api/fetch-info', methods=['POST'])
def fetch_info():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400

    try:
        # --- MUDANÇA PRINCIPAL AQUI ---
        # 1. 'progressive=True': Pede apenas streams que já contêm vídeo e áudio.
        # 2. 'file_extension=mp4': Garante que o formato seja MP4.
        # 3. 'noplaylist=True': Evita baixar playlists inteiras acidentalmente.
        ydl_opts = {
            'quiet': True,
            'noplaylist': True,
            'format': 'best[progressive=True][ext=mp4]/best[ext=mp4]/best'
        }

        logging.info("Buscando formatos progressivos (vídeo+áudio)...")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            formats_to_send = []

            # Streams progressivos já estão no campo 'formats'
            for f in info.get('formats', []):
                # Filtra apenas os formatos que são 'progressivos' e mp4
                if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('ext') == 'mp4':
                    resolution = f.get('height')
                    if resolution:
                        formats_to_send.append({
                            'format_id': f.get('format_id'),
                            'resolution': f'{resolution}p',
                            'filesize_mb': round(f.get('filesize', 0) / (1024*1024), 2) if f.get('filesize') else 0
                        })

            # Adiciona o melhor áudio como uma opção separada
            audio_only = ydl.extract_info(
                url, download=False, extra_info={'format': 'bestaudio'})
            best_audio_format = audio_only.get('formats', [{}])[0]
            if best_audio_format:
                formats_to_send.append({
                    'format_id': best_audio_format.get('format_id'),
                    'resolution': 'Somente Áudio (MP3)',
                    'filesize_mb': round(best_audio_format.get('filesize', 0) / (1024*1024), 2) if best_audio_format.get('filesize') else 0
                })

            video_info = {
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'author': info.get('uploader'),
                'duration': info.get('duration_string'),
                'views': info.get('view_count'),
                'formats': formats_to_send
            }
            return jsonify(video_info)

    except Exception as e:
        logging.error(f"Erro ao buscar informações: {e}")
        # Mensagem de erro genérica, pois não é mais um problema de proxy
        return jsonify({'error': 'Não foi possível buscar informações do vídeo. Verifique o link ou tente mais tarde.'}), 500


@app.route('/api/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url')
    format_id = data.get('format_id')

    if not url or not format_id:
        return jsonify({'error': 'URL ou formato inválido'}), 400

    try:
        # Pedido simples, sem proxy, usando o format_id escolhido
        ydl_opts = {
            'quiet': True,
            'format': format_id
        }

        # Para downloads de áudio, podemos converter para MP3
        if 'audio' in format_id.lower() or 'Somente' in request.json.get('resolution', ''):
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            download_url = info.get('url')
            return jsonify({'download_url': download_url})

    except Exception as e:
        logging.error(f"Erro ao gerar link de download: {e}")
        return jsonify({'error': 'Não foi possível gerar o link de download.'}), 500


@app.route('/')
def index():
    return "API do Lhamas Downloader está no ar!"


if __name__ == '__main__':
    app.run(debug=True, port=5000)