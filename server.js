console.log("SMART MULTI-SOURCE SYSTEM FINAL ✅");

// crash protection
process.on("uncaughtException", err => console.error(err));
process.on("unhandledRejection", err => console.error(err));

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

// ensure folders
["uploads","output"].forEach(f=>{
  if(!fs.existsSync(f)) fs.mkdirSync(f);
});

// session
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// users
const USERS_FILE="users.json";
if(!fs.existsSync(USERS_FILE)){
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username:"admin", password:bcrypt.hashSync("admin123",10) }
  ],null,2));
}
const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));

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
.btn{background:#0f7a2f;color:white;padding:10px 15px;text-decoration:none;border-radius:6px;display:inline-block;margin:5px;}
@media(max-width:768px){.sidebar{position:relative;width:100%;}.main{margin-left:0;}}
</style>
</head>
<body>

<div class="sidebar">
<img src="/assets/logo.jpeg">
<a href="/dashboard">Dashboard</a>
<a href="/home">Upload Excel</a>
<a href="/whatsapp">WhatsApp Input</a>
<a href="/logout">Logout</a>
</div>

<div class="main">
${content}
</div>

</body>
</html>`;
}

// auth
app.use((req,res,next)=>{
  if(req.path==="/login") return next();
  if(!req.session.user) return res.redirect("/login");
  next();
});

// login
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

// WHATSAPP INPUT
app.get("/whatsapp",(req,res)=>res.send(page(`
<div class="card">
<h2>📱 WhatsApp Input</h2>

<form method="post">
<textarea name="text" rows="10" style="width:100%" placeholder="Paste WhatsApp data here..."></textarea><br><br>
<button>Save</button>
</form>
</div>
`)));

app.post("/whatsapp",(req,res)=>{
fs.writeFileSync("uploads/whatsapp.txt", req.body.text || "");
res.send(page(`
<div class="card">
<h2>✅ WhatsApp Data Saved</h2>
<a href="/home" class="btn">Go Upload Excel</a>
</div>
`));
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<div class="card">
<h2>Upload Excel Files</h2>

<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br><br>
<input type="file" name="files"><br><br>
<button>Process</button>
</form>

<p>👉 Upload 1 file = WhatsApp vs Excel</p>
<p>👉 Upload 2 files = Full comparison</p>

</div>
`)));

// PROCESS (AUTO MODE)
app.post("/process", upload.array("files", 2), (req, res) => {

  if (!fs.existsSync("uploads/whatsapp.txt")) {
    return res.send(page(`<div class="card">❌ Add WhatsApp data first</div>`));
  }

  const files = req.files;

  if (!files || files.length === 0) {
    return res.send(page(`<div class="card">❌ Upload at least 1 file</div>`));
  }

  // 🔥 2 FILES
  if (files.length === 2) {
    exec(`python3 processor/compare_all.py ${files[0].path} ${files[1].path} uploads/whatsapp.txt`,
    (err, stdout, stderr) => {

      if (err) return res.send(page(`<div class="card">❌ ${stderr}</div>`));

      return res.send(page(`
        <div class="card">
          <h2>✅ Smart Processing Complete</h2>
          <p>✔ Mode: Excel + Excel + WhatsApp</p>

          <a href="/download" class="btn">📥 Download Excel</a>
          <a href="/dashboard" class="btn">📊 View Dashboard</a>
        </div>
      `));
    });
  }

  // 🔥 1 FILE
  else if (files.length === 1) {
    exec(`python3 processor/compare_single.py ${files[0].path} uploads/whatsapp.txt`,
    (err, stdout, stderr) => {

      if (err) return res.send(page(`<div class="card">❌ ${stderr}</div>`));

      return res.send(page(`
        <div class="card">
          <h2>✅ Smart Processing Complete</h2>
          <p>✔ Mode: Excel + WhatsApp</p>

          <a href="/download" class="btn">📥 Download Excel</a>
          <a href="/dashboard" class="btn">📊 View Dashboard</a>
        </div>
      `));
    });
  }

});

// DASHBOARD (COLOR CODED)
app.get("/dashboard",(req,res)=>{
if(!fs.existsSync("output/result.xlsx")) return res.redirect("/home");

const wb = xlsx.readFile("output/result.xlsx");
const data = xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"] || []);

const total = data.reduce((a,b)=>a+(b.Total||0),0);
const found = data.reduce((a,b)=>a+(b.Found||0),0);

res.send(page(`
<div class="card">
<h2>📊 Smart Dashboard</h2>

<div style="display:flex;gap:20px;margin-bottom:20px;">
  <div class="card" style="background:#0f7a2f;color:white;">
    Total<br><h2>${total}</h2>
  </div>
  <div class="card" style="background:#007bff;color:white;">
    Found<br><h2>${found}</h2>
  </div>
</div>

<table border="1" width="100%">
<tr>
<th>Agent</th>
<th>Van</th>
<th>Total</th>
<th>Found</th>
<th>Match %</th>
</tr>

${data.map(r=>{
let color = "#28a745";
if((r["Match %"]||0) < 80) color = "#dc3545";
else if((r["Match %"]||0) < 90) color = "#ffc107";

return `
<tr style="background:${color};color:white;">
<td>${r.Agent||"-"}</td>
<td>${r["Van Plate"]||"-"}</td>
<td>${r.Total||0}</td>
<td>${r.Found||0}</td>
<td>${r["Match %"]||0}%</td>
</tr>`;
}).join("")}

</table>

</div>
`));
});

// DOWNLOAD
app.get("/download",(req,res)=>{
  res.download("output/result.xlsx");
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

// START
app.listen(process.env.PORT || 10000, ()=>{
  console.log("Server running...");
});
