const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const httpProxy = require("http-proxy");
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

const socketIO = require("socket.io");
const http = require("http");
const { Socket } = require("socket.io-client");
const ACTION = require("./Action");
const server = http.createServer(app);

// ... Your server routes and logic ...

// Load SSL certificate files
const privateKey = fs.readFileSync("./private.key", "utf8");
const certificate = fs.readFileSync("./certificate.crt", "utf8");
// const caBundle = fs.readFileSync("/path/to/ca_bundle.crt", "utf8"); // (if applicable)

const credentials = {
  key: privateKey,
  cert: certificate,
  // ca: caBundle, // (if applicable)
};

const io = socketIO(server);
server.prependListener("request", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
});
const userSocketMap = {};

function getAllClients(roomID) {
  console.log(io.sockets.adapter.rooms.get(roomID));
  return Array.from(io.sockets.adapter.rooms.get(roomID) || []).map(
    (socketId) => {
      return {
        socketId,
        userName: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("socket Connected", socket.id); // Socket Id
  socket.on(ACTION.JOIN, ({ roomID, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomID);
    const clients = getAllClients(roomID);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTION.JOINED, {
        clients,
        userName,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTION.CODE_CHANGE, ({ roomID, code }) => {
    socket.in(roomID).emit(ACTION.CODE_CHANGE, { code });
  });

  socket.on(ACTION.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTION.CODE_CHANGE, { code });
  });

  socket.on(ACTION.DISCONNETING, () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomID) => {
      socket.in(roomID).emit(ACTION.DISCONNECTED, {
        socketId: socket.id,
        userName: userSocketMap[socket.id],
      });
    });
  });

  delete userSocketMap[socket.id];
  socket.leave();
});

app.get("*", (req, res) => {
  res.send("Server is running...");
  console.log(req.hostname + ":" + req.method + req.url);
});

const PORT = process.env.PORT || 2100;
server.listen(PORT, () => console.log(`Listensing on port ${PORT}`));

module.exports = app;
