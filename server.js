console.log("ENTERPRISE SYSTEM WITH FILTERS + DB + PDF ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// 🔥 CONNECT MONGODB
mongoose.connect("mongodb://127.0.0.1:27017/serialDB");

const RecordSchema = new mongoose.Schema({
  agent: String,
  van: String,
  total: Number,
  duplicates: Number,
  date: { type: Date, default: Date.now }
});

const Record = mongoose.model("Record", RecordSchema);

// ROOT
app.get("/", (req,res)=>res.redirect("/login"));

// USERS
const USERS_FILE="users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10) }
  ]));
}

const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));

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
.sidebar a{display:block;color:white;margin:10px 0;text-decoration:none;}
.main{margin-left:220px;padding:30px;width:100%;background:#f4f4f4;}
.card{background:white;padding:20px;border-radius:10px;}
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
<div class="card">
${content}
</div>
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

// 🔥 DASHBOARD WITH FILTERS
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.redirect("/home");

const wb=xlsx.readFile(file);
let data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

// FILTERS
const agent=req.query.agent;
const van=req.query.van;

if(agent) data=data.filter(r=>r.Agent===agent);
if(van) data=data.filter(r=>r["Van Plate"]===van);

// DROPDOWNS
const agents=[...new Set(data.map(r=>r.Agent))];
const vans=[...new Set(data.map(r=>r["Van Plate"]))];

res.send(page(`
<h2>Dashboard</h2>

<form>
<select name="agent">
<option value="">All Agents</option>
${agents.map(a=>`<option>${a}</option>`).join("")}
</select>

<select name="van">
<option value="">All Vans</option>
${vans.map(v=>`<option>${v}</option>`).join("")}
</select>

<button>Filter</button>
</form>

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
`));
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br><br>
<input type="file" name="files"><br><br>
<button>Process</button>
</form>
`)));

// 🔥 PROCESS + SAVE TO DB
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, async ()=>{

const wb=xlsx.readFile("output/result.xlsx");
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

for(const r of data){
await Record.create({
agent:r.Agent,
van:r["Van Plate"],
total:r.Total,
duplicates:r.Duplicates
});
}

res.send(page(`
<h2>Done</h2>
<a href="/download">Excel</a><br>
<a href="/download-pdf">PDF</a>
`));

});
});

// DOWNLOAD
app.get("/download",(req,res)=>res.download("output/result.xlsx"));

// 🔥 PDF WITH LOGO
app.get("/download-pdf",(req,res)=>{
const doc=new PDFDocument();

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition","attachment; filename=report.pdf");

doc.pipe(res);

doc.image("logo.jpeg",200,20,{width:100});

doc.moveDown(3);
doc.fontSize(20).text("Serial Insight Report",{align:"center"});

doc.moveDown();
doc.text("Professional Summary");

doc.end();
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
