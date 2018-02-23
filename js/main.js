
// data
var data = {
    list: [],
    zip_url: "",
    zip_checkedId: []
};

/*
list item
{
    id:,
    name: file.name,
    originalSize: file.size,
    nowSize: "",
    blob: null,
    done: false,
    checked: true,
    url: "",
    fromZip: file.fromZip,
    error: 0
}
*/

// vue app
var app = new Vue({
    el: "#app",
    data: data,
    created: function() {
        var me = this;
        // 定义worker
        var worker = this.worker = new Worker("js/worker-optimize.js");
        // worker onmessage事件
        worker.onmessage = function(ev) {
            var data = ev.data;
            switch(data.msg) {
                // 上传文件完成
                case "upload" :
                    me.list.push(data.file);
                    break;
                // 上传文件优化完成
                case "optimizeComplete": 
                    me.updateItem(data.file.id, data.file);
                    break;
                // 文件打包压缩完成
                case "compressComplete":
                    // 缓存blob url
                    me.zip_url = createUrl(data.file);
                    save(me.zip_url, "images.zip");
                    break;
            }
        }
    },
    methods: {
        // 上传区域 - 拖放文件
        dropzone_drop: function(ev) {
            var files = ev.dataTransfer.files;
            this.optimize(files);
        },
        // 上传区域 - 点击，触发input:file的点击事件
        dropzone_click: function() {
            this.$refs['inp_file'].dispatchEvent(new MouseEvent("click"));
        },
        // input:file onchange
        dropzone_fileChange: function(ev) {
            var files = ev.target.files;
            this.optimize(files);
        },
        // 文件列表 -复选框
        file_checked: function(item) {
            if(item.done) {
                item.checked = !item.checked
            }
        },
        // 文件列表 -下载
        file_download: function(item) {
            if(!item.url) {
                item.url = createUrl(new Blob([new Uint8Array(item.buffer)], {type: "image/png"}), item.name);
            }
            save(item.url, item.name);
        },
        // 文件列表 -预览
        file_preview: function(item) {
            if(!item.url) {
                item.url = createUrl(new Blob([new Uint8Array(item.buffer)], {type: "image/png"}), item.name);
            }
            previewpopup.show(item.url);
        },
        // 文件列表 -移除
        file_remove: function(index) {
            window.URL.revokeObjectURL(this.list[index].url);
            this.list.splice(index, 1)
        },
        // 打包下载所有文件
        file_downloadall: function() {
            // 如果未选中文件
            if(!this.checkedFiles.length) {
                alert("no file selected")
            }
            // 如果选中文件未改变
            else if(this.isCheckedFilesKeeped && this.zip_url) {
                save(this.zip_url, "images.zip");
                console.log("cache:", this.zip_url)
            }
            // 如果选中文件发生了变化
            else {
                if(this.zip_url) window.URL.revokeObjectURL(this.zip_url);
                this.worker.postMessage({
                    msg: "compress",
                    files: this.checkedFiles
                });
                // 缓存当前选中id
                this.zip_checkedId = this.checkedFilesId.concat([]);
            }
        },
        // 移除所有文件
        file_removeall: function() {
            if(this.zip_url) {
                window.URL.revokeObjectURL(this.zip_url);
                this.zip_url = "";
            }
            var tmp;
            while(this.list.length) {
                tmp = this.list.pop();
                window.URL.revokeObjectURL(tmp.url);
            }
        },
        // 优化图片，向worker发送message
        optimize: function (files) {
            this.worker.postMessage({
                msg: "optimize",
                files: files
            });
        },
        // file size 格式化
        fileSizeFormat: function(size) {
            return !size ? "" : (size > 1024 * 1024) ? ((size / 1024 * 1024).toFixed(1) + "MB") : (size > 1024) ? ((size / 1024).toFixed(1) + "KB") : ((size / 1024).toFixed(2) + "KB")
        },
        // getItem by id
        getItem: function (id) {
            var tmp = this.list.find(function(item){
                return id == item.id
            });
            return tmp;
        },
        // updateItem
        updateItem: function (id, obj) {
            var item = this.getItem(id);
            for(var key in obj) {
                item[key] = obj[key];
            }
        }
    },
    computed: {
        // 完成的文件
        completeFiles: function() {
            return this.list.filter(function(item){
                return item.done
            })
        },
        // 选中的文件
        checkedFiles: function() {
            return this.list.filter(function(item){
                return item.checked && item.done
            });
        },
        // 选中的文件的id
        checkedFilesId: function() {
            return this.checkedFiles.map(function(item){
                return item.id
            });
        },
        // 选中文件是否发生变化
        isCheckedFilesKeeped: function() {
            var checkedId = this.checkedFilesId;
            if(checkedId.length != this.zip_checkedId.length) return false;
            for(var i=0;i<checkedId.length;i++) {
                if(this.zip_checkedId.indexOf(checkedId[i])<0) return false
            }
            return true;
        }
    }
});

// createUrl
function createUrl(buff) {
    return window.URL.createObjectURL(buff);
}

// save
// 文件保存
function save(url, filename) {
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// previewpopup
var previewpopup = (function(){
    var body = document.body;
    var img = new Image();
    var box = document.createElement("div");
    box.className = "popup-preview";
    box.appendChild(img);
    var popup = {
            show: function(src) {
                img.src = src;
                body.appendChild(box);
            },
            hide: function() {
                body.removeChild(box)
            }
        };
    box.addEventListener("click", popup.hide);
    return popup;
})();
