var Docker = require('dockerode');
var util = require('util');
var events = require('events');

function dockershell (opts, id){
    if(!(this instanceof dockershell)) return new dockershell(opts, id);
    events.EventEmitter.call(this)
    var self = this;
    self.docker = new Docker(opts);
    self.container = this.docker.getContainer(id);
    self.container.inspect(function(err, data) {
        if(!data || !data.State.Running)
            throw new Error("Container: " + id + "is not running.");
    });
    self.shells = {};
    self.on('create', function(id, tty){
        self.shells[id] = tty;
        var startOpts = {
            "Detach": false,
            "Tty": true,
            "stdin": true,
            "Interactive": true,
        };
        tty.start(startOpts, function(err, stream){
            if (err) throw err;
            stream.on("data", function(data){
                self.emit("data", id, data);
            });
            stream.on("end", function(){
                self.emit("exit", id);
                self.shells[id] = undefined;
            });
            self.shells[id].stream = stream;

        })
    });
}

util.inherits(dockershell, events.EventEmitter);

dockershell.prototype.list = function() {
    return Object.keys(this.shells);
}

dockershell.prototype.createShell = function(id, opts) {
    var execOpts = {
        "AttachStdin": true,
        "AttachStdout": true,
        "AttachStderr": true,
        "Interactive": true,
        "Tty": true,
        "OpenStdin" : true,
        "User" : "root",
        "Cmd": [
            "sh",
            "-i",
            "-l",
            "-c",
            "su " + opts.user
        ]
    }
    var self = this;
    return this.container.exec(execOpts, function (err, ttyExec) {
        if(err) throw err;
        self.emit("create", id, ttyExec);
        return ttyExec;
    });
}

dockershell.prototype.destroy = function(id) {
    if(this.shells[id] && this.shells[id].stream)
        this.shells[id].stream.end("\rexit\r");
} 

module.exports = dockershell;

