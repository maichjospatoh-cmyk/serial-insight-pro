console.log("MULTI-USER SYSTEM ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

app.get("/", (req,res)=>res.redirect("/login"));

const USERS_FILE = "users.json";

// DEFAULT USERS
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10), role: "admin" },
    { username: "agent1", password: bcrypt.hashSync("1234",10), role: "agent" }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));

// UI
function page(content){
return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;font-family:Arial;background:linear-gradient(135deg,#0f7a2f,#28a745);}
.card{background:white;padding:40px;width:520px;margin:auto;margin-top:80px;border-radius:14px;text-align:center;}
.logo{width:140px;margin-bottom:15px;}
.nav a{margin:0 10px;color:#0f7a2f;font-weight:bold;text-decoration:none;}
</style>
</head>
<body>
<div class="card">
<img src="/assets/logo.jpeg" class="logo"/>
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
app.get("/login",(req,res)=>res.send(page(`
<h2>Login</h2>
<form method="post">
<input name="username"><br><br>
<input name="password" type="password"><br><br>
<button>Login</button>
</form>
`)));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user) return res.send(page("Invalid"));

if(!(await bcrypt.compare(req.body.password,user.password))) return res.send(page("Invalid"));

req.session.user=user;
res.redirect("/dashboard");
});

// DASHBOARD (ROLE BASED)
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send(page("No data"));

const wb=xlsx.readFile(file);
let data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// 🔥 FILTER FOR AGENT
if(req.session.user.role==="agent"){
  data=data.filter(r=>r["agent name"]===req.session.user.username);
}

const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

res.send(page(`
<h2>Dashboard (${req.session.user.role})</h2>
<pre>${JSON.stringify(map,null,2)}</pre>

<div class="nav">
<a href="/home">Upload</a>
<a href="/logout">Logout</a>
</div>
`));
});

// HOME (ADMIN ONLY)
app.get("/home",(req,res)=>{
if(req.session.user.role!=="admin") return res.send(page("Access denied"));

res.send(page(`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br><br>
<input type="file" name="files"><br><br>
<button>Process</button>
</form>

<div class="nav">
<a href="/dashboard">Dashboard</a>
<a href="/logout">Logout</a>
</div>
`));
});

// PROCESS (ADMIN ONLY)
app.post("/process",upload.array("files",2),(req,res)=>{
if(req.session.user.role!=="admin") return res.send("Denied");

exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{
res.send(page(`
<h2>Done ✅</h2>
<a href="/download">Download</a>
`));
});
});

// DOWNLOAD
app.get("/download",(req,res)=>{
const file=path.join(__dirname,"output","result.xlsx");
if(!fs.existsSync(file)) return res.send(page("No file"));
res.download(file);
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Running"));
