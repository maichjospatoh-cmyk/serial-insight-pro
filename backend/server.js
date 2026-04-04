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
    <div style="text-align:center;margin-top:100px;">
      <h2>Login</h2>
      <form method="post">
        <input name="username" placeholder="Username"/><br><br>
        <input name="password" type="password" placeholder="Password"/><br><br>
        <button>Login</button>
      </form>
    </div>
  `);
});

// 🔐 LOGIN LOGIC
app.post("/login", (req, res) => {
  const user = authenticate(req.body.username, req.body.password);

  if (!user) return res.send("Invalid login");

  req.session.user = user;
  res.redirect("/");
});

// 🔒 PROTECT ROUTES
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// 🏠 HOME
app.get("/", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;">
      <img src="/logo.jpeg" width="120"/>
      <h2>Serial Insight Pro</h2>

      <form action="/process" method="post" enctype="multipart/form-data">
        <p>Upload Report 1</p>
        <input type="file" name="files" required /><br><br>

        <p>Upload Report 2</p>
        <input type="file" name="files" required /><br><br>

        <button style="padding:10px 20px;background:green;color:white;">
          Process
        </button>
      </form>

      <br>
      <a href="/dashboard">Dashboard</a>
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
      <div style="text-align:center;">
        <h2>Processing Complete ✅</h2>

        <a href="/download">
          <button style="padding:10px 20px;background:green;color:white;">
            Download Excel
          </button>
        </a>

        <br><br>
        <a href="/">Back</a>
      </div>
    `);
  });
});

// 📥 DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const filePath = path.join(__dirname, "..", "output", "result.xlsx");

  if (!fs.existsSync(filePath)) {
    return res.send("File not found ❌");
  }

  res.download(filePath);
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

    <br><br>
    <div style="text-align:center;">
      <a href="/">Back</a>
    </div>
  `);
});

// 🚀 START
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
