import os
import requests
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import re

# Configuração
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

# Pega a chave da API das variáveis de ambiente do Render
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')


def sanitize_filename(title: str) -> str:
    """ Remove caracteres inválidos para usar como nome de arquivo. """
    sanitized = re.sub(r'[\\/*?:"<>|]', "", title)
    return re.sub(r'\s+', ' ', sanitized).strip()


@app.route('/api/fetch-info', methods=['POST'])
def fetch_info():
    video_url = request.get_json().get('url')

    if not video_url:
        return jsonify({'error': 'URL não fornecida'}), 400

    if not RAPIDAPI_KEY:
        return jsonify({'error': 'A chave da API não está configurada no servidor.'}), 500

    # Configurações para a nova API (youtube-v31)
    api_url = "https://youtube-v31.p.rapidapi.com/dl"
    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": "youtube-v31.p.rapidapi.com"
    }
    querystring = {"url": video_url}

    try:
        logging.info(
            f"Buscando informações via API youtube-v31 para: {video_url}")

        response = requests.get(api_url, headers=headers, params=querystring)
        response.raise_for_status()

        data = response.json()

        if not data.get('status'):
            raise Exception(
                data.get('msg', 'A API retornou um erro desconhecido.'))

        # --- Processa a resposta da nova API ---
        formats_to_send = []

        # Formatos de vídeo (geralmente sem áudio para alta qualidade) e com áudio
        for f in data.get('formats', []):
            if f.get('hasVideo') and f.get('hasAudio'):  # Formatos progressivos
                formats_to_send.append({
                    'download_url': f.get('url'),
                    'resolution': f.get('qualityLabel'),
                    'filesize_mb': round(f.get('contentLength', 0) / (1024*1024), 2)
                })

        # Formatos somente de áudio
        best_audio = max(
            [f for f in data.get('formats', []) if f.get(
                'hasAudio') and not f.get('hasVideo')],
            key=lambda x: x.get('audioBitrate', 0),
            default=None
        )
        if best_audio:
            formats_to_send.append({
                'download_url': best_audio.get('url'),
                'resolution': 'Somente Áudio (MP3)',
                'filesize_mb': round(best_audio.get('contentLength', 0) / (1024*1024), 2)
            })

        video_info = {
            'title': data.get('title'),
            'clean_title': sanitize_filename(data.get('title', 'video')),
            'thumbnail': data.get('thumb'),
            'author': data.get('channel'),
            'duration': data.get('duration'),
            'views': data.get('total_views', 0),
            'formats': formats_to_send
        }

        return jsonify(video_info)

    except requests.exceptions.RequestException as e:
        logging.error(f"Erro de conexão com a API de proxy: {e}")
        return jsonify({'error': 'Não foi possível conectar à API de proxy.'}), 503
    except Exception as e:
        logging.error(f"Erro ao processar a resposta da API: {e}")
        return jsonify({'error': f'Erro: {e}'}), 500


@app.route('/')
def index():
    return "API do Lhamas Downloader está no ar!"


if __name__ == '__main__':
    app.run(debug=True, port=5000)
