console.log("FORCED LOGIN SYSTEM ✅");

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
app.use(express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = "users.json";

// CREATE DEFAULT USER
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

// HELPERS
const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));

// 🎨 SIMPLE UI
function page(content){
return `
<html>
<head>
<style>
body{font-family:Arial;text-align:center;margin-top:80px;background:#f4f6f8}
.card{background:white;padding:20px;width:350px;margin:auto;border-radius:10px}
button{background:green;color:white;padding:10px;border:none}
</style>
</head>
<body>
<img src="/logo.jpeg" width="100"><br><br>
<div class="card">${content}</div>
</body>
</html>`;
}

// 🔴 FORCE LOGIN EVERY TIME
app.get("/", (req, res) => {
  req.session.destroy(); // clears session ALWAYS
  res.redirect("/login");
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(page(`
    <h2>Login</h2>
    <form method="post">
      <input name="username" placeholder="Username"><br><br>
      <input name="password" type="password" placeholder="Password"><br><br>
      <button>Login</button>
    </form>
  `));
});

// LOGIN LOGIC
app.post("/login", async (req, res) => {
  const user = getUsers().find(u => u.username === req.body.username);

  if (!user) return res.send("Invalid login");

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.send("Invalid login");

  req.session.user = user;

  res.redirect("/home");
});

// AUTH
function auth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// HOME (UPLOAD)
app.get("/home", auth, (req, res) => {
  res.send(page(`
    <h2>Upload Files</h2>
    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files"><br><br>
      <input type="file" name="files"><br><br>
      <button>Process</button>
    </form>

    <br>
    <a href="/dashboard">Dashboard</a> |
    <a href="/logout">Logout</a>
  `));
});

// PROCESS
app.post("/process", auth, upload.array("files", 2), (req, res) => {
  exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, () => {
    res.send(page(`
      <h2>Done ✅</h2>
      <a href="/download">Download Excel</a>
    `));
  });
});

// DOWNLOAD
app.get("/download", auth, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send("No file");
  res.download(file);
});

// DASHBOARD
app.get("/dashboard", auth, (req, res) => {
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
    <pre>${JSON.stringify(map, null, 2)}</pre>
    <br><a href="/home">Back</a>
  `));
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
