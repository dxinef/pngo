var window = this;

importScripts("pako.min.js", "UPNG.js", "jszip.min.js");

var onmessage = function(ev) {
    var data = ev.data;
    if(data.msg == "optimize") {
        filesOptimize(data.files);
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

// filesOptimize
function filesOptimize(files) {
    Array.from(files).forEach(function(file){
        if(file.type == "image/png") {
            var img = {
                id: (new Date().getTime() + Math.random()).toString(),
                name: file.name,
                originalSize: file.size,
                nowSize: "",
                buffer: null,
                url: "",
                fromZip: file.fromZip,
                done: false,
                checked: false,
                error: 0
            }
            postMessage({
                msg: "upload",
                file: img
            });

            pngOptimize(file).then(function(arg){
                var err = arg.buffer.byteLength > img.originalSize ? 2 : 0;
                postMessage({
                    msg: "optimizeComplete",
                    file: {
                            id: img.id,
                            nowSize: arg.buffer.byteLength,
                            buffer: arg.buffer,
                            done: true,
                            checked: err ? false : true,
                            error: err
                        }
                });
            });
        }
        else if(file.type == "application/x-zip-compressed") {
            if(file.fromZip) {
                var fromZip = file.fromZip;
                file = new Blob([new Uint8Array(file.buffer)], {type: "application/x-zip-compressed"});
                file.name = fromZip;
            }

            unzip(file).then(function(files){
                filesOptimize(files)
            })
        }
        else {
            var img = {
                id: (new Date().getTime() + Math.random()).toString(),
                name: file.name,
                originalSize: file.size,
                nowSize: "",
                buffer: null,
                done: false,
                checked: false,
                url: "",
                fromZip: undefined,
                error: 1
            }
            postMessage({
                msg: "upload",
                file: img
            });
        }
    });
}


// pngOptimize
// 图片文件优化，返回一个promise
function pngOptimize(file) {
    if(file.fromZip) {
        return Promise.resolve({buffer: upngopt(file.buffer), file: file})
    }
    else {
        return new Promise(function(resolve, reject){
            var reader = new FileReader();
            reader.addEventListener("load", function(ev){
                var buffer = upngopt(this.result)
                resolve({buffer: buffer, file: file});
            });
            reader.readAsArrayBuffer(file)
        }); 
    }
}

// upngopt
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

// unzip
function unzip(file) {
    return JSZip.loadAsync(file)
        .then(function(zip){
            var zipobjlist = [];
            zip.forEach(function(name, zipobj){
                if(zipobj.dir || !/(\.png|\.zip)$/.test(zipobj.name)) return;
                var pms = zipobj.async("arraybuffer")
                    .then(function(arraybuffer){
                        var f_header = fileheader(arraybuffer);
                        var type = f_header == "89504e47" ? "image/png" : f_header == "504b0304" ? "application/x-zip-compressed" : "";
                        var tempfile = {
                            name: zipobj.name.replace(/.*\//g, ""),
                            fromZip: file.name,
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
    var zip = new JSZip();
    filelist.forEach(function(file){
        zip.file(file.name, file.blob)
    });
    zip.generateAsync({type:"blob"})
        .then(function(blob){
            postMessage({
                msg: "compressComplete",
                file: blob
            });
        });
}

// fileheader
function fileheader(buffer) {
    return Array.from(new Uint8Array(buffer).slice(0,4))
        .map(function(num){
            return ("00" + num.toString(16)).substr(-2);
        }).join("").toLowerCase();
}