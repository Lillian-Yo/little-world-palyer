let offscreenCreated = false;
let currentAudioLink = null; // 页面地址
let currentAudioSrc = null;  // 直链
let currentLinkText = null;  // 链接文字
let isPlaying = false; // 播放状态

async function ensureOffscreenDocument() {
  if (offscreenCreated) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: '播放音频，不依赖可视窗口'
  });
  offscreenCreated = true;
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'litteworld',
      title: "添加到播放器",
      contexts: ["link", "page"]
    });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'litteworld') {
        // 获取点击的链接
        let linkToOpen = info.linkUrl || info.pageUrl;
        const linkText = info.selectionText || info.linkText || '未知标题'; // 获取链接文字
        if (linkToOpen) {
            currentAudioLink = linkToOpen;
            currentAudioSrc = null;
            currentLinkText = linkText;
            isPlaying = false;
            
            // fetch 页面并解析 og:audio
            try {
                const res = await fetch(linkToOpen);
                const text = await res.text();
                const match = text.match(/<meta\s+property="og:audio"\s+content="([^"]+)"/i);
                const h1Match = text.match(/<h1[^>]*class=["'][^"']*jsx-399326063[^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i);
                if (h1Match && h1Match[1]) {
                    currentLinkText = h1Match[1].trim();
                }
                if (match && match[1]) {
                    currentAudioSrc = match[1];
                    // 解析成功后直接开始播放
                    await ensureOffscreenDocument();
                    chrome.runtime.sendMessage({
                        type: 'start-audio',
                        audioSrc: currentAudioSrc
                    });
                    isPlaying = true;
                }
            } catch (e) {
                console.log('解析音频直链失败:', e);
                currentAudioSrc = null;
            }
            
            // 通知popup更新（如果popup打开的话）
            chrome.runtime.sendMessage({
                type: 'update-audio-link',
                audioLink: linkToOpen,
                audioSrc: currentAudioSrc,
                linkText: currentLinkText,
                isPlaying: isPlaying
            });
        }
    }
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('处理来自popup的消息', message.type)
    if (message.type === 'play-audio' && currentAudioSrc) {
        // 确保offscreen文档已创建
        ensureOffscreenDocument().then(() => {
            chrome.runtime.sendMessage({
                type: 'start-audio',
                audioSrc: currentAudioSrc
            });
        });
    } else if (message.type === 'pause-audio') {
        ensureOffscreenDocument().then(() => {
            chrome.runtime.sendMessage({
                type: 'pause-audio'
            });
        });
    } else if (message.type === 'resume-audio') {
        ensureOffscreenDocument().then(() => {
            chrome.runtime.sendMessage({
                type: 'resume-audio'
            });
        });
    } else if (message.type === 'audio-status-changed') {
        isPlaying = message.isPlaying;
        // 转发状态变化消息给popup
        chrome.runtime.sendMessage({
            type: 'audio-status-changed',
            isPlaying: message.isPlaying
        });
    } else if (message.type === 'get-current-status') {
        // popup打开时请求当前状态
        sendResponse({
            audioLink: currentAudioLink,
            audioSrc: currentAudioSrc,
            linkText: currentLinkText,
            isPlaying: isPlaying
        });
        return true;
    } else if (message.type === 'get-audio-progress') {
        // 转发给offscreen获取进度
        chrome.runtime.sendMessage({ type: 'get-audio-progress' }, sendResponse);
        return true; // 异步响应
    } else if (message.type === 'seek-audio') {
        // 转发给offscreen设置进度
        chrome.runtime.sendMessage({ type: 'seek-audio', time: message.time });
    } else if (message.type === 'add-link-to-player' && message.linkUrl) {
        const linkToOpen = message.linkUrl;
        let linkText = message.linkText || '未知标题';
        currentAudioLink = linkToOpen;
        currentAudioSrc = null;
        isPlaying = false;
        console.log('添加音频单集')

        // fetch 页面并解析 og:audio
        fetch(linkToOpen).then(res => res.text()).then(text => {
            // 先抓取 og:audio
            const match = text.match(/<meta\s+property="og:audio"\s+content="([^"]+)"/i);
            // 再抓取 h1.jsx-399326063.title
            const h1Match = text.match(/<h1[^>]*class=["'][^"']*jsx-399326063[^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i);
            if (h1Match && h1Match[1]) {
                linkText = h1Match[1].trim();
            }
            currentLinkText = linkText;
            if (match && match[1]) {
                currentAudioSrc = match[1];
                ensureOffscreenDocument().then(() => {
                    chrome.runtime.sendMessage({
                        type: 'start-audio',
                        audioSrc: currentAudioSrc
                    });
                    isPlaying = true;
                    // 通知popup更新
                    chrome.runtime.sendMessage({
                        type: 'update-audio-link',
                        audioLink: linkToOpen,
                        audioSrc: currentAudioSrc,
                        linkText: currentLinkText,
                        isPlaying: isPlaying
                    });
                });
            } else {
                // 没有解析到音频
                chrome.runtime.sendMessage({
                    type: 'update-audio-link',
                    audioLink: linkToOpen,
                    audioSrc: null,
                    linkText: linkText,
                    isPlaying: false
                });
            }
        }).catch(e => {
            chrome.runtime.sendMessage({
                type: 'update-audio-link',
                audioLink: linkToOpen,
                audioSrc: null,
                linkText: linkText,
                isPlaying: false
            });
        });
        return;
    }
});

  
  
  