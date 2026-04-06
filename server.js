console.log("LOGIN SYSTEM FIXED ✅");

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

// ✅ ALWAYS CREATE DEFAULT USER IF FILE MISSING
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);

  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed, role: "admin" }
  ], null, 2));
}

// HELPERS
function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 🔴 ROOT → ALWAYS LOGIN FIRST
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/home");
});

// 🔐 LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;">
      <img src="/logo.jpeg" width="120"/>
      <h2>Login</h2>
      <form method="post">
        <input name="username" placeholder="Username"><br><br>
        <input name="password" type="password" placeholder="Password"><br><br>
        <button>Login</button>
      </form>
    </div>
  `);
});

// 🔐 LOGIN LOGIC
app.post("/login", async (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.username === req.body.username);

  if (!user) return res.send("Invalid login");

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.send("Invalid login");

  req.session.user = user;
  res.redirect("/home");
});

// 🔒 AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// 🏠 HOME (UPLOAD PAGE AFTER LOGIN)
app.get("/home", requireLogin, (req, res) => {
  res.send(`
    <h2>Welcome ${req.session.user.username}</h2>

    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required><br><br>
      <input type="file" name="files" required><br><br>
      <button>Process</button>
    </form>

    <br>
    <a href="/dashboard">Dashboard</a> |
    <a href="/change-password">Change Password</a> |
    <a href="/logout">Logout</a>
  `);
});

// 🔑 CHANGE PASSWORD
app.get("/change-password", requireLogin, (req, res) => {
  res.send(`
    <h2>Change Password</h2>
    <form method="post">
      <input name="oldPassword" type="password"><br><br>
      <input name="newPassword" type="password"><br><br>
      <button>Update</button>
    </form>
  `);
});

app.post("/change-password", requireLogin, async (req, res) => {
  const users = getUsers();
  const index = users.findIndex(u => u.username === req.session.user.username);

  const match = await bcrypt.compare(req.body.oldPassword, users[index].password);
  if (!match) return res.send("Wrong password");

  users[index].password = await bcrypt.hash(req.body.newPassword, 10);
  saveUsers(users);

  res.send("Password updated ✅ <br><a href='/home'>Back</a>");
});

// 🚪 LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ⚙️ PROCESS
app.post("/process", requireLogin, upload.array("files", 2), (req, res) => {
  const f1 = req.files[0].path;
  const f2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${f1} ${f2}`, (err, stdout, stderr) => {
    if (err) return res.send(stderr);

    res.send(`
      <h2>Done ✅</h2>
      <a href="/download">Download Excel</a><br><br>
      <a href="/home">Back</a>
    `);
  });
});

// 📥 DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) return res.send("No file");

  res.download(file);
});

// 📊 DASHBOARD
app.get("/dashboard", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) return res.send("No data");

  const wb = xlsx.readFile(file);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const map = {};
  data.forEach(r => {
    const a = r["agent name"] || "Unknown";
    map[a] = (map[a] || 0) + 1;
  });

  res.send(`
    <h2>Dashboard</h2>
    <pre>${JSON.stringify(map, null, 2)}</pre>
    <a href="/home">Back</a>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
