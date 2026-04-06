console.log("ENTERPRISE ANALYTICS SYSTEM ✅");

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

// IMPORTANT: prevent index.html overriding
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

// 🎨 UI TEMPLATE
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
  padding:30px;
  width:420px;
  border-radius:12px;
  box-shadow:0 10px 25px rgba(0,0,0,0.2);
  text-align:center;
}

.logo{width:90px;margin-bottom:10px;}

input{
  width:90%;
  padding:10px;
  margin:8px 0;
  border-radius:5px;
  border:1px solid #ccc;
}

button{
  background:#0f7a2f;
  color:white;
  padding:10px 20px;
  border:none;
  border-radius:5px;
  font-weight:bold;
  cursor:pointer;
}

.nav a{
  margin:0 8px;
  color:#0f7a2f;
  font-weight:bold;
  text-decoration:none;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
}

th,td{
  padding:8px;
  border:1px solid #ddd;
  font-size:13px;
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

// 🔐 GLOBAL LOGIN CONTROL
app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (!req.session.user) return res.redirect("/login");
  next();
});

// ROOT
app.get("/", (req, res) => res.redirect("/login"));

// LOGIN PAGE
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

// LOGIN LOGIC
app.post("/login", async (req, res) => {
  const user = getUsers().find(u => u.username === req.body.username);

  if (!user) return res.send(page("<h3>Invalid login</h3>"));

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.send(page("<h3>Invalid login</h3>"));

  req.session.user = user;
  res.redirect("/home");
});

// HOME
app.get("/home", (req, res) => {
  res.send(page(`
    <h2>Upload Reports</h2>

    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required>
      <input type="file" name="files" required>
      <button>Process</button>
    </form>

    <div class="nav">
      <a href="/dashboard">Dashboard</a> |
      <a href="/logout">Logout</a>
    </div>
  `));
});

// PROCESS
app.post("/process", upload.array("files", 2), (req, res) => {
  exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, () => {
    res.send(page(`
      <h2>Processing Complete ✅</h2>
      <a href="/download">Download Excel</a>
      <div class="nav"><a href="/home">Back</a></div>
    `));
  });
});

// DOWNLOAD
app.get("/download", (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send(page("No file"));
  res.download(file);
});

// 📊 ADVANCED DASHBOARD
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

  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);

  res.send(page(`
    <h2>📊 Dashboard</h2>

    <div style="display:flex;justify-content:space-around;">
      <div><b>Total</b><br>${total}</div>
      <div style="color:red;"><b>Duplicates</b><br>${duplicates}</div>
      <div><b>Agents</b><br>${labels.length}</div>
    </div>

    <br><canvas id="bar"></canvas>
    <br><canvas id="pie"></canvas>

    <h3>🏆 Leaderboard</h3>
    <table>
      <tr><th>Rank</th><th>Agent</th><th>Lines</th></tr>
      ${sorted.map((a,i)=>`
        <tr><td>${i+1}</td><td>${a[0]}</td><td>${a[1]}</td></tr>
      `).join("")}
    </table>

    <div class="nav">
      <a href="/home">Upload</a> |
      <a href="/logout">Logout</a>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      new Chart(document.getElementById("bar"), {
        type: "bar",
        data: { labels: ${JSON.stringify(labels)}, datasets: [{ data: ${JSON.stringify(values)} }] }
      });

      new Chart(document.getElementById("pie"), {
        type: "pie",
        data: { labels: ${JSON.stringify(labels)}, datasets: [{ data: ${JSON.stringify(values)} }] }
      });
    </script>
  `));
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
