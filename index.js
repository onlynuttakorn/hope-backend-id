require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { loginAndGetSessionId, sender } = require("./zk-ws");

const app = express();
const server = http.createServer(app);
sender();
loginAndGetSessionId();

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
