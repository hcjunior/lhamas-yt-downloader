// =========================================================
// !!! IMPORTANTE: CONFIGURAR A URL DA API AQUI !!!
// Para testes locais: 'http://127.0.0.1:5000'
// Após o deploy no Render: 'https://<---->.onrender.com'
// =========================================================
const API_URL = 'http://127.0.0.1:5000'; // <- MUDAR QUANDO FAZER O DEPLOY

const searchForm = document.getElementById('search-form');
const searchButton = document.getElementById('search-button');
const searchButtonText = searchButton.querySelector('.button-text');
const spinner = searchButton.querySelector('.spinner');
const youtubeUrlInput = document.getElementById('youtube-url');

const searchCard = document.getElementById('search-card');
const resultsCard = document.getElementById('results-card');
const statusCard = document.getElementById('status-card');

const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoAuthor = document.getElementById('video-author');
const videoDuration = document.getElementById('video-duration');
const videoViews = document.getElementById('video-views');
const downloadButtonsContainer = document.getElementById('download-buttons');
const messageContent = document.getElementById('message-content');

let currentUrl = '';

searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = youtubeUrlInput.value.trim();
    if (!url) return;

    currentUrl = url;
    toggleLoading(true);
    resultsCard.style.display = 'none';
    statusCard.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/api/fetch-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro desconhecido no servidor.');
        }

        const data = await response.json();
        displayResults(data);

    } catch (error) {
        displayStatus('error', `Erro: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
});

function toggleLoading(isLoading) {
    if (isLoading) {
        searchButton.disabled = true;
        searchButtonText.style.display = 'none';
        spinner.style.display = 'inline-block';
        spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        searchButton.disabled = false;
        searchButtonText.style.display = 'inline-block';
        spinner.style.display = 'none';
    }
}

function displayResults(data) {
    videoThumbnail.src = data.thumbnail;
    videoTitle.textContent = data.title;
    videoAuthor.textContent = data.author;
    videoDuration.textContent = data.duration;
    videoViews.textContent = data.views.toLocaleString('pt-BR');

    downloadButtonsContainer.innerHTML = ''; // Limpa botões antigos

    data.formats.forEach(format => {
        const button = document.createElement('button');
        const isAudio = format.resolution === 'Somente Áudio';
        button.className = isAudio ? 'audio-btn' : 'download-btn';

        button.innerHTML = isAudio
            ? `<i class="fas fa-music"></i> ${format.resolution}`
            : `<i class="fas fa-download"></i> Baixar MP4 (${format.resolution})`;

        button.dataset.formatId = format.format_id;
        button.addEventListener('click', () => downloadVideo(format.format_id, `${data.title} - ${format.resolution}.mp4`));
        downloadButtonsContainer.appendChild(button);
    });

    resultsCard.style.display = 'block';
}

async function downloadVideo(formatId, filename) {
    displayStatus('progress', `Preparando o download...`);
    try {
        const response = await fetch(`${API_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl, format_id: formatId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao obter o link de download.');
        }

        const data = await response.json();

        // Cria um link temporário e clica nele para iniciar o download
        const link = document.createElement('a');
        link.href = data.download_url;
        link.target = '_blank';
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        displayStatus('success', `Download Concluído!`, 'Seu download foi iniciado em uma nova aba.');
    } catch (error) {
        displayStatus('error', `Erro no Download: ${error.message}`);
    }
}

function displayStatus(type, title, message = '') {
    resultsCard.style.display = 'none';
    let icon = '';
    let colorClass = '';

    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            colorClass = 'status-success';
            break;
        case 'error':
            icon = '<i class="fas fa-times-circle"></i>';
            colorClass = 'status-error';
            break;
        case 'progress':
            icon = '<i class="fas fa-spinner fa-spin"></i>';
            colorClass = 'status-progress';
            break;
    }

    messageContent.innerHTML = `
        <div class="status-icon ${colorClass}">${icon}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        <button id="new-download-btn">Novo Download</button>
    `;
    statusCard.style.display = 'block';

    document.getElementById('new-download-btn').addEventListener('click', () => {
        statusCard.style.display = 'none';
        searchCard.style.display = 'block';
        youtubeUrlInput.value = '';
    });
}