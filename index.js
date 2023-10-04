require("dotenv").config();
// const mysql = require("mysql2");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2/promise");
const {
  loginAndGetSessionId,
  sender,
  loginApi,
  getListUser,
} = require("./zk-ws");
const dbConnection = {
  host: "192.168.1.44",
  port: 3306,
  user: "admin",
  password: "admin",
  database: "zkbiotime",
};
const app = express();
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
const server = http.createServer(app);
sender();
loginAndGetSessionId();
function getDateNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // เพิ่ม 0 ถ้าหลักสุดท้ายไม่ครบ 2 ตัว
  const day = String(now.getDate()).padStart(2, "0"); // เพิ่ม 0 ถ้าหลักสุดท้ายไม่ครบ 2 ตัว

  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
}

app.get("/personnel/api/employees/", async (req, res) => {
  let token = await loginApi();
  let get = await getListUser(token);
  res.send(get);
});
app.get("/iclock_transaction/", async (req, res) => {
  const connection = await mysql.createConnection(dbConnection);
  const [stuIn] = await connection.execute(
    "SELECT count(1) as `stu_in` FROM `iclock_transaction` WHERE DATE(`punch_time`) = '" +
      getDateNow() +
      "' AND 	`punch_state` = 0"
  );
  const [stuOut] = await connection.execute(
    "SELECT count(1) as `stu_out` FROM `iclock_transaction` WHERE DATE(`punch_time`) = '" +
      getDateNow() +
      "' AND 	`punch_state` = 1"
  );
  const [totalStu] = await connection.execute(
    "SELECT count(1) as `total` FROM `personnel_employee`"
  );
  connection.end();
  res.send({
    stuIn: stuIn[0].stu_in,
    stuOut: stuOut[0].stu_out,
    totalStu: totalStu[0].total,
  });
});
app.get("/students/", async (req, res) => {
  const connection = await mysql.createConnection(dbConnection);
  let sql =
    "SELECT * FROM `personnel_employee` as `pe` INNER JOIN `personnel_position` as `pp` ON `pe`.`position_id` = `pp`.`id` WHERE 1=1";
  if (req.query.first_name) {
    sql += ` AND first_name LIKE '%${req.query.first_name}%'`;
  }

  if (req.query.last_name) {
    sql += ` AND last_name LIKE '%${req.query.last_name}%'`;
  }

  if (req.query.position_name) {
    sql += ` AND position_name LIKE '%${req.query.position_name}%'`;
  }
  const [stuIn] = await connection.execute(sql);
  connection.end();
  res.json(stuIn);
  connection.end();
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
