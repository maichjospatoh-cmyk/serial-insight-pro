const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const { authenticate } = require("./auth");

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
    <div style="text-align:center; margin-top:80px; font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2 style="color:green;">LOC 7 Communications Limited</h2>

      <div style="display:inline-block;padding:30px;border-radius:10px;
      box-shadow:0 0 10px rgba(0,0,0,0.1);">

        <h3>Login</h3>

        <form method="post">
          <input name="username" placeholder="Username"
          style="padding:10px;width:200px;"><br><br>

          <input name="password" type="password" placeholder="Password"
          style="padding:10px;width:200px;"><br><br>

          <button style="padding:10px 20px;background:green;color:white;border:none;">
            Login
          </button>
        </form>
      </div>
    </div>
  `);
});

// LOGIN LOGIC
app.post("/login", (req, res) => {
  const user = authenticate(req.body.username, req.body.password);
  if (!user) return res.send("Invalid login");

  req.session.user = user;
  res.redirect("/home");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// PROTECT ROUTES
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ROOT REDIRECT
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

      <form id="uploadForm" action="/process" method="post" enctype="multipart/form-data">
        <p>Upload Report 1</p>
        <input type="file" name="files" required><br><br>

        <p>Upload Report 2</p>
        <input type="file" name="files" required><br><br>

        <button style="padding:12px 25px;background:green;color:white;border:none;">
          Process Reports
        </button>
      </form>

      <br>
      <a href="/dashboard">Dashboard</a> |
      <a href="/logout">Logout</a>

      <div id="loading" style="display:none;margin-top:20px;">
        <p>Processing... please wait ⏳</p>
      </div>

      <script>
        document.getElementById("uploadForm").addEventListener("submit", function(){
          document.getElementById("loading").style.display = "block";
        });
      </script>
    </div>
  `);
});

// ⚙️ PROCESS
app.post("/process", requireLogin, upload.array("files", 2), (req, res) => {
  const file1 = req.files[0].path;
  const file2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${file1} ${file2}`, (err, stdout, stderr) => {
    if (err) return res.send(`<pre>${stderr}</pre>`);

    res.send(`
      <div style="text-align:center;font-family:Arial;">
        <h2>Processing Complete ✅</h2>

        <a href="/download">
          <button style="padding:12px 25px;background:green;color:white;">
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
  const file = path.join(__dirname, "..", "output", "result.xlsx");

  if (!fs.existsSync(file)) {
    return res.send("File not found ❌");
  }

  res.download(file);
});

// 📊 DASHBOARD
app.get("/dashboard", requireLogin, (req, res) => {
  res.send(`
    <h2 style="text-align:center;">Dashboard</h2>

    <canvas id="chart"></canvas>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const data = {
        labels: ["Agent A", "Agent B"],
        datasets: [{
          label: "Performance",
          data: [50, 30]
        }]
      };

      new Chart(document.getElementById("chart"), {
        type: "bar",
        data: data
      });
    </script>

    <div style="text-align:center;margin-top:20px;">
      <a href="/home">Back</a>
    </div>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
