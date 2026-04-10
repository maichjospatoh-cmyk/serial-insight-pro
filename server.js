console.log("SYSTEM WITH HISTORY + CARDS ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// ensure folders
if (!fs.existsSync("history")) fs.mkdirSync("history");

// USERS
const USERS_FILE="users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10) }
  ]));
}
const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers=(u)=>fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2));

// UI
function page(content){
return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;font-family:Arial;display:flex;}
.sidebar{width:220px;background:#0f7a2f;color:white;height:100vh;padding:20px;position:fixed;}
.sidebar img{width:120px;margin:auto;display:block;margin-bottom:20px;}
.sidebar a{display:block;color:white;margin:12px 0;text-decoration:none;}
.main{margin-left:220px;padding:30px;width:100%;background:#f4f4f4;}
.card{background:white;padding:20px;border-radius:10px;margin-bottom:20px;}
.cards{display:flex;gap:20px;flex-wrap:wrap;}
.kpi{flex:1;background:#0f7a2f;color:white;padding:20px;border-radius:10px;}
</style>
</head>

<body>

<div class="sidebar">
<img src="/assets/logo.jpeg">
<a href="/dashboard">Dashboard</a>
<a href="/home">Upload</a>
<a href="/history">History</a>
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
if(!u) return res.send("Invalid");
if(!(await bcrypt.compare(req.body.password,u.password))) return res.send("Invalid");
req.session.user=u;
res.redirect("/dashboard");
});

// DASHBOARD WITH CARDS
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.redirect("/home");

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

const total=data.reduce((a,b)=>a+b.Total,0);
const dup=data.reduce((a,b)=>a+b.Duplicates,0);
const quality = total ? ((total-dup)/total*100).toFixed(1) : 0;

res.send(page(`
<div class="cards">
<div class="kpi">Total<br><h2>${total}</h2></div>
<div class="kpi">Duplicates<br><h2>${dup}</h2></div>
<div class="kpi">Quality<br><h2>${quality}%</h2></div>
</div>

<div class="card">
<h3>Agent Performance</h3>
<table border="1" width="100%">
<tr><th>Agent</th><th>Van</th><th>Total</th><th>Dup</th><th>Quality</th></tr>
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

// HISTORY PAGE
app.get("/history",(req,res)=>{
const files = fs.readdirSync("history");

res.send(page(`
<div class="card">
<h2>History</h2>
${files.map(f=>`
<a href="/history/${f}">${f}</a><br>
`).join("")}
</div>
`));
});

// VIEW HISTORY FILE
app.get("/history/:file",(req,res)=>{
res.download(path.join(__dirname,"history",req.params.file));
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<div class="card">
<h2>Upload Reports</h2>

<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files" required><br><br>
<input type="file" name="files" required><br><br>
<button>Process</button>
</form>
</div>
`)));

// PROCESS + SAVE HISTORY
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{

const timestamp = new Date().toISOString().replace(/[:.]/g,"-");
const newName = `history/report-${timestamp}.xlsx`;

fs.copyFileSync("output/result.xlsx", newName);

res.send(page(`
<div class="card">
<h2>Processing Complete</h2>

<a href="/download">Download Excel</a><br><br>
<a href="/download-pdf">Download PDF</a>
</div>
`));
});
});

// DOWNLOAD
app.get("/download",(req,res)=>res.download("output/result.xlsx"));

// PDF
app.get("/download-pdf",(req,res)=>{
const doc=new PDFDocument();
res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition","attachment; filename=report.pdf");
doc.pipe(res);
doc.fontSize(18).text("Serial Insight Report",{align:"center"});
doc.end();
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
