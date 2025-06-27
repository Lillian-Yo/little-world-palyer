let audio;
let isPlaying = false;
let currentAudioSrc = null;
let progressPort = null;
let progressInterval = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-audio") {
    // 如果是新的音频源，创建新的Audio对象
    if (currentAudioSrc !== msg.audioSrc) {
      if (audio) {
        audio.pause();
      }
      audio = new Audio(msg.audioSrc);
      audio.loop = true;
      currentAudioSrc = msg.audioSrc;
    }
    
    // 播放音频（如果已经暂停，会从上次位置继续）
    audio.play().then(() => {
      isPlaying = true;
      // 通知popup更新播放状态
      chrome.runtime.sendMessage({
        type: 'audio-status-changed',
        isPlaying: true
      });
    }).catch((error) => {
      console.log('播放失败:', error);
      isPlaying = false;
      chrome.runtime.sendMessage({
        type: 'audio-status-changed',
        isPlaying: false
      });
    });
  } else if (msg.type === "pause-audio") {
    if (audio && isPlaying) {
      audio.pause();
      isPlaying = false;
      chrome.runtime.sendMessage({
        type: 'audio-status-changed',
        isPlaying: false
      });
    }
  } else if (msg.type === "resume-audio") {
    if (audio && !isPlaying) {
      // 继续播放，从上次暂停的位置开始
      audio.play().then(() => {
        isPlaying = true;
        chrome.runtime.sendMessage({
          type: 'audio-status-changed',
          isPlaying: true
        });
      }).catch((error) => {
        console.log('恢复播放失败:', error);
      });
    }
  } else if (msg.type === "get-audio-progress") {
    if (audio) {
      chrome.runtime.sendMessage({
        type: 'audio-progress',
        currentTime: audio.currentTime,
        duration: audio.duration || 0
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'audio-progress',
        currentTime: 0,
        duration: 0
      });
    }
  } else if (msg.type === "seek-audio") {
    if (audio && typeof msg.time === 'number') {
      audio.currentTime = msg.time;
    }
  }
});

// 监听音频结束事件
if (audio) {
  audio.addEventListener('ended', () => {
    isPlaying = false;
    chrome.runtime.sendMessage({
      type: 'audio-status-changed',
      isPlaying: false
    });
  });
}

// 监听 popup 的长连接请求
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'audio-progress') {
    progressPort = port;
    // 定时推送进度
    progressInterval = setInterval(() => {
      if (audio && progressPort) {
        progressPort.postMessage({
          type: 'audio-progress',
          currentTime: audio.currentTime,
          duration: audio.duration || 0
        });
      }
    }, 500);
    port.onDisconnect.addListener(() => {
      clearInterval(progressInterval);
      progressPort = null;
    });
  }
}); 