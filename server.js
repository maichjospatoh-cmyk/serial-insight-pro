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

// 🔐 LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:100px;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2 style="color:green;">LOC 7 Communications</h2>

      <form method="post">
        <input name="username" placeholder="Username"><br><br>
        <input name="password" type="password" placeholder="Password"><br><br>
        <button style="padding:10px;background:green;color:white;">Login</button>
      </form>
    </div>
  `);
});

// 🔐 LOGIN LOGIC
app.post("/login", (req, res) => {
  if (req.body.username === "admin" && req.body.password === "admin123") {
    req.session.user = true;
    return res.redirect("/");
  }
  res.send("Invalid login");
});

// 🔒 AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ROOT
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/home");
});

// 🏠 HOME PAGE
app.get("/home", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2 style="color:green;">Serial Insight Pro</h2>

      <form id="form" action="/process" method="post" enctype="multipart/form-data">
        <p>Upload Report 1</p>
        <input type="file" name="files" required><br><br>

        <p>Upload Report 2</p>
        <input type="file" name="files" required><br><br>

        <button style="padding:12px;background:green;color:white;">Process</button>
      </form>

      <div id="loading" style="display:none;margin-top:20px;">
        Processing... ⏳
      </div>

      <br>
      <a href="/logout">Logout</a>

      <script>
        document.getElementById("form").onsubmit = () => {
          document.getElementById("loading").style.display = "block";
        }
      </script>
    </div>
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
    if (err) return res.send(`<pre>${stderr}</pre>`);

    res.send(`
      <div style="text-align:center;font-family:Arial;">
        <h2>Processing Complete ✅</h2>

        <a href="/download">
          <button style="padding:12px;background:green;color:white;">
            Download Excel
          </button>
        </a>

        <br><br>
        <a href="/home">Back</a>
      </div>
    `);
  });
});

// 📥 DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) {
    return res.send("File not found ❌");
  }

  res.download(file);
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
