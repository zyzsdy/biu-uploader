(function() {
    function getButton() {
        var alist = document.getElementById("g_iframe").contentDocument.getElementsByTagName("a");
        for (var idx in alist) {
            if (/\/Upload/.test(alist[idx].href)) {
                return alist[idx];
            }
        }
        return null;
    }
    var upbutton = getButton();
    if (upbutton != null) {
        upbutton.onclick = function(event) {
            event.preventDefault();
            chrome.extension.sendRequest({ msg: "openindex" });
            return false;
        }
    }
})();