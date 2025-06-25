// =========================================================
// !!! IMPORTANTE: CONFIGURAR A URL DA API AQUI !!!
// Após o deploy no Render: 'https://seu-app.onrender.com'
// =========================================================
const API_URL = 'https://lhamas-downloader-api.onrender.com';

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

// Não precisamos mais da variável 'currentUrl', pois a URL de download já vem pronta.

searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = youtubeUrlInput.value.trim();
    if (!url) return;

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
        if (data.formats && data.formats.length === 0) {
            throw new Error('Nenhum formato de download disponível foi encontrado para este vídeo.');
        }
        displayResults(data);

    } catch (error) {
        displayStatus('error', `Erro ao buscar vídeo`, error.message);
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
    // Garante que 'views' exista e seja um número antes de formatar
    videoViews.textContent = (data.views || 0).toLocaleString('pt-BR');

    downloadButtonsContainer.innerHTML = ''; // Limpa botões antigos

    data.formats.forEach(format => {
        const button = document.createElement('button');
        // A API agora usa 'Somente Áudio (MP3)' na resolução
        const isAudio = format.resolution.includes('Áudio');
        button.className = isAudio ? 'audio-btn' : 'download-btn';

        button.innerHTML = isAudio
            ? `<i class="fas fa-music"></i> Baixar ${format.resolution}`
            : `<i class="fas fa-download"></i> Baixar MP4 (${format.resolution})`;

        // --- MUDANÇA PRINCIPAL AQUI ---
        // A função de download agora recebe a URL direta e um nome de arquivo seguro.
        button.addEventListener('click', () => downloadVideo(
            format.download_url,
            `${data.clean_title} - ${format.resolution}.mp4`
        ));

        downloadButtonsContainer.appendChild(button);
    });

    resultsCard.style.display = 'block';
}

// --- MUDANÇA PRINCIPAL AQUI ---
// A função 'downloadVideo' foi simplificada. Ela não faz mais uma chamada de API.
// Ela apenas pega a URL de download que já recebemos e cria um link para o download.
function downloadVideo(downloadUrl, filename) {
    displayStatus('progress', `Iniciando download...`);

    try {
        // Cria um elemento de link <a> temporário
        const link = document.createElement('a');
        link.href = downloadUrl;

        // Define o nome do arquivo que será sugerido no download
        link.download = filename;

        // Adiciona o link ao corpo do documento, clica nele programaticamente, e depois o remove.
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        displayStatus('success', `Download Iniciado!`, 'Seu download deve ter começado. Verifique a barra de downloads do seu navegador.');
    } catch (error) {
        displayStatus('error', `Erro ao iniciar download`, error.message);
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
        <button id="new-download-btn">Fazer Novo Download</button>
    `;
    statusCard.style.display = 'block';

    document.getElementById('new-download-btn').addEventListener('click', () => {
        statusCard.style.display = 'none';
        searchCard.style.display = 'block';
        youtubeUrlInput.value = '';
    });
}