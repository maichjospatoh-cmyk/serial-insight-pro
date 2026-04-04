const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const { authenticate } = require("./auth");

const nodemailer = require("nodemailer");
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

// 📂 SIMPLE JSON DATABASE
const HISTORY_FILE = "history.json";
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

// 📧 EMAIL FUNCTION
function sendEmail() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "yourgmail@gmail.com",
      pass: "your_app_password"
    }
  });

  transporter.sendMail({
    from: "yourgmail@gmail.com",
    to: "receiver@email.com",
    subject: "Serial Report",
    text: "Attached report",
    attachments: [
      {
        filename: "report.xlsx",
        path: "./output/result.xlsx"
      }
    ]
  });
}

// 🔐 LOGIN
app.get("/login", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;font-family:Arial;">
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

// 🏠 HOME
app.get("/home", requireLogin, (req, res) => {
  res.send(`
    <div style="text-align:center;font-family:Arial;">
      <img src="/logo.jpeg" width="120"/>
      <h2 style="color:green;">Serial Insight Pro</h2>

      <form id="form" action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="files" required><br><br>
        <input type="file" name="files" required><br><br>

        <button style="padding:10px;background:green;color:white;">Process</button>
      </form>

      <div id="loading" style="display:none;">Processing... ⏳</div>

      <br>
      <a href="/dashboard">Dashboard</a> |
      <a href="/history">History</a> |
      <a href="/logout">Logout</a>

      <script>
        document.getElementById("form").onsubmit = () => {
          document.getElementById("loading").style.display = "block";
        }
      </script>
    </div>
  `);
});

// ⚙️ PROCESS
app.post("/process", requireLogin, upload.array("files", 2), (req, res) => {
  const f1 = req.files[0].path;
  const f2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${f1} ${f2}`, (err, stdout, stderr) => {
    if (err) return res.send(stderr);

    // SAVE HISTORY (JSON)
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    history.push({
      file: "result.xlsx",
      date: new Date().toISOString()
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // SEND EMAIL
    sendEmail();

    res.send(`
      <h2 style="text-align:center;">Done ✅</h2>
      <div style="text-align:center;">
        <a href="/download"><button>Download Excel</button></a><br><br>
        <a href="/home">Back</a>
      </div>
    `);
  });
});

// 📥 DOWNLOAD
app.get("/download", requireLogin, (req, res) => {
  const file = path.join(__dirname, "..", "output", "result.xlsx");
  if (!fs.existsSync(file)) return res.send("No file");

  res.download(file);
});

// 📊 DASHBOARD (LIVE)
app.get("/dashboard", requireLogin, (req, res) => {
  const file = path.join(__dirname, "..", "output", "result.xlsx");

  if (!fs.existsSync(file)) return res.send("No data yet");

  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  const map = {};
  data.forEach(r => {
    const a = r["agent name"] || "Unknown";
    map[a] = (map[a] || 0) + 1;
  });

  res.send(`
    <h2 style="text-align:center;">Live Dashboard</h2>
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

    <div style="text-align:center;"><a href="/home">Back</a></div>
  `);
});

// 📜 HISTORY
app.get("/history", requireLogin, (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE));

  let html = "<h2>History</h2><ul>";

  history.forEach(h => {
    html += `<li>${h.file} - ${h.date}</li>`;
  });

  html += "</ul><a href='/home'>Back</a>";

  res.send(html);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
