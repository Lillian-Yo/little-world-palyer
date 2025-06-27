let currentAudioLink = null;
let currentAudioSrc = null;
let currentLinkText = null;
let isPlaying = false;
let progressBar = null;
let progressTimer = null;
let audioDuration = 0;
let lastProgress = 0;
let currentTimeSpan = null;
let durationSpan = null;
let port = null;

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'update-audio-link') {
        currentAudioLink = message.audioLink;
        currentAudioSrc = message.audioSrc;
        currentLinkText = message.linkText;
        isPlaying = message.isPlaying || false;
        updateUI();
    } else if (message.type === 'audio-status-changed') {
        isPlaying = message.isPlaying;
        updateUI();
    }
    sendResponse();
    return true;
});

// 获取当前状态
function getCurrentStatus() {
    chrome.runtime.sendMessage({
        type: 'get-current-status'
    }, (response) => {
        if (response) {
            currentAudioLink = response.audioLink;
            currentAudioSrc = response.audioSrc;
            currentLinkText = response.linkText;
            isPlaying = response.isPlaying;
            updateUI();
        }
    });
}

// 更新UI显示
function updateUI() {
    const playBtn = document.getElementById("playBtn");
    const info = document.querySelector(".info");
    progressBar = document.getElementById("progressBar");
    currentTimeSpan = document.getElementById("currentTime");
    durationSpan = document.getElementById("duration");
    const progressContainer = document.getElementById("progressContainer");
    const dynamicTitle = document.getElementById("dynamicTitle");
    
    if (currentAudioLink) {
        if (currentAudioSrc) {
            if (dynamicTitle) dynamicTitle.textContent = currentLinkText || '未知音频';
            if (isPlaying) {
                playBtn.textContent = "暂停";
                playBtn.disabled = false;
                if (progressContainer) progressContainer.style.display = "flex";
                connectPort();
            } else {
                playBtn.textContent = "播放音频";
                playBtn.disabled = false;
                if (progressContainer) progressContainer.style.display = "flex";
                disconnectPort();
            }
            if (currentTimeSpan) currentTimeSpan.textContent = formatTime(lastProgress);
            if (durationSpan) durationSpan.textContent = formatTime(audioDuration);
            dynamicTitle.textContent = ` ${currentLinkText || '未知音频'}`;
        } else {
            if (dynamicTitle) dynamicTitle.textContent = '';
            playBtn.textContent = "请先选择音频";
            playBtn.disabled = true;
            if (progressContainer) progressContainer.style.display = "none";
            disconnectPort();
            if (currentTimeSpan) currentTimeSpan.textContent = "00:00";
            if (durationSpan) durationSpan.textContent = "00:00";
            dynamicTitle.textContent = "未获取到音频直链";
        }
    } else {
        if (dynamicTitle) dynamicTitle.textContent = '';
        playBtn.textContent = "请先选择音频";
        playBtn.disabled = true;
        if (progressContainer) progressContainer.style.display = "none";
        disconnectPort();
        if (currentTimeSpan) currentTimeSpan.textContent = "00:00";
        if (durationSpan) durationSpan.textContent = "00:00";
        info.textContent = "https://xyzrank.com单集标题右键，\"添加到播放器\"";
    }
}

function connectPort() {
    if (port) return;
    port = chrome.runtime.connect({ name: "audio-progress" });
    port.onMessage.addListener((msg) => {
        if (msg.type === 'audio-progress') {
            audioDuration = msg.duration;
            lastProgress = msg.currentTime;
            if (progressBar) {
                progressBar.max = audioDuration;
                progressBar.value = lastProgress;
            }
            if (currentTimeSpan) currentTimeSpan.textContent = formatTime(lastProgress);
            if (durationSpan) durationSpan.textContent = formatTime(audioDuration);
        }
    });
}

function disconnectPort() {
    if (port) {
        port.disconnect();
        port = null;
    }
}

// 播放/暂停按钮点击事件
document.getElementById("playBtn").addEventListener("click", () => {
    if (currentAudioSrc) {
        if (isPlaying) {
            // 当前正在播放，点击暂停
            chrome.runtime.sendMessage({
                type: "pause-audio"
            });
        } else {
            // 当前暂停，点击播放
            chrome.runtime.sendMessage({
                type: "play-audio"
            });
        }
    }
});

// 进度条拖动事件
window.addEventListener('DOMContentLoaded', () => {
    progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.addEventListener('input', (e) => {
            const seekTime = parseFloat(e.target.value);
            chrome.runtime.sendMessage({ type: "seek-audio", time: seekTime });
        });
    }

    // 输入框添加播客单集
    const linkInput = document.getElementById('linkInput');
    const addLinkBtn = document.getElementById('addLinkBtn');
    if (addLinkBtn && linkInput) {
        addLinkBtn.addEventListener('click', () => {
            const url = linkInput.value.trim();
            // 校验格式
            const pattern = /^https:\/\/www\.xiaoyuzhoufm\.com\/episode\/[a-zA-Z0-9]+$/;
            if (!pattern.test(url)) {
                alert('请输入有效的小宇宙单集链接，如：https://www.xiaoyuzhoufm.com/episode/684db7ec4abe6e29cb25d33e');
                return;
            }
            // 模拟右键菜单添加到播放器的行为
            chrome.runtime.sendMessage({
                type: 'add-link-to-player',
                linkUrl: url,
                linkText: '手动添加'
            });
            linkInput.value = '';
        });
        linkInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addLinkBtn.click();
            }
        });
    }
});

// 初始化UI和获取当前状态
updateUI();
getCurrentStatus();

function formatTime(sec) {
    if (!isFinite(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

  
  