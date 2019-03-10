// this is based on the "videoroomtest" Janus demo
let janus = null;
let sfutest = null;
let remoteFeed = null;
let myroom = null;
let server = null;
if(window.location.protocol === 'http:')
	server = "http://" + window.location.hostname + ":8088/janus";
else
	server = "https://" + window.location.hostname + ":8089/janus";

$(document).ready(function() {
    Janus.init({debug: "all", callback: function() {
        if (!Janus.isWebrtcSupported()) {
            alert("No WebRTC support???");
            return;
        }

        if (window.location.hash) {
            try {
                let joinroom = parseInt(window.location.hash.substr(1));
                myroom = joinroom;
                init_subscriber(joinroom);
            } catch(err) {
                console.log(err);
                init_publisher();
            };
        } else {
            init_publisher();
        }
    }});
});

function init_subscriber(joinroom) {
    $('#subscriber').show();

    janus = new Janus({
        server: server,
        success: function() {
            start_subscribing(joinroom);
        },
        error: function(error) {
            alert(error);
            window.location.reload();
        },
        destroyed: function() {
            window.location.reload();
        },
    });
}

function init_publisher() {
    $('#publisher').show();

    $('#start').one('click', function() {
        $(this).attr('disabled', true).unbind('click');

        janus = new Janus({
            server: server,
            success: function() {
                start_publishing();
            },
            error: function(error) {
                alert(error);
                window.location.reload();
            },
            destroyed: function() {
                window.location.reload();
            },
        });
    });
}

function start_subscribing(joinroom) {
    janus.attach({
        plugin: "janus.plugin.videoroom",
        success: function(pluginHandle) {
            remoteFeed = pluginHandle;
            console.log("JOIN " + joinroom);
            remoteFeed.send({
                message: {request:"listparticipants","room":joinroom},
                success: function(msg) {
                    if (msg["videoroom"] == "participants" && msg["participants"].length > 0) {
                        remoteFeed.send({message:{"request":"join","room":joinroom,"ptype":"subscriber","feed":msg["participants"][0].id}});
                    } else {
                        // reload in 5 seconds
                        // TODO: something better?
                        window.setTimeout(function() { window.location.reload(); }, 5000);
                    }
                },
            });
        },
        error: function(error) {
            alert(error);
        },
        onmessage: function(msg, jsep) {
            if (msg["videoroom"] !== undefined && msg["videoroom"] !== null)
                subscriber_handle_msg(msg);
            if (jsep !== undefined && jsep !== null)
                subscriber_handle_jsep(jsep);
        },
        webrtcState: function(on) {
            console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        },
        onlocalstream: function(stream) {
            // do nothing
        },
        onremotestream: function(stream) {
            subscriber_handle_remotestream(stream);
        },
        oncleanup: function() {
            // do what now?
            window.location.reload();
        },
    });
}

function start_publishing() {
    janus.attach({
        plugin: "janus.plugin.videoroom",
        success: function(pluginHandle) {
            sfutest = pluginHandle;
            sfutest.send({
                message: {"request":"create","permanent":false,"secret":Janus.randomString(12),"is_private":true,"bitrate":128000},
                success: function(msg) {
                    myroom = msg["room"];
                    $('#streamurl').text(window.location.origin + window.location.pathname + '#' + myroom);
                    sfutest.send({
                        message: {"request":"join","room":myroom,"ptype":"publisher"},
                    });
                },
            });
        },
        error: function(error) {
            alert(error);
        },
        consentDialog: function(on) {
            // TODO: do we need to do anything here? This function gets called to tell
            // us whether the video/audio consent dialog is currently up
        },
        mediaState: function(medium, on) {
            console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
        },
        webrtcState: function(on) {
            console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        },
        onmessage: function(msg, jsep) {
            if (msg["videoroom"] !== undefined && msg["videoroom"] !== null)
                publisher_handle_msg(msg);
            if (jsep !== undefined && jsep !== null)
                publisher_handle_jsep(jsep);
        },
        onlocalstream: function(stream) {
            publisher_handle_localstream(stream);
        },
        onremotestream: function(stream) {
            // do nothing
        },
        oncleanup: function() {
            // do what now?
            window.location.reload();
        },
    });
}

function publisher_handle_msg(msg) {
    // TODO: this
    console.log("msg:");
    console.log(msg);

    if (msg["videoroom"] == "joined") {
        publishOwnFeed();
    }
}

function publisher_handle_jsep(jsep) {
    // TODO: this
    console.log("jsep:");
    console.log(jsep);

    sfutest.handleRemoteJsep({jsep: jsep});
}

function publisher_handle_localstream(stream) {
    console.log(stream);
    Janus.attachMediaStream($('#myvideo').get(0), stream);
    document.getElementById('myvideo').srcObject = stream;
    console.log("ATTACH MEDIA STREAM");
}

function publishOwnFeed() {
    sfutest.createOffer({
        media: { audioRecv: false, videoRecv: false, audioSend: true, videoSend: true },
        simulcast: false, // TODO: Should this be an option? Or always true?
        success: function(jsep) {
            sfutest.send({
                message: {"request":"configure", "audio":true, "video":true},
                jsep: jsep,
            });
        },
        error: function(error) {
            alert("WebRTC error: " + JSON.stringify(error));
        },
    });
}

function subscriber_handle_msg(msg) {
    // TODO: this
    console.log("msg:");
    console.log(msg);
}

function subscriber_handle_jsep(jsep) {
    // TODO: this
    console.log("jsep:");
    console.log(jsep);

    remoteFeed.createAnswer({
        jsep: jsep,
        media: {audioSend:false, videoSend:false},
        success: function(jsep) {
            remoteFeed.send({"message":{"request":"start","room":myroom}, "jsep":jsep});
        },
        error: function(error) {
            alert(error);
        },
    });
}

function subscriber_handle_remotestream(stream) {
    console.log("Attaching media stream!!");
    Janus.attachMediaStream($('#remotestream').get(0), stream);
}
