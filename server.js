const app = require("express")();
const cors = require("cors");

app.use(cors());

const server = require("http").Server(app);
const io = require("socket.io")(server);

server.listen(process.env.PORT || 8888);
let number_of_connections = 0;
let joined_connections = new Map();

app.get("/", function (req, res) {
    res.send(
        '<h1 style="text-align: center;">Rex-Signalling-Server is running on port 8888.</h1>'
    );
});

io.on("connection", function (socket) {
    console.log("Peer connected " + socket.id);

    socket.on("message", function (message) {
        // console.log("Message sent by: " + socket.id);
        let data;

        //accepting only JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON by: " + socket.id);
            onError(socket, message, "Invalid JSON");
            data = { type: "" };
        }

        switch (data.type) {
            case "join":
                onJoin(socket, data);
                break;
            case "offer":
                onoffer(socket, data);
                break;
            case "answer":
                onanswer(socket, data);
                break;
            case "icecandidate":
                onicecandidate(socket, data);
                break;
            case "leave":
                onleaveRoom(socket, data);
                break;
            default:
                console.log("Invlalid message type by: " + socket.id);
                onError(socket, data, "Message type not found");
        }
    });

    function onError(socket, data, cause) {
        socket.emit("message", {
            type: "error",
            data: { msg: cause, error: data },
        });
    }

    function onJoin(socket, data) {
        console.log("joinRoom request sent by: " + socket.id);

        number_of_connections++;

        let connected_peer_list = [];

        let peerObj = {
            id: socket.id,
            name: data.peer.name,
        };
        // Notify others about the new peer join
        logged_connections.forEach((id, data) => {
            data.conn.emit("message", {
                type: "peer-joined",
                data: {
                    msg: "new peer joined",
                    peer: peerObj,
                },
            });
        });

        // Notify the success
        socket.emit("message", {
            type: "peer-joined-success",
            data: {
                msg: "joined",
                peer: peerObj,
            },
        });

        // Send list of connected peers
        logged_connections.forEach((id, data) => {
            connected_peer_list.push(data.peer);
        });

        socket.emit("message", {
            type: "peer-list",
            data: {
                msg: "connecte4d peer list",
                peerList: connected_peer_list,
            },
        });
        logged_connections.set(socket.id, {
            peer: peerObj,
            conn: socket,
        });
    }

    function onoffer(socket, data) {
        let conn = logged_connections[data.offer.userid];
        if (conn != null) {
            console.log("Sending offer to: " + data.offer.userid);
            socket.otherName = data.offer.userid;
            conn.emit("message", {
                type: "offer",
                offer: data.offer,
                msg: { user_id: data.offer.userid },
            });
        }
    }

    function onanswer(socket, data) {
        let conn = logged_connections[data.answer.userid];
        if (conn != null) {
            console.log("Sending answer to: " + data.answer.userid);
            socket.otherName = data.answer.userid;
            conn.emit("message", {
                type: "answer",
                answer: data.answer,
                msg: { user_id: data.answer.userid },
            });
        }
    }

    function onicecandidate(socket, data) {
        let conn = logged_connections[socket.otherName];
        if (conn != null) {
            console.log("Sending candidates to: " + socket.otherName);
            conn.emit("message", {
                type: "icecandidate",
                candidate: data.candidate,
            });
        }
    }

    function onleaveRoom(socket, data) {
        console.log("leaveRoom request sent by: " + data.msg.user_id);
        if (logged_connections[data.msg.user_id] != null) {
            delete logged_connections[data.msg.user_id];
            logged_connections.count--;
        }
        socket.emit("message", {
            type: "leaveRoom",
            status: "disconnected",
            msg: "User successfully leaved",
        });
        if (logged_connections[socket.otherName] != null)
            logged_connections[socket.otherName].emit("message", {
                type: "peer-left",
                status: "disconnected",
                msg: { user_id: socket.otherName },
            });
    }
});
