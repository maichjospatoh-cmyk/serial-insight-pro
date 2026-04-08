console.log("FINAL UI UPGRADE SYSTEM ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

const USERS_FILE = "users.json";

// DEFAULT USER
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));

/* 🎨 FULL UI TEMPLATE (BIG LOGO + BIG TABS) */
function page(content){
return `
<html>
<head>
<style>
body{
  margin:0;
  font-family:Arial;
  background: linear-gradient(135deg, #0f7a2f, #28a745, #0f7a2f);
  height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
}

.card{
  background:white;
  padding:40px;
  width:480px;
  border-radius:14px;
  box-shadow:0 12px 30px rgba(0,0,0,0.25);
  text-align:center;
}

/* 🔥 BIG LOGO */
.logo{
  width:150px;
  margin-bottom:20px;
}

/* INPUTS */
input{
  width:95%;
  padding:12px;
  margin:10px 0;
  border-radius:6px;
  border:1px solid #ccc;
  font-size:15px;
}

/* BUTTON */
button{
  background:#0f7a2f;
  color:white;
  padding:12px 25px;
  border:none;
  border-radius:6px;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}

/* 🔥 BIG NAV TABS */
.nav{
  margin-top:20px;
}

.nav a{
  font-size:18px;
  padding:10px 14px;
  color:#0f7a2f;
  font-weight:bold;
  text-decoration:none;
  display:inline-block;
}

.nav a:hover{
  background:#e6f5ea;
  border-radius:6px;
}

/* TABLE */
table{
  width:100%;
  border-collapse:collapse;
  margin-top:15px;
}

th,td{
  padding:10px;
  border:1px solid #ddd;
}

th{
  background:#0f7a2f;
  color:white;
}
</style>
</head>

<body>

<div class="card">
  <img src="/assets/logo.jpeg" class="logo"/>

  ${content}
</div>

</body>
</html>`;
}

/* 🔐 LOGIN CONTROL */
app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (!req.session.user) return res.redirect("/login");
  next();
});

/* ROOT */
app.get("/", (req, res) => res.redirect("/login"));

/* LOGIN PAGE */
app.get("/login", (req, res) => {
  res.send(page(`
    <h2>Login</h2>
    <form method="post">
      <input name="username" placeholder="Username">
      <input name="password" type="password" placeholder="Password">
      <button>Login</button>
    </form>
  `));
});

/* LOGIN */
app.post("/login", async (req, res) => {
  const user = getUsers().find(u => u.username === req.body.username);

  if (!user) return res.send(page("<h3>Invalid login</h3>"));

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.send(page("<h3>Invalid login</h3>"));

  req.session.user = user;
  res.redirect("/home");
});

/* HOME */
app.get("/home", (req, res) => {
  res.send(page(`
    <h2>Upload Reports</h2>

    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required>
      <input type="file" name="files" required>
      <button>Process Reports</button>
    </form>

    <div class="nav">
      <a href="/dashboard">Dashboard</a>
      <a href="/logout">Logout</a>
    </div>
  `));
});

/* PROCESS */
app.post("/process", upload.array("files", 2), (req, res) => {
  exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, () => {
    res.send(page(`
      <h2>Processing Complete ✅</h2>
      <a href="/download">Download Excel</a>

      <div class="nav">
        <a href="/home">Back</a>
      </div>
    `));
  });
});

/* DOWNLOAD */
app.get("/download", (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send(page("No file"));
  res.download(file);
});

/* DASHBOARD */
app.get("/dashboard", (req, res) => {
  const file = "output/result.xlsx";

  if (!fs.existsSync(file)) {
    return res.send(page("<h3>No data yet</h3>"));
  }

  const wb = xlsx.readFile(file);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const total = data.length;
  const duplicates = data.filter(r => r["duplicate_per_agent"] === true).length;

  const agentMap = {};
  data.forEach(r => {
    const a = r["agent name"] || "Unknown";
    agentMap[a] = (agentMap[a] || 0) + 1;
  });

  const sorted = Object.entries(agentMap).sort((a, b) => b[1] - a[1]);

  res.send(page(`
    <h2>📊 Dashboard</h2>

    <div style="display:flex;justify-content:space-around;">
      <div><b>Total</b><br>${total}</div>
      <div style="color:red;"><b>Duplicates</b><br>${duplicates}</div>
      <div><b>Agents</b><br>${sorted.length}</div>
    </div>

    <h3>🏆 Leaderboard</h3>
    <table>
      <tr><th>Rank</th><th>Agent</th><th>Lines</th></tr>
      ${sorted.map((a,i)=>`
        <tr><td>${i+1}</td><td>${a[0]}</td><td>${a[1]}</td></tr>
      `).join("")}
    </table>

    <div class="nav">
      <a href="/home">Upload</a>
      <a href="/logout">Logout</a>
    </div>
  `));
});

/* LOGOUT */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
