chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 你的处理逻辑
  sendResponse();
});
