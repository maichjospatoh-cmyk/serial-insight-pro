console.log("ULTIMATE AI SYSTEM FINAL ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

// folders
["uploads","output","history"].forEach(f=>{
  if(!fs.existsSync(f)) fs.mkdirSync(f);
});

// session
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

app.get("/", (req,res)=>res.redirect("/login"));

// email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourgmail@gmail.com",
    pass: "your_app_password"
  }
});

// users
const USERS_FILE="users.json";
if(!fs.existsSync(USERS_FILE)){
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username:"admin", password:bcrypt.hashSync("admin123",10) }
  ],null,2));
}

const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));

// UI
function page(content){
return `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;font-family:Arial;display:flex;}
.sidebar{width:220px;background:#0f7a2f;color:white;height:100vh;padding:20px;position:fixed;}
.sidebar img{width:120px;margin:auto;display:block;margin-bottom:20px;}
.sidebar a{display:block;color:white;margin:10px 0;text-decoration:none;}
.main{margin-left:220px;padding:20px;width:100%;background:#f4f4f4;}
.card{background:white;padding:20px;border-radius:10px;margin-bottom:20px;}
.btn{background:#0f7a2f;color:white;padding:10px 15px;text-decoration:none;border-radius:6px;display:inline-block;margin:5px;}
@media(max-width:768px){.sidebar{position:relative;width:100%;height:auto;}.main{margin-left:0;}}
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
if(!u) return res.send("Invalid");
if(!(await bcrypt.compare(req.body.password,u.password))) return res.send("Invalid");
req.session.user=u;
res.redirect("/dashboard");
});

// dashboard
app.get("/dashboard",(req,res)=>{
if(!fs.existsSync("output/result.xlsx")) return res.redirect("/home");

const wb=xlsx.readFile("output/result.xlsx");
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

const total=data.reduce((a,b)=>a+b.Total,0);
const dup=data.reduce((a,b)=>a+b.Duplicates,0);

const labels=data.map(r=>r.Agent);
const values=data.map(r=>r.Total);

function color(q){
  if(q>=90) return "#28a745";
  if(q>=75) return "#ffc107";
  return "#dc3545";
}

res.send(page(`
<div class="card">
<h2>Dashboard</h2>

<canvas id="bar"></canvas><br>
<canvas id="pie"></canvas>

<script>
new Chart(bar,{type:"bar",data:{labels:${JSON.stringify(labels)},datasets:[{data:${JSON.stringify(values)}}]}});
new Chart(pie,{type:"pie",data:{labels:["Clean","Duplicates"],datasets:[{data:[${total-dup},${dup}]}]}});
</script>

<table border="1" width="100%">
<tr><th>Rank</th><th>Agent</th><th>Total</th><th>Dup</th><th>Quality</th><th>Status</th></tr>
${data.map(r=>`
<tr style="background:${color(r["Quality %"])};color:white;">
<td>${r.Rank}</td>
<td>${r.Agent}</td>
<td>${r.Total}</td>
<td>${r.Duplicates}</td>
<td>${r["Quality %"]}%</td>
<td>${r.Flag}</td>
</tr>`).join("")}
</table>
</div>
`));
});

// process
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,async()=>{

const filePath="output/result.xlsx";
const wb=xlsx.readFile(filePath);
const insights=xlsx.utils.sheet_to_json(wb.Sheets["Insights"]);

let text=insights.map(i=>"- "+i.Insights).join("\n");

await transporter.sendMail({
  from:"yourgmail@gmail.com",
  to:"receiver@email.com",
  subject:"Smart Report",
  text:text,
  attachments:[{path:filePath}]
});

res.send(page(`
<div class="card">
<h2>Done</h2>
<a href="/download" class="btn">Excel</a>
<a href="/download-pdf" class="btn">PDF</a>
<a href="/dashboard" class="btn">Dashboard</a>
</div>
`));

});
});

// download
app.get("/download",(req,res)=>res.download("output/result.xlsx"));

// PDF
app.get("/download-pdf",(req,res)=>{
const doc=new PDFDocument();
res.setHeader("Content-Type","application/pdf");
doc.pipe(res);

const wb=xlsx.readFile("output/result.xlsx");
const insights=xlsx.utils.sheet_to_json(wb.Sheets["Insights"]);

doc.text("AI REPORT");
doc.moveDown();

insights.forEach(i=>doc.text("- "+i.Insights));

doc.end();
});

// home
app.get("/home",(req,res)=>res.send(page(`
<div class="card">
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br><br>
<input type="file" name="files"><br><br>
<button>Process</button>
</form>
</div>
`)));

// logout
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
