"use strict"
//初始化全局变量
const VERSION = "1.0.1";
const fileProvider = new FileProvider();
const config = new Config();
//主函数
$(function() {
    //init
    window.modal = modal;
    $.material.init();
    //初始化Vue过滤器
    Vue.filter('sizeformat', function(value) {
        return formatSize(value);
    });
    Vue.filter('filestatusclass', function(value) {
        return fileStatusClass(value);
    });
    Vue.filter('progressbarclass', function(value) {
        return progressBarStatusClass(value);
    });
    Vue.filter('percentformat', function(value, total) {
        return percentFormat(value, total);
    });
    //绑定Vue模板
    new Vue({
        el: "#musiclist",
        data: {
            filelist: fileProvider.filelist
        }
    });
    //快捷键绑定
    $(document).on("keydown", function(event) {
        var keyid = event.which;
        //F2：显示用户设置框。
        if (keyid == 113) {
            config.init();
        }
        //F10: 打开关于页面
        if (keyid == 121) {
            showAbout();
        }
    });
    //添加文件按钮
    $("#file-selector").click(function() {
        $("#file-input").click();
    });
    $("#file-input").on("change", function() {
        fileProvider.processFiles($("#file-input")[0].files);
        $("#file-input").val("");
    })
    //处理文件拖进窗口
    $(window).on('dragover', function(event) {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = 'copy';
    });
    $(window).on('drop', function(event) {
        event.preventDefault();
        fileProvider.processFiles(event.originalEvent.dataTransfer.files);
    });
    //单条删除
    $(document).on("click", ".p-deletetext", function(event) {
        var id = $(this).data("id");
        deleteFile([id]);
    });
    //全选
    $(document).on("change", "#select-all", function(event) {
        fileProvider.selectAll(this.checked);
    });
    //删除选中
    $("#delete-selected").click(function() {
        deleteFile(fileProvider.getSelected());
    });
    //单条开始
    $(document).on("click", ".p-startbutton", function(event) {
        var id = $(this).data("id");
        clickStart([id]);
    });
    //全部开始
    $("#upload-selected").click(function() {
        clickStart(fileProvider.getSelected());
    });
    //批量更新信息
    $("#info-selected").click(function() {
        multiinfo(fileProvider.getSelected());
    });
    //读取设置文件
    window.biu_config = config;
    config.load();
});

//删除前弹出确认 - 完成删除动作
function deleteFile(ids) {
    if (ids.length <= 0) {
        modal("请选择需要取消上传的文件。", "删除失败");
    } else {
        modal("是否确认取消上传这 " + ids.length + "个文件。", "确认取消上传", {
            type: "okcancel",
            callback: function() {
                fileProvider.deleteFile(ids);
            }
        });
    }
}

//开始上传
function clickStart(ids) {
    if (ids.length <= 0) {
        modal("请选择需要上传的文件。", "开始上传");
    } else {
        fileProvider.start(ids);
    }
}

//显示关于
function showAbout() {
    var mainContent = $("<div>").append($("<p>Biu~Uploader v" + VERSION + "</p>"));
    mainContent.append($("<hr>"));

    modal(mainContent, "关于");
}

//批量添加信息
function multiinfo(ids){
    if (ids.length <= 0) {
        modal("请选中需要更新信息的文件。", "批量更新信息");
    } else {
        var innerTpl = $("#xtpl-mi").html();
        modal(innerTpl, "批量更新信息", {
            type: "okcancel",
            oncreated: function(){
                new Vue({
                    el: "#mi-dis",
                    data: fileProvider.infodata
                });
            },
            callback: function(){
                fileProvider.setInfo(ids);
            }
        });
    }
}