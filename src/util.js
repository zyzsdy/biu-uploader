"use strict"
//ID生成器
function* idGenerator() {
    var count = 1;
    while (true) {
        yield count++;
    }
}

//B -> 带单位转换
function formatSize(size) {
    if (size <= 1024) {
        return size.toFixed(2) + "B";
    } else if (size <= 1048576) {
        return (size / 1024).toFixed(2) + "KB";
    } else if (size <= 1073741824) {
        return (size / 1048576).toFixed(2) + "MB";
    } else if (size <= 1099511627776) {
        return (size / 1073741824).toFixed(2) + "GB";
    } else {
        return (size / 1099511627776).toFixed(2) + "TB";
    }
}

function formatSizeThousand(size) {
    if (size <= 1000) {
        return size.toFixed(2) + "b";
    } else if (size <= 1000000) {
        return (size / 1000).toFixed(2) + "Kb";
    } else if (size <= 1000000000) {
        return (size / 1000000).toFixed(2) + "Mb";
    } else if (size <= 1000000000000) {
        return (size / 1000000000).toFixed(2) + "Gb";
    } else {
        return (size / 1000000000000).toFixed(2) + "Tb";
    }
}

//状态 -> 按钮颜色类
function fileStatusClass(fileStatus) {
    switch (fileStatus) {
        case FileStatus.PROCESSING:
        case FileStatus.UPLOADING:
        case FileStatus.WAITING:
            return "btn-warning";
        case FileStatus.READY:
        case FileStatus.PAUSED:
            return "btn-info";
        case FileStatus.ERROR:
            return "btn-danger";
        case File.FINISHED:
        default:
            return "btn-success";
    }
}

//状态 -> 进度条颜色类
function progressBarStatusClass(fileStatus) {
    switch (fileStatus) {
        case FileStatus.PROCESSING:
            return "progress-bar-warning";
        case FileStatus.ERROR:
            return "progress-bar-danger";
        case FileStatus.UPLOADING:
        case FileStatus.WAITING:
        case FileStatus.READY:
        case File.FINISHED:
        default:
            return "progress-bar-info";
    }
}

//格式化百分比
function percentFormat(value, total) {
    var result = (value / total) * 100;
    return result.toFixed(1) + "%";
}

//弹出框
function modal(content, title, option) {
    option = option || {};
    var suicide = option.suicide || false;
    var oncreated = option.oncreated || function () { };
    var callback = option.callback || function () { };

    $("#modal-content").html(content);
    $("#modal-title").html(title);

    if (option.type == "okcancel") {
        $("#modal-closebtn").hide();
        $("#modal-okbtn").show();
        $("#modal-cancelbtn").show();
        $("#modal-okbtn").on("click", function () {
            if (callback() === false) return false;
            $("#modal-okbtn").unbind();
            $("#modal").modal('hide');
        })
    } else if (option.type == "ok") {
        $("#modal-closebtn").hide();
        $("#modal-okbtn").show();
        $("#modal-cancelbtn").hide();
        $("#modal-okbtn").on("click", function () {
            if (callback() === false) return false;
            $("#modal-okbtn").unbind();
            $("#modal").modal('hide');
        })
    } else {
        $("#modal-closebtn").show();
        $("#modal-okbtn").hide();
        $("#modal-cancelbtn").hide();
    }

    $("#modal").modal();
    $("#modal").on("hidden.bs.modal", function () {
        $("#modal-okbtn").unbind();
        if (suicide) {
            callback();
        }
    });
    oncreated();
}

//设置
class Config {
    constructor() {

    }
    load() {
        var self = this;

        chrome.storage.local.get('bconfig', function(data) {
            if (data.bconfig == null) {
                self.init("未找到配置文件");
            } else {
                try {
                    var config = JSON.parse(data.bconfig);
                } catch (err) {
                    self.init("无法读取配置文件。");
                }
                if (!config.uid || !config.token) {
                    self.init("配置文件格式出错。");
                } else if (config.uid.length <= 0 || config.token.length <= 8) {
                    self.init("配置格式出错。");
                } else {
                    self.uid = config.uid;
                    self.token = config.token;
                }
            }
        });
    }
    init(text) {
        text = text || "";
        var self = this;
        var infoHtml = $("<div>").append($("<p>").append(text));
        infoHtml.append($("<p>请在下面输入框中输入你的UID和上传密钥，如果不知道，请登录biu.moe后在<a href=\"http://biu.moe/#User/api\" target=\"_blank\">http://biu.moe/#User/api</a>页面处查询。</p>"));

        var uidInput = $("<input type=\"text\" placeholder=\"UID\">");
        if (this.uid) {
            uidInput.attr("value", this.uid);
        }
        infoHtml.append($("<p>").append(uidInput));
        var tokenInput = $("<input type=\"text\" placeholder=\"上传密钥\" size=\"45\">");
        if (this.token) {
            tokenInput.attr("value", this.token);
        }
        infoHtml.append($("<p>").append(tokenInput));

        modal(infoHtml, "用户初始化", {
            type: "ok",
            callback: function() {
                var uid = uidInput.val();
                if (uid.length <= 0) {
                    alert("UID不正确。");
                    return false;
                }
                var token = tokenInput.val();
                if (token.length <= 8) {
                    alert("上传密钥格式不正确。");
                    return false;
                }
                self.uid = uid;
                self.token = token;
                self.save();
            }
        });
    }
    save() {
        var data = {};
        data.uid = this.uid;
        data.token = this.token;

        chrome.storage.local.set({ bconfig: JSON.stringify(data) });
    }
}

//Url-safe Base64
function base64Encode(str) {
    var c1, c2, c3;
    var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    var i = 0, len = str.length, string = '';

    while (i < len) {
        c1 = str.charCodeAt(i++) & 0xff;
        if (i == len) {
            string += base64EncodeChars.charAt(c1 >> 2);
            string += base64EncodeChars.charAt((c1 & 0x3) << 4);
            string += "==";
            break;
        }
        c2 = str.charCodeAt(i++);
        if (i == len) {
            string += base64EncodeChars.charAt(c1 >> 2);
            string += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
            string += base64EncodeChars.charAt((c2 & 0xF) << 2);
            string += "=";
            break;
        }
        c3 = str.charCodeAt(i++);
        string += base64EncodeChars.charAt(c1 >> 2);
        string += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        string += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
        string += base64EncodeChars.charAt(c3 & 0x3F);
    }
    return string;
}