console.log("FINAL ENTERPRISE SYSTEM + PASSWORD + DOWNLOAD FIX ✅");

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

// CREATE DEFAULT USER
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

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
  padding:40px;
  width:500px;
  border-radius:14px;
  box-shadow:0 12px 30px rgba(0,0,0,0.25);
  text-align:center;
}

.logo{ width:150px; margin-bottom:20px; }

input{
  width:95%;
  padding:12px;
  margin:10px 0;
  border-radius:6px;
  border:1px solid #ccc;
}

button{
  background:#0f7a2f;
  color:white;
  padding:12px 25px;
  border:none;
  border-radius:6px;
  font-weight:bold;
  cursor:pointer;
}

.nav a{
  font-size:18px;
  margin:0 10px;
  color:#0f7a2f;
  font-weight:bold;
  text-decoration:none;
}

.nav a:hover{
  background:#e6f5ea;
  padding:6px;
  border-radius:6px;
}

.download-btn{
  display:inline-block;
  margin-top:15px;
  padding:12px 20px;
  background:#0f7a2f;
  color:white;
  border-radius:6px;
  text-decoration:none;
  font-weight:bold;
}

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

// 🔐 AUTH
app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (!req.session.user) return res.redirect("/login");
  next();
});

// ROOT
app.get("/", (req, res) => res.redirect("/login"));

// LOGIN
app.get("/login", (req, res) => {
  res.send(page(`
    <h2>Login</h2>
    <form method="post">
      <input name="username">
      <input name="password" type="password">
      <button>Login</button>
    </form>
  `));
});

app.post("/login", async (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.username === req.body.username);

  if (!user) return res.send(page("Invalid login"));

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.send(page("Invalid login"));

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
      <a href="/dashboard">Dashboard</a>
      <a href="/change-password">Change Password</a>
      <a href="/logout">Logout</a>
    </div>
  `));
});

// PROCESS (FIXED DOWNLOAD BUTTON)
app.post("/process", upload.array("files", 2), (req, res) => {
  exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, () => {
    res.send(page(`
      <h2>Processing Complete ✅</h2>

      <a href="/download" class="download-btn">⬇ Download Excel</a>

      <div class="nav">
        <a href="/home">Back</a>
      </div>
    `));
  });
});

// DOWNLOAD
app.get("/download", (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) {
    return res.send(page("<h3>No file available</h3>"));
  }

  res.download(file);
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
  const file = "output/result.xlsx";

  if (!fs.existsSync(file)) {
    return res.send(page("<h3>No data yet</h3>"));
  }

  const data = xlsx.utils.sheet_to_json(
    xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]]
  );

  const total = data.length;
  const duplicates = data.filter(r => r["duplicate_per_agent"]).length;

  const map = {};
  data.forEach(r => {
    const a = r["agent name"] || "Unknown";
    map[a] = (map[a] || 0) + 1;
  });

  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);

  res.send(page(`
    <h2>Dashboard</h2>

    <p>Total: ${total} | Duplicates: ${duplicates}</p>

    <table>
      <tr><th>Agent</th><th>Lines</th></tr>
      ${sorted.map(a=>`<tr><td>${a[0]}</td><td>${a[1]}</td></tr>`).join("")}
    </table>

    <div class="nav">
      <a href="/home">Upload</a>
      <a href="/change-password">Change Password</a>
      <a href="/logout">Logout</a>
    </div>
  `));
});

// 🔑 CHANGE PASSWORD
app.get("/change-password", (req, res) => {
  res.send(page(`
    <h2>Change Password</h2>
    <form method="post">
      <input name="oldPassword" type="password" placeholder="Old Password">
      <input name="newPassword" type="password" placeholder="New Password">
      <button>Update</button>
    </form>

    <div class="nav">
      <a href="/home">Back</a>
    </div>
  `));
});

app.post("/change-password", async (req, res) => {
  const users = getUsers();
  const index = users.findIndex(u => u.username === req.session.user.username);

  const match = await bcrypt.compare(req.body.oldPassword, users[index].password);

  if (!match) return res.send(page("Wrong password"));

  users[index].password = await bcrypt.hash(req.body.newPassword, 10);
  saveUsers(users);

  res.send(page("<h3>Password Updated ✅</h3><a href='/home'>Back</a>"));
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.listen(process.env.PORT || 10000, () => console.log("Server running"));
