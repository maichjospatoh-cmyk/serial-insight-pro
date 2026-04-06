console.log("FINAL UI SYSTEM ✅");

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

// 🎨 GLOBAL UI TEMPLATE
function layout(title, content, user = null) {
  return `
  <html>
  <head>
    <title>${title}</title>
    <style>
      body {
        font-family: Arial;
        background: #f4f6f8;
        margin: 0;
        text-align: center;
      }

      .container {
        margin-top: 80px;
      }

      .logo {
        width: 100px;
        margin-bottom: 10px;
      }

      .card {
        background: white;
        padding: 30px;
        width: 350px;
        margin: auto;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }

      input {
        width: 90%;
        padding: 10px;
        margin: 8px 0;
      }

      button {
        padding: 10px 20px;
        background: green;
        color: white;
        border: none;
        cursor: pointer;
      }

      .nav {
        margin-top: 20px;
      }

      .nav a {
        margin: 0 10px;
        text-decoration: none;
        color: green;
        font-weight: bold;
      }
    </style>
  </head>
  <body>

    <div class="container">
      <img src="/logo.jpeg" class="logo"/>
      ${user ? `<h3>${user.username}</h3>` : ""}

      <div class="card">
        ${content}
      </div>

      ${user ? `
      <div class="nav">
        <a href="/home">Upload</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/change-password">Password</a>
        <a href="/logout">Logout</a>
      </div>
      ` : ""}
    </div>

  </body>
  </html>
  `;
}

// 🔴 FORCE LOGIN FIRST
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/home");
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(layout("Login", `
    <h2>Login</h2>
    <form method="post">
      <input name="username" placeholder="Username">
      <input name="password" type="password" placeholder="Password">
      <button>Login</button>
    </form>
  `));
});

// LOGIN
app.post("/login", async (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.username === req.body.username);

  if (!user) return res.send("Invalid login");

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.send("Invalid login");

  req.session.user = user;
  res.redirect("/home");
});

// AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// HOME (UPLOAD)
app.get("/home", requireLogin, (req, res) => {
  res.send(layout("Upload", `
    <h2>Upload Files</h2>
    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required>
      <input type="file" name="files" required>
      <button>Process</button>
    </form>
  `, req.session.user));
});

// PROCESS
app.post("/process", requireLogin, upload.array("files", 2), (req, res) => {
  const f1 = req.files[0].path;
  const f2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${f1} ${f2}`, (err) => {
    if (err) return res.send("Error processing");

    res.send(layout("Done", `
      <h2>Processing Complete ✅</h2>
      <a href="/download">Download Excel</a>
    `, req.session.user));
  });
});

// DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send("No file");
  res.download(file);
});

// DASHBOARD
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

  res.send(layout("Dashboard", `
    <h2>Dashboard</h2>
    <pre>${JSON.stringify(map, null, 2)}</pre>
  `, req.session.user));
});

// CHANGE PASSWORD
app.get("/change-password", requireLogin, (req, res) => {
  res.send(layout("Password", `
    <h2>Change Password</h2>
    <form method="post">
      <input name="oldPassword" type="password" placeholder="Old Password">
      <input name="newPassword" type="password" placeholder="New Password">
      <button>Update</button>
    </form>
  `, req.session.user));
});

app.post("/change-password", requireLogin, async (req, res) => {
  const users = getUsers();
  const index = users.findIndex(u => u.username === req.session.user.username);

  const match = await bcrypt.compare(req.body.oldPassword, users[index].password);
  if (!match) return res.send("Wrong password");

  users[index].password = await bcrypt.hash(req.body.newPassword, 10);
  saveUsers(users);

  res.send(layout("Success", `<h2>Password Updated ✅</h2>`, req.session.user));
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
