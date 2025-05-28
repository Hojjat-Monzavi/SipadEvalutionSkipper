/**
 * Listener for browser action (extension icon) click event.
 * Injects the content script (`content.js`) into the current active tab.
 * 
 * @param {chrome.tabs.Tab} tab - The tab where the extension icon was clicked.
 */
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});
