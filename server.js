console.log("FINAL SYSTEM WITH DOWNLOAD FIX ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

// CREATE FOLDERS
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("output")) fs.mkdirSync("output");
if (!fs.existsSync("history")) fs.mkdirSync("history");

// SESSION
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// ROOT
app.get("/", (req, res) => res.redirect("/login"));

// EMAIL (SAFE)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourgmail@gmail.com",
    pass: "your_app_password"
  }
});

// USERS
const USERS_FILE = "users.json";

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10), role:"admin" }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2));

// UI TEMPLATE
function page(content){
return `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;font-family:Arial;display:flex;}
.sidebar{width:220px;background:#0f7a2f;color:white;height:100vh;padding:20px;position:fixed;}
.sidebar img{width:120px;margin:auto;display:block;margin-bottom:20px;}
.sidebar a{display:block;color:white;margin:10px 0;text-decoration:none;}
.main{margin-left:220px;padding:20px;width:100%;background:#f4f4f4;}
.card{background:white;padding:20px;border-radius:10px;margin-bottom:20px;}
.toast{background:green;color:white;padding:10px;margin-bottom:10px;}
.btn{display:inline-block;padding:10px 15px;background:#0f7a2f;color:white;text-decoration:none;border-radius:6px;margin:5px 0;}
@media(max-width:768px){
  .sidebar{position:relative;width:100%;height:auto;}
  .main{margin-left:0;}
}
</style>
</head>

<body>

<div class="sidebar">
<img src="/assets/logo.jpeg">
<a href="/dashboard">Dashboard</a>
<a href="/home">Upload</a>
<a href="/logout">Logout</a>
</div>

<div class="main">
${content}
</div>

</body>
</html>`;
}

// AUTH
app.use((req,res,next)=>{
  if(req.path==="/login") return next();
  if(!req.session.user) return res.redirect("/login");
  next();
});

// LOGIN
app.get("/login",(req,res)=>res.send(`
<body style="text-align:center;background:#0f7a2f;padding-top:100px">
<img src="/assets/logo.jpeg" width="150"><br><br>
<form method="post">
<input name="username"><br><br>
<input name="password" type="password"><br><br>
<button>Login</button>
</form>
</body>
`));

app.post("/login",async(req,res)=>{
const u=getUsers().find(x=>x.username===req.body.username);
if(!u) return res.send("Invalid login");

if(!(await bcrypt.compare(req.body.password,u.password)))
  return res.send("Invalid login");

req.session.user=u;
res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard",(req,res)=>{
if(!fs.existsSync("output/result.xlsx")){
  return res.redirect("/home");
}

const wb=xlsx.readFile("output/result.xlsx");
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

res.send(page(`
<div class="card">
<h2>Dashboard</h2>

<table border="1" width="100%">
<tr><th>Agent</th><th>Van</th><th>Total</th><th>Duplicates</th><th>Quality</th></tr>
${data.map(r=>`
<tr>
<td>${r.Agent}</td>
<td>${r["Van Plate"]}</td>
<td>${r.Total}</td>
<td style="color:red">${r.Duplicates}</td>
<td>${r["Quality %"]}%</td>
</tr>
`).join("")}
</table>

</div>
`));
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<div class="card">
<h2>Upload Files</h2>

<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files" required><br><br>
<input type="file" name="files" required><br><br>
<button>Process</button>
</form>

</div>
`)));

// PROCESS (FIXED)
app.post("/process", upload.array("files", 2), (req, res) => {

  if (!req.files || req.files.length < 2) {
    return res.send(page(`<div class="card">❌ Upload 2 files</div>`));
  }

  const file1 = req.files[0].path;
  const file2 = req.files[1].path;

  exec(`python3 processor/compare.py ${file1} ${file2}`, async (err, stdout, stderr) => {

    if (err) {
      return res.send(page(`
        <div class="card">
        ❌ Processing failed<br><br>
        ${stderr || err.message}
        </div>
      `));
    }

    if (!fs.existsSync("output/result.xlsx")) {
      return res.send(page(`
        <div class="card">
        ❌ Output file missing
        </div>
      `));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g,"-");
    const filePath = `history/report-${timestamp}.xlsx`;

    fs.copyFileSync("output/result.xlsx", filePath);

    try {
      await transporter.sendMail({
        from: "yourgmail@gmail.com",
        to: "receiver@email.com",
        subject: "Report",
        text: "Attached",
        attachments: [{ path: filePath }]
      });
    } catch(e) {
      console.log("Email error:", e);
    }

    res.send(page(`
      <div class="toast">✅ Processed successfully</div>

      <div class="card">
        <h2>Download Report</h2>

        <a href="/download" class="btn">📥 Download Excel</a><br>
        <a href="/dashboard" class="btn">📊 View Dashboard</a>
      </div>
    `));

  });

});

// DOWNLOAD
app.get("/download",(req,res)=>{
  res.download("output/result.xlsx");
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
