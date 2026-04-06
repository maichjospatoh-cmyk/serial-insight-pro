console.log("ENTERPRISE SERVER RUNNING ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
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

// INIT USERS FILE
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: "$2b$10$7QJ5u0m2YjH1Pq3KZ1QbEOnK9Z2FQ6yZ0G5y1s3pKZ1QbEOnK9Z2F", role: "admin" }
  ], null, 2));
}

// HELPERS
function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;font-family:Arial;">
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

// ROOT
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/home");
});

// HOME
app.get("/home", requireLogin, (req, res) => {
  const user = req.session.user;

  res.send(`
    <div style="text-align:center;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2>Welcome ${user.username} (${user.role})</h2>

      <form action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="files" required><br><br>
        <input type="file" name="files" required><br><br>
        <button>Process</button>
      </form>

      <br>
      <a href="/dashboard">Dashboard</a> |
      ${user.role === "admin" ? '<a href="/manage-users">Manage Users</a> |' : ""}
      <a href="/change-password">Change Password</a> |
      <a href="/logout">Logout</a>
    </div>
  `);
});

// CHANGE PASSWORD
app.get("/change-password", requireLogin, (req, res) => {
  res.send(`
    <h2>Change Password</h2>
    <form method="post">
      <input name="oldPassword" type="password" placeholder="Old Password"><br><br>
      <input name="newPassword" type="password" placeholder="New Password"><br><br>
      <button>Update</button>
    </form>
  `);
});

app.post("/change-password", requireLogin, async (req, res) => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.username === req.session.user.username);

  const match = await bcrypt.compare(req.body.oldPassword, users[userIndex].password);

  if (!match) return res.send("Wrong old password");

  users[userIndex].password = await bcrypt.hash(req.body.newPassword, 10);
  saveUsers(users);

  res.send("Password updated ✅ <br><a href='/home'>Back</a>");
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
      <a href="/download">Download Excel</a><br><br>
      <a href="/home">Back</a>
    `);
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
    <canvas id="c"></canvas>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      new Chart(document.getElementById("c"), {
        type: "bar",
        data: {
          labels: ${JSON.stringify(Object.keys(map))},
          datasets: [{
            label: "Lines",
            data: ${JSON.stringify(Object.values(map))}
          }]
        }
      });
    </script>

    <br><a href="/home">Back</a>
  `);
});

// ADMIN USER MANAGEMENT
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
      <input name="username"><br><br>
      <input name="password"><br><br>
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

app.post("/manage-users", requireLogin, async (req, res) => {
  if (req.session.user.role !== "admin") return res.send("Access denied");

  const users = getUsers();

  const hashed = await bcrypt.hash(req.body.password, 10);

  users.push({
    username: req.body.username,
    password: hashed,
    role: req.body.role
  });

  saveUsers(users);

  res.redirect("/manage-users");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
