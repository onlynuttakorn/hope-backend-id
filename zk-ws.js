const WebSocket = require("ws");
const axios = require("axios");
const FormData = require("form-data");

const API_URL = process.env.API_URL;
const USER_ADMIN = process.env.USER_ADMIN;
const USER_PASSWORD = process.env.USER_PASSWORD;

let sessionId = "";
let headerCookie = null;
let csrfToken = null;
let transaction = { list: [] };
const connections = [];
let serverVuejs = new WebSocket.Server({ port: 3001 });
serverVuejs.on("connection", (so) => {
  console.log("serverVuejs connection");
  connections.push(so);
});
const formUrlEncoded = (x) =>
  Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, "");
async function fetchData() {
  try {
    const response = await axios.get(`${API_URL}/login/`);
    const { headers, data } = response;

    const cookies = headers["set-cookie"];
    headerCookie = cookies.join("; ");
    const csrfTokenMatch = data.match(
      /<input[^>]*name=["']csrfmiddlewaretoken["'][^>]*value=["'](.*?)["']/
    );

    if (csrfTokenMatch && csrfTokenMatch[1]) {
      csrfToken = csrfTokenMatch[1];
    } else {
      console.error("ไม่พบค่า csrfmiddlewaretoken ใน HTML");
      throw "error";
    }
    return true;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการเรียก API:", error);
    throw "error";
  }
}

async function loginAndGetSessionId() {
  try {
    await fetchData();
  } catch (err) {
    console.log("ระบบทำการ เริ่มใหม่");
    await new Promise((r) => setTimeout(r, 10000));
    return loginAndGetSessionId();
  }
  try {
    const response = await axios.post(
      `${API_URL}/login/`,
      formUrlEncoded({
        username: USER_ADMIN,
        password: USER_PASSWORD,
        captcha: "",
        template10: "",
        login_type: "pwd",
      }),
      {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: headerCookie,
        },
      }
    );

    const sessionCookie = response.headers["set-cookie"];
    if (sessionCookie) {
      for (const cookie of sessionCookie) {
        if (cookie.includes("sessionid")) {
          const parts = cookie.split(";");
          for (const part of parts) {
            const [key, value] = part.trim().split("=");
            if (key === "sessionid") {
              sessionId = value;
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการ login:", error.message);
    await new Promise((r) => setTimeout(r, 5000));
    loginAndGetSessionId();
    throw error;
  }
  createWebSocketConnection();
}
let score = 0;
function createWebSocketConnection() {
  const ws = new WebSocket(
    `ws:${process.env.API_URL}/base/dashboard/realtime_punch/`,
    {
      headers: {
        Cookie: `sessionid=${sessionId}`,
      },
    }
  );

  ws.on("open", () => {
    ws.send(`{"bp":${score}}`);
    setInterval(() => {
      ws.send(`{"bp":${score}}`);
    }, 2000);
  });

  ws.on("message", (data) => {
    data = JSON.parse(data);
    let list = data.data;
    if (score == 0) {
      if (list.length > 6) {
        list = list.slice(0, 6);
      }
      transaction.list = list;
    } else {
      if (list.length > 0) {
        transaction.list.unshift(list[0]);
        if (transaction.list.length > 6) {
          transaction.list.pop();
        }
      }
    }
    score = data.score;
    for (const ws of connections) {
      ws.send(JSON.stringify(transaction.list));
    }
    // serverVuejs.send(transaction.list);
  });

  ws.on("close", () => {
    console.log("WebSocket ถูกปิด");
  });

  ws.on("error", async (error) => {
    console.error("เกิดข้อผิดพลาดใน WebSocket:", error);
    return await loginAndGetSessionId();
  });
}
async function loginApi() {
  try {
    const response = await axios.post(`${API_URL}/jwt-api-token-auth/`, {
      username: "adminapi",
      password: "adminapi123",
    });
    if (response.data && response.data.token) {
      console.log(response.data);
      return response.data.token;
    }
    return false;
  } catch (err) {
    console.log("loginApi", err.message);
    return false;
  }
}

async function getListUser(token) {
  try {
    const response = await axios.get(`${API_URL}/personnel/api/employees/`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${token}`,
      },
    });
    console.log(response);
    return false;
  } catch (err) {
    console.log("getListUser", err.message);
    return false;
  }
}

function sender() {
  // serverVuejs.on("connection", (socket) => {
  //   console.log("Client connected");
  //   socket.on("message", (message) => {
  //     console.log(`Received: ${message}`);
  //     // ส่งข้อมูลกลับไปยัง client
  //     socket.send(`You sent: ${message}`);
  //   });
  //   socket.on("close", () => {
  //     console.log("Client disconnected");
  //   });
  //   socket.on("error", async (error) => {
  //     console.error("เกิดข้อผิดพลาดใน Vue:", error);
  //   });
  // });
}
module.exports = { loginAndGetSessionId, sender, loginApi, getListUser };
