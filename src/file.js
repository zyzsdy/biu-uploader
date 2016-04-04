"use strict"
const apiUrl = "https://api.biu.moe/Api/createSong";
class File {
    constructor(id, file) {
        this.id = id;
        this.file = file;
        this.filename = file.name;
        this.size = file.size;
        this.checked = false;
        this.status = FileStatus.PROCESSING;
        this.uploadedSize = file.size;
        this.speed = 0;
        this.info = "文件已添加";
        this.prepare();
    }
    prepare() {
        var self = this;
        var md5Promise = this.calcMd5();

        Promise.all([md5Promise]).then(function(data) {
            self.md5 = data[0][0];
            self.crc32 = data[0][1];
            self.status = FileStatus.READY;
            self.info = "上传准备完成。";
        })
    }
    calcMd5() {
        this.info = "正在计算MD5。。。";
        var file = this.file;
        var self = this;

        return new Promise(function(res, rej) {
            var chunkSize = 2097152; //2MB分割为一块
            var chunks = Math.ceil(file.size / chunkSize);
            var currentChunk = 0;
            var spark = new SparkMD5.ArrayBuffer();
            var crc32 = new Crc32();
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                spark.append(e.target.result);
                crc32.update(e.target.result);

                self.uploadedSize -= chunkSize;
                if (self.uploadedSize < 0) {
                    self.uploadedSize = 0;
                }
                currentChunk++;
                if (currentChunk < chunks) {
                    loadNext();
                } else {
                    res([spark.end(), crc32.digest(10)]);
                }
            };
            fileReader.onerror = function() {
                self.info = "MD5计算出错";
                self.status = FileStatus.ERROR;
            };
            function loadNext() {
                var start = currentChunk * chunkSize,
                    end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
                fileReader.readAsArrayBuffer(file.slice(start, end));
            }
            loadNext();
        });
    }
    main() {
        var self = this;

        switch (this.status) {
            case FileStatus.PROCESSING:
                modal("请等待处理结束后上传。", "上传还没准备好");
                break;
            case FileStatus.READY:
                this.startUpload();
                break;
            case FileStatus.WAITING:
                modal("正在和服务器联系。", "请稍候");
                break;
            case FileStatus.UPLOADING:
                this.pause();
                break;
            case FileStatus.PAUSED:
                this.resume();
                break;
            case FileStatus.FINISHED:
                modal("已经成功的上传了，请去你的个人中心看看情况吧。", "上传完毕");
                break;
            case FileStatus.ERROR:
                if (this.__forceSign) {
                    modal("疑似撞车，需要强行上传么？", "撞车确认", {
                        type: "okcancel",
                        callback: function() {
                            self.startUpload(true);
                        }
                    })
                } else {
                    modal("发生了错误，请查看错误原因，删掉后重试。", "发生了错误");
                }
                break;
            default:
                modal("Something happened.", "Something happened");
                break;
        }
    }
    startUpload(force) {
        force = force || false;

        var uid = window.biu_config.uid;
        var key = window.biu_config.token;
        this.status = FileStatus.WAITING;
        var self = this;
        if (!uid || !key) {
            window.biu_config.init("配置初始化不正确，请手工填入信息。");
            return;
        }
        if (uid.length <= 0 || key.length <= 8) {
            window.biu_config.init("用户信息不完整。");
            return;
        }
        if (!(this.title && this.title.length > 0 && this.artist && this.artist.length > 0 && this.album && this.album.length > 0)) {
            modal("请完整填写歌曲信息。", "歌曲信息不完整");
            this.info = "歌曲信息不完整，请补充完整后再上传。";
            this.status = FileStatus.READY;
            return;
        }
        var remark = this.remark || "";

        var sign = SparkMD5.hash(String(uid) + String(this.md5) + this.title + this.artist + this.album + this.remark + key);
        var para = {
            "uid": uid,
            "filemd5": this.md5,
            "title": this.title,
            "singer": this.artist,
            "album": this.album,
            "remark": this.remark,
            "sign": sign
        }
        if (force) {
            para["force"] = 1;
        }
        //获得API
        $.post(apiUrl, para, function(data) {
            data = JSON.parse(data);
            if (data.success) {
                self.token = data.token;
                self.initUpload();
            } else {
                self.status = FileStatus.ERROR;
                if (data.error_code) {
                    switch (data.error_code) {
                        case 1: self.info = "签名校验失败，请按F2重新填写用户信息。"; break;
                        case 2:
                            self.info = "可能撞车。请返回网站搜索，如果确认没撞车请点击上面按钮强行上传。";
                            self.__forceSign = true;
                            break;
                        case 3: self.info = "上传的歌曲太多了，请等等管理员审核或者自己放弃一些。"; break;
                        case 4: self.info = "参数不全。"; break;
                        case 5: self.info = "撞MD5，如果你确认你确实没撞车请联系小新。"; break;
                        case 6: self.info = "数据库服务器异常。"; break;
                        case 7: self.info = "上传功能被关闭。"; break;
                        default: self.info = "Something happened."; break;
                    }
                } else {
                    self.info = "Something happened.";
                }
            }
        });
    }
    initUpload() {
        //如果文件小于1MB，则采用直接上传的方式
        if (this.size <= 1048576) {
            this.directUpload();
        } else {
            //进行分块初始化
            this.__totalBlocks = Math.ceil(this.size / 4194304); //总块数
            this.__uploadedBlockCount = 0; //已上传的块数
            this.__blobCount = 0; //当前已处理的片数
            this.__ctxList = []; //每块的Ctx列表
            this.__uploadUrl = 'http://upload.qiniu.com'; //当前的上传地址
            this.__uploadCtx = ""; //当前的上传ctx
            this.resume();
        }
    }
    directUpload() {
        var self = this;
        this.status = FileStatus.UPLOADING;
        this.info = "正在直接向服务器上传中。。。";
        this.__uploadType = "direct";

        var formData = new FormData();
        formData.append('key', this.md5);
        formData.append('token', this.token);
        formData.append('x:md5', this.md5);
        formData.append('file', this.file);
        formData.append('crc32', this.crc32);
        this.__xhr = $.ajax({
            url: "http://upload.qiniu.com/",
            xhr: function() {
                var xhr = $.ajaxSettings.xhr();
                xhr.upload.addEventListener('progress', showprogress, false);
                return xhr;
            },
            contentType: false,
            data: formData,
            processData: false,
            type: 'POST',
            success: function(data) {
                self.status = FileStatus.FINISHED;
                self.info = "上传成功！";
            },
            error: function(xhr, error, obj) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    self.status = FileStatus.ERROR;
                    self.info = "上传失败(" + data.code + ")：" + data.error;
                } catch (err) {
                    alert("上传意外中止。");
                }
            }
        });

        function showprogress(e) {
            if (!self.__lasttime) {
                self.__lasttime = new Date().getTime();
            }
            var now = new Date().getTime();
            var block = e.loaded - self.uploadedSize;
            var timeSpan = now - self.__lasttime;
            timeSpan = timeSpan == 0 ? 999999 : timeSpan; //预防除0
            self.speed = 1000 * block / timeSpan;
            self.__lasttime = now;
            self.uploadedSize = e.loaded;
        }
    }
    pause() {
        var self = this;
        if (this.__uploadType == "direct") {
            modal("现在为直接上传模式，这样做会取消上传。仍然继续么？", "取消上传？", {
                type: "okcancel",
                callback: function() {
                    self.__xhr.abort();
                    self.status = FileStatus.READY;
                    self.info = "用户取消上传。";
                }
            });
        } else {
            self.__xhr.abort();
            self.status = FileStatus.PAUSED;
            self.info = "已暂停";
        }
    }
    resume() {
        this.status = FileStatus.UPLOADING;
        this.info = "正在上传。。。";
        if (this.__uploadedBlockCount < this.__totalBlocks) {
            if (this.__blobCount != 0) {
                //上传下一片
                this.bput();
            } else {
                //上传新一块
                this.mkblk();
            }
        } else {
            //生成文件
            this.mkfile();
        }
    }
    mkblk() {
        var self = this;
        var thisBlobStart = this.__uploadedBlockCount * 4194304;
        var thisBlobEnd = ((thisBlobStart + 1048576) >= this.size) ? this.size : thisBlobStart + 1048576;
        if (this.__uploadedBlockCount + 1 >= this.__totalBlocks) {
            //最后一块
            var size = this.size - thisBlobStart;
        } else {
            var size = 4194304;
        }
        var lastBlob = (thisBlobEnd - thisBlobStart) < 1048576; //最后一片

        var url = this.__uploadUrl + "/mkblk/" + size;
        //Crc32计算
        this.__blockCrc32 = new Crc32();
        this.__blockfileReader = new FileReader();
        this.__blockfileReader.onload = function(e) {
            self.__blockCrc32.update(e.target.result);
        }
        //文件分割
        var fileBlob = this.file.slice(thisBlobStart, thisBlobEnd);
        this.__blockfileReader.readAsArrayBuffer(fileBlob);

        //传送本块数据
        this.__uds = 0;
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', showprogress, false);
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", "UpToken " + self.token);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    var data = JSON.parse(xhr.responseText);
                    self.__uploadCtx = data.ctx;
                    self.__uploadUrl = data.host;
                    self.uploadedSize = thisBlobEnd;
                    self.__blobCount++;
                    if (lastBlob) {
                        self.__blobCount = 0;
                        self.__ctxList.push(data.ctx);
                        self.__uploadedBlockCount++;
                    }
                    self.resume();
                } else {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        self.status = FileStatus.ERROR;
                        self.info = "上传失败(" + xhr.status + ")：" + data.error;
                    } catch (err) {
                        alert("上传暂停");
                        self.status = FileStatus.PAUSED;
                    }
                }
            }
        }
        xhr.send(fileBlob);
        this.__xhr = xhr;

        function showprogress(e) {
            if (!self.__lasttime) {
                self.__lasttime = new Date().getTime();
            }
            var now = new Date().getTime();
            var block = e.loaded - self.__uds;
            var timeSpan = now - self.__lasttime;
            timeSpan = timeSpan == 0 ? 999999 : timeSpan; //预防除0
            self.speed = 1000 * block / timeSpan;
            self.__lasttime = now;
            self.__uds = e.loaded;
            self.uploadedSize += block;
        }
    }
    bput() {
        var self = this;
        var thisBlobStart = this.__uploadedBlockCount * 4194304 + this.__blobCount * 1048576;
        var thisBlobEnd = ((thisBlobStart + 1048576) >= this.size) ? this.size : thisBlobStart + 1048576;
        var lastBlob = (thisBlobEnd - thisBlobStart) < 1048576; //最后一片

        var url = this.__uploadUrl + "/bput/" + this.__uploadCtx + "/" + this.__blobCount * 1048576;
        var fileBlob = this.file.slice(thisBlobStart, thisBlobEnd);
        this.__blockfileReader.readAsArrayBuffer(fileBlob);

        //传送本块数据
        this.__uds = 0;
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', showprogress, false);
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", "UpToken " + self.token);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    var data = JSON.parse(xhr.responseText);
                    self.__uploadCtx = data.ctx;
                    self.__uploadUrl = data.host;
                    self.uploadedSize = thisBlobEnd;
                    self.__blobCount++;
                    if (self.__blobCount >= 4 || lastBlob) {
                        self.__blobCount = 0;
                        self.__ctxList.push(data.ctx);
                        self.__uploadedBlockCount++;
                    }
                    self.resume();
                } else {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        self.status = FileStatus.ERROR;
                        self.info = "上传失败(" + xhr.status + ")：" + data.error;
                    } catch (err) {
                        alert("上传暂停");
                        self.status = FileStatus.PAUSED;
                    }
                }
            }
        }
        xhr.send(fileBlob);
        this.__xhr = xhr;

        function showprogress(e) {
            if (!self.__lasttime) {
                self.__lasttime = new Date().getTime();
            }
            var now = new Date().getTime();
            var block = e.loaded - self.__uds;
            var timeSpan = now - self.__lasttime;
            timeSpan = timeSpan == 0 ? 999999 : timeSpan; //预防除0
            self.speed = 1000 * block / timeSpan;
            self.__lasttime = now;
            self.__uds = e.loaded;
            self.uploadedSize += block;
        }
    }
    mkfile() {
        this.info = "正在检查上传文件。";
        var self = this;

        var url = this.__uploadUrl + "/mkfile/" + this.size + "/key/" + base64Encode(this.md5) + "/x:md5/" + base64Encode(this.md5);
        var ctxList = this.__ctxList.join(",");

        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", "UpToken " + this.token);
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    self.status = FileStatus.FINISHED;
                    self.info = "上传成功！";
                } else {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        self.status = FileStatus.ERROR;
                        self.info = "上传失败(" + xhr.status + ")：" + data.error;
                    } catch (err) {
                        alert(err);
                    }
                }
            }
        }
        xhr.send(ctxList);
        this.__xhr = xhr;
    }
}
const FileStatus = {
    PROCESSING: "正在处理",
    READY: "开始上传",
    WAITING: "等待中",
    UPLOADING: "正在上传",
    PAUSED: "已暂停",
    FINISHED: "上传完成",
    ERROR: "错误"
}

class FileProvider {
    constructor() {
        this.filelist = [];
        this.idgen = idGenerator();
    }
    //添加文件
    processFiles(files) {
        for (let i = 0; i < files.length; i++) {
            let file = new File(this.idgen.next().value, files[i]);
            this.filelist.push(file);
        }
    }
    //删除文件
    deleteFile(ids) {
        for (var ididx in ids) {
            var id = ids[ididx];
            for (var i = 0; i < this.filelist.length; i++) {
                if (this.filelist[i].id == id) {
                    this.filelist.splice(i, 1);
                    break;
                }
            }
        }
    }
    //全选/全不选
    selectAll(value) {
        for (var i in this.filelist) {
            this.filelist[i].checked = value;
        }
    }
    //获得已选id列表
    getSelected() {
        var res = [];
        for (var i in this.filelist) {
            if (this.filelist[i].checked) {
                res.push(this.filelist[i].id);
            }
        }
        return res;
    }
    //开始上传
    start(ids) {
        for (var ididx in ids) {
            var id = ids[ididx];
            for (var i = 0; i < this.filelist.length; i++) {
                if (this.filelist[i].id == id) {
                    this.filelist[i].main();
                    break;
                }
            }
        }
    }
}