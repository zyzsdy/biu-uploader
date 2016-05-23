chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, tab) {
    if (changeinfo.status == "complete") {
        if (/biu\.moe\/[^f]/.test(tab.url)) {
            chrome.tabs.executeScript(null, { file: "uploadtool.js" });
        }
        if (/biu\.moe\/fm/.test(tab.url)) {
            chrome.tabs.executeScript(null, { file: "tools/fmvolume.js" });
        }
    }
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if (request.msg == "openindex") {
        chrome.tabs.create({
            url: "index.html"
        });
    }
});