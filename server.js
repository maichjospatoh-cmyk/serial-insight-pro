console.log("NEW SERVER RUNNING ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

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

// 📥 LOAD USERS
function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

// 💾 SAVE USERS
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 🔐 LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:100px;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2 style="color:green;">LOC 7 Communications</h2>

      <form method="post">
        <input name="username" placeholder="Username"><br><br>
        <input name="password" type="password" placeholder="Password"><br><br>
        <button>Login</button>
      </form>
    </div>
  `);
});

// 🔐 LOGIN LOGIC
app.post("/login", (req, res) => {
  const users = getUsers();

  const user = users.find(
    u => u.username === req.body.username && u.password === req.body.password
  );

  if (!user) return res.send("Invalid login");

  req.session.user = user.username;
  res.redirect("/home");
});

// 🔒 AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// 🏠 HOME
app.get("/home", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2>Welcome ${req.session.user}</h2>

      <form action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="files" required><br><br>
        <input type="file" name="files" required><br><br>
        <button>Process</button>
      </form>

      <br>
      <a href="/change-password">Change Password</a> |
      <a href="/logout">Logout</a>
    </div>
  `);
});

// 🔑 CHANGE PASSWORD PAGE
app.get("/change-password", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:100px;">
      <h2>Change Password</h2>

      <form method="post">
        <input name="oldPassword" type="password" placeholder="Old Password"><br><br>
        <input name="newPassword" type="password" placeholder="New Password"><br><br>
        <button>Update</button>
      </form>
    </div>
  `);
});

// 🔑 CHANGE PASSWORD LOGIC
app.post("/change-password", requireLogin, (req, res) => {
  const users = getUsers();

  const userIndex = users.findIndex(u => u.username === req.session.user);

  if (users[userIndex].password !== req.body.oldPassword) {
    return res.send("Old password incorrect ❌");
  }

  users[userIndex].password = req.body.newPassword;
  saveUsers(users);

  res.send(`
    <h2>Password Updated ✅</h2>
    <a href="/home">Back</a>
  `);
});

// 🔓 LOGOUT
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

  if (!fs.existsSync(file)) return res.send("File not found");

  res.download(file);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
