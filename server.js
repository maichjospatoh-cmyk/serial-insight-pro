console.log("FULL PROFESSIONAL SYSTEM ✅");

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

// ❌ IMPORTANT: DO NOT SERVE index.html
app.use("/assets", express.static(".")); 

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

const USERS_FILE = "users.json";

// CREATE DEFAULT USER
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));

// 🎨 FULL UI TEMPLATE
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
  width:400px;
  border-radius:12px;
  box-shadow:0 10px 25px rgba(0,0,0,0.2);
  text-align:center;
}

.logo{
  width:90px;
  margin-bottom:10px;
}

input{
  width:90%;
  padding:10px;
  margin:8px 0;
  border:1px solid #ccc;
  border-radius:5px;
}

button{
  background:#0f7a2f;
  color:white;
  padding:10px 20px;
  border:none;
  border-radius:5px;
  cursor:pointer;
  font-weight:bold;
}

.nav{
  margin-top:15px;
}

.nav a{
  color:#0f7a2f;
  text-decoration:none;
  margin:0 8px;
  font-weight:bold;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
}

th, td{
  padding:8px;
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
</html>
`;
}

// 🔥 GLOBAL LOGIN PROTECTION
app.use((req, res, next) => {
  if (req.path === "/login") return next();

  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
});

// ROOT → LOGIN
app.get("/", (req, res) => {
  res.redirect("/login");
});

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

// HOME (UPLOAD)
app.get("/home", (req, res) => {
  res.send(page(`
    <h2>Upload Reports</h2>

    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required><br>
      <input type="file" name="files" required><br><br>
      <button>Process Reports</button>
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
      <h2>Done ✅</h2>
      <a href="/download">Download Excel</a>

      <div class="nav">
        <a href="/home">Back</a>
      </div>
    `));
  });
});

// DOWNLOAD
app.get("/download", (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send(page("No file"));
  res.download(file);
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
  const file = "output/result.xlsx";

  if (!fs.existsSync(file)) {
    return res.send(page("<h3>No data yet</h3>"));
  }

  const wb = xlsx.readFile(file);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const map = {};
  data.forEach(r => {
    const a = r["agent name"] || "Unknown";
    map[a] = (map[a] || 0) + 1;
  });

  res.send(page(`
    <h2>Dashboard</h2>

    <table>
      <tr><th>Agent</th><th>Lines</th></tr>
      ${Object.entries(map).map(a=>`
        <tr><td>${a[0]}</td><td>${a[1]}</td></tr>
      `).join("")}
    </table>

    <div class="nav">
      <a href="/home">Upload</a> |
      <a href="/logout">Logout</a>
    </div>
  `));
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
