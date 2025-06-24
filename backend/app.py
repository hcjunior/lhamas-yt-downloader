from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import logging

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
        # AQUI ESTÁ A MUDANÇA
        ydl_opts = {
            'quiet': True,
            'source_address': '0.0.0.0'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ... (o resto da função continua igual)
            info = ydl.extract_info(url, download=False)

            formats = []
            for f in info.get('formats', []):
                if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('ext') == 'mp4':
                    resolution = f.get('height')
                    if resolution:
                        formats.append({
                            'format_id': f.get('format_id'),
                            'resolution': f'{resolution}p',
                            'filesize_mb': round(f.get('filesize', 0) / (1024*1024), 2) if f.get('filesize') else 0
                        })

            audio_only = next((f for f in info['formats'] if f.get(
                'vcodec') == 'none' and f.get('acodec') != 'none'), None)
            if audio_only:
                formats.append({
                    'format_id': audio_only.get('format_id'),
                    'resolution': 'Somente Áudio',
                    'filesize_mb': round(audio_only.get('filesize', 0) / (1024*1024), 2) if audio_only.get('filesize') else 0
                })

            unique_formats = []
            seen_resolutions = set()
            for f in sorted(formats, key=lambda x: x.get('filesize_mb', 0), reverse=True):
                if f['resolution'] not in seen_resolutions:
                    unique_formats.append(f)
                    seen_resolutions.add(f['resolution'])

            video_info = {
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'author': info.get('uploader'),
                'duration': info.get('duration_string'),
                'views': info.get('view_count'),
                'formats': sorted(unique_formats, key=lambda x: (x['resolution'] != 'Somente Áudio', int(x['resolution'][:-1]) if x['resolution'] != 'Somente Áudio' else 0), reverse=True)
            }
            return jsonify(video_info)

    except Exception as e:
        logging.error(f"Erro ao buscar informações: {e}")
        return jsonify({'error': 'Não foi possível buscar informações do vídeo. Verifique o link.'}), 500


@app.route('/api/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url')
    format_id = data.get('format_id')

    if not url or not format_id:
        return jsonify({'error': 'URL ou formato inválido'}), 400

    try:
        # A MESMA MUDANÇA AQUI
        ydl_opts = {
            'quiet': True,
            'format': format_id,
            'source_address': '0.0.0.0'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            download_url = info.get('url')
            return jsonify({'download_url': download_url})

    except Exception as e:
        logging.error(f"Erro ao gerar link de download: {e}")
        return jsonify({'error': 'Não foi possível gerar o link de download.'}), 500

# Adicione esta rota para a raiz da API para evitar o erro 404 nos logs


@app.route('/')
def index():
    return "API do Lhamas Downloader está no ar! Use os endpoints /api/."


if __name__ == '__main__':
    app.run(debug=True, port=5000)
