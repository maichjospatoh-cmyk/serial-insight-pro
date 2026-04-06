const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
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

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;">
      <img src="/logo.jpeg" width="120"/>
      <h2>Login</h2>
      <form method="post">
        <input name="username"><br><br>
        <input name="password" type="password"><br><br>
        <button>Login</button>
      </form>
    </div>
  `);
});

// LOGIN
app.post("/login", (req, res) => {
  const users = getUsers();
  const user = users.find(
    u => u.username === req.body.username && u.password === req.body.password
  );

  if (!user) return res.send("Invalid login");

  req.session.user = user;
  res.redirect("/home");
});

// AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// HOME
app.get("/home", requireLogin, (req, res) => {
  const user = req.session.user;

  res.send(`
    <h2>Welcome ${user.username} (${user.role})</h2>

    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" required><br><br>
      <input type="file" name="files" required><br><br>
      <button>Process</button>
    </form>

    <br>
    ${user.role === "admin" ? '<a href="/manage-users">Manage Users</a> |' : ""}
    <a href="/dashboard">Dashboard</a> |
    <a href="/logout">Logout</a>
  `);
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// PROCESS
app.post("/process", requireLogin, upload.array("files", 2), (req, res) => {
  const f1 = req.files[0].path;
  const f2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${f1} ${f2}`, (err, stdout, stderr) => {
    if (err) return res.send(stderr);

    res.send(`
      <h2>Done ✅</h2>
      <a href="/download">Download</a>
    `);
  });
});

// DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send("No file");
  res.download(file);
});

// DASHBOARD (ROLE BASED)
app.get("/dashboard", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send("No data");

  const wb = xlsx.readFile(file);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const user = req.session.user;

  let filtered = data;

  if (user.role === "agent") {
    filtered = data.filter(r => r["agent name"] === user.username);
  }

  const map = {};
  filtered.forEach(r => {
    const a = r["agent name"];
    map[a] = (map[a] || 0) + 1;
  });

  res.send(`
    <h2>Dashboard</h2>
    <pre>${JSON.stringify(map, null, 2)}</pre>
    <a href="/home">Back</a>
  `);
});

// ADMIN: MANAGE USERS
app.get("/manage-users", requireLogin, (req, res) => {
  if (req.session.user.role !== "admin") return res.send("Access denied");

  const users = getUsers();

  let html = "<h2>Users</h2><ul>";
  users.forEach(u => {
    html += `<li>${u.username} (${u.role})</li>`;
  });
  html += "</ul>";

  html += `
    <h3>Add User</h3>
    <form method="post">
      <input name="username" placeholder="Username"><br><br>
      <input name="password" placeholder="Password"><br><br>
      <select name="role">
        <option value="agent">Agent</option>
        <option value="admin">Admin</option>
      </select><br><br>
      <button>Add</button>
    </form>
    <a href="/home">Back</a>
  `;

  res.send(html);
});

// ADD USER
app.post("/manage-users", requireLogin, (req, res) => {
  if (req.session.user.role !== "admin") return res.send("Access denied");

  const users = getUsers();

  users.push({
    username: req.body.username,
    password: req.body.password,
    role: req.body.role
  });

  saveUsers(users);

  res.redirect("/manage-users");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Running"));
