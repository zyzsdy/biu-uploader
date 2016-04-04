chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, tab) {
    if (changeinfo.status == "complete") {
        if (/biu\.moe/.test(tab.url)) {
            chrome.tabs.executeScript(null, { file: "uploadtool.js" });
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