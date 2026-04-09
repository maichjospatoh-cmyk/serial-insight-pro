console.log("ROLE-BASED SYSTEM (ADMIN + AGENT VIEW) ✅");

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

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10), role: "admin" }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

// UI
function page(content){
return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;font-family:Arial;background:linear-gradient(135deg,#0f7a2f,#28a745);}
.card{background:white;padding:40px;width:520px;margin:auto;margin-top:60px;border-radius:14px;text-align:center;}
.logo{width:140px;margin-bottom:15px;}
.nav a{margin:0 10px;color:#0f7a2f;font-weight:bold;text-decoration:none;}
input,select{width:90%;padding:10px;margin:10px;}
button{background:#0f7a2f;color:white;padding:10px;border:none;}
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
<input name="username">
<input type="password" name="password">
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

// DASHBOARD (FILTERED)
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send(page("No data"));

const wb=xlsx.readFile(file);
let data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// 🔥 FILTER FOR AGENTS
if(req.session.user.role==="agent"){
  data=data.filter(r=>r["agent name"]===req.session.user.username);
}

// GROUP
const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

// CHART DATA
const labels=Object.keys(map);
const values=Object.values(map);

res.send(page(`
<h2>Dashboard (${req.session.user.username})</h2>

<canvas id="chart"></canvas>

<script>
new Chart(document.getElementById("chart"),{
type:"bar",
data:{
labels:${JSON.stringify(labels)},
datasets:[{data:${JSON.stringify(values)}}]
}
});
</script>

<div class="nav">
${req.session.user.role==="admin" ? '<a href="/home">Upload</a><a href="/users">Users</a>' : ''}
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
<input type="file" name="files"><br>
<input type="file" name="files"><br>
<button>Process</button>
</form>
`));
});

// PROCESS
app.post("/process",upload.array("files",2),(req,res)=>{
if(req.session.user.role!=="admin") return res.send("Denied");

exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{
res.send(page(`<h2>Done ✅</h2><a href="/download">Download</a>`));
});
});

// DOWNLOAD
app.get("/download",(req,res)=>{
const file=path.join(__dirname,"output","result.xlsx");
if(!fs.existsSync(file)) return res.send(page("No file"));
res.download(file);
});

// USER MANAGEMENT
app.get("/users",(req,res)=>{
if(req.session.user.role!=="admin") return res.send("Denied");

const users=getUsers();

res.send(page(`
<h2>Users</h2>

<form method="post">
<input name="username" placeholder="Username">
<input name="password" placeholder="Password">
<select name="role">
<option value="agent">Agent</option>
<option value="admin">Admin</option>
</select>
<button>Create</button>
</form>

<pre>${JSON.stringify(users,null,2)}</pre>

<div class="nav">
<a href="/dashboard">Back</a>
</div>
`));
});

app.post("/users",async(req,res)=>{
const users=getUsers();

users.push({
username:req.body.username,
password:await bcrypt.hash(req.body.password,10),
role:req.body.role
});

saveUsers(users);

res.redirect("/users");
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Running"));
