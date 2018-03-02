var window = this;

importScripts("pako.min.js", "UPNG.js", "jszip.min.js");

var onmessage = function(ev) {
    var data = ev.data;
    if(data.msg == "optimize") {
        // filesOptimize(data.files);
        filesOperate(data.files);
    }
    else if(data.msg == "compress") {
        zipCompress(data.files);
    }
}

/*
error code
0: success
1: unsupported file type
2: new file is bigger than before
3: other

*/


var Myfile = function(file){
    this.id = file.name + "_" + createid(8);
    this.name = file.name;
    this.type = file.type;
    this.file = file;
    this.originalSize = file.size;
    this.size = file.size;
    this.fromZip = file.fromZip;
    this.fromZipID = file.fromZipID;
    this.buffer = file.buffer;
    this.url = "";
    this.done = false;
    this.checked = false;
    this.error = 0;
}
function createid(length) {
    length = (isNaN(length) || length < 4) ? 8 : length;
    var table = "0123456789abcdefghijklmnopqrstuvwxyz",
        table_len = table.length;
    return Array(+length).fill().map(function(){
            return table[Math.round(Math.random() * table_len)]
        }).join("");
}



/**
* filesOperate
* @param {array} files - files list
*/
function filesOperate(files) {
    Array.from(files).forEach(function(file){
        // is zip file
        if(file.type == "application/x-zip-compressed") {
            opt_zipfile(file);
        }
        // is png file
        else if(file.type == "image/png") {
            opt_pngfile(file);
        }
    });
}

/**
* opt_zipfile
*/
function opt_zipfile(file) {
    readfile(file)
    .then(function(readedFile){
        if(file.type!="application/x-zip-compressed") {
            file.type = "unsupported";
            file.error = 1;
            file.file = null;
            return Promise.reject(file)
        }
        else {
            return unzip(file)
        }
    })
    .then(
        function(files){
          files = files.filter(function(file){
                return file.type != "unsupported";
            }).map(function(file){
                var f = new Myfile(file);
                f.file = null;
                if(file.type!="application/x-zip-compressed"){
                    postMessage({
                        msg: "unzipComplete",
                        file: f
                    })
                }
                return f;
              });
            
            filesOperate(files);
          },
      function(arg2){
        console.log(arg2)
      }
    );
}

/**
* opt_pngfile
*/
function opt_pngfile(file) {
    readfile(file).then(function(readedFile){
        if(readedFile.type!="image/png") {
            file.type = "unsupported";
            file.error = 1;
            file.file = null;
        }
        else {
            file.buffer = upngopt(readedFile.buffer);
            file.size = file.buffer.byteLength;
            file.done = true;
            file.file = null;
            (file.size >= file.originalSize) ? (file.error = 2) : (file.checked = true);
        }
        postMessage({
            msg: "optimizeComplete",
            file: file
        })
    });
}


/**
* readfile
* @param {file} file
* @return {promise}
*/
function readfile(file) {
    if(file.buffer) {
        return Promise.resolve(file);
    }
    else {
        return new Promise(function(resolve, reject){
            var reader = new FileReader();
            reader.addEventListener("load", function(ev){
                file.buffer = this.result;
                file.type = filetype(file.buffer);
                resolve(file);
            });
            reader.readAsArrayBuffer(file.file)
        }); 
    }
}

/**
* filetype - get file type by file head
* @param {arraybuffer} buffer
* @return {string} file type
*/
function filetype(buffer) {
    var h = Array.from(new Uint8Array(buffer.slice(0,4)))
        .map(function(num){
            return ("00" + num.toString(16)).substr(-2);
        }).join("").toLowerCase();
    if(h == "89504e47") return "image/png";
    else if(h == "504b0304") return "application/x-zip-compressed";
    else return "unsupported";
}

/**
* upngopt - optimize png by upng-js
* @return {arraybuffer} optimized png
*/
function upngopt(arraybuffer) {
    var img = UPNG.decode(arraybuffer);
    var rgba = UPNG.toRGBA8(img);
    var opt_arraybuffer = UPNG.encode(
            rgba, img.width, img.height, 256,
            img.frames.map(function(frame){
                return frame.delay
            })
        );
    return opt_arraybuffer;
}

/**
* unzip
* @return {promise}
*/
function unzip(file) {
    return JSZip.loadAsync(file.buffer)
        .then(function(zip){
            var zipobjlist = [];
            zip.forEach(function(name, zipobj){
                if(zipobj.dir || !/(\.png|\.zip)$/.test(zipobj.name)) return;
                var pms = zipobj.async("arraybuffer")
                    .then(function(arraybuffer){
                        var type = filetype(arraybuffer);
                        var tempfile = {
                            name: zipobj.name.replace(/.*\//g, ""),
                            fromZip: file.fromZip || file.name,
                            fromZipID: file.fromZipID || file.id,
                            buffer: arraybuffer,
                            type: type,
                            size: zipobj._data.uncompressedSize
                        }
                        return Promise.resolve(tempfile)
                    });
                zipobjlist.push(pms);
            });
            return Promise.all(zipobjlist);
        })
}


// zipCompress
function zipCompress(filelist) {
    console.log(filelist)
    var zip = new JSZip();
    filelist.forEach(function(file){
        zip.file(file.name, file.buffer)
    });
    zip.generateAsync({type:"blob"})
        .then(function(blob){
            console.log(blob)
            postMessage({
                msg: "compressComplete",
                file: blob
            });
        });
}
