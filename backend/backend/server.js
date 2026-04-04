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

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:100px;">
      <h2>Login</h2>
      <form method="post">
        <input name="username" placeholder="Username"><br><br>
        <input name="password" type="password" placeholder="Password"><br><br>
        <button>Login</button>
      </form>
    </div>
  `);
});

// LOGIN POST
app.post("/login", (req, res) => {
  if (req.body.username === "admin" && req.body.password === "admin123") {
    req.session.user = true;
    return res.redirect("/");
  }
  res.send("Invalid login");
});

// AUTH
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// HOME
app.get("/", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;">
      <h2>Upload Reports</h2>

      <form action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="files" required><br><br>
        <input type="file" name="files" required><br><br>
        <button>Process</button>
      </form>

      <br>
      <a href="/logout">Logout</a>
    </div>
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
      <a href="/download">Download Excel</a><br><br>
      <a href="/">Back</a>
    `);
  });
});

// DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) return res.send("File not found");

  res.download(file);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Running"));
