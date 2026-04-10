console.log("AUTO EMAIL SYSTEM ACTIVE ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");

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

// EMAIL CONFIG (EDIT THIS)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password"
  }
});

// MAP USERS TO EMAILS
const agentEmails = {
  "agent1": "agent1@gmail.com",
  "agent2": "agent2@gmail.com"
};

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

// DASHBOARD
app.get("/dashboard",(req,res)=>{
res.send(page(`
<h2>Dashboard</h2>

<div class="nav">
<a href="/home">Upload</a>
<a href="/users">Users</a>
<a href="/logout">Logout</a>
</div>
`));
});

// HOME
app.get("/home",(req,res)=>{
if(req.session.user.role!=="admin") return res.send(page("Denied"));

res.send(page(`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br>
<input type="file" name="files"><br>
<button>Process</button>
</form>
`));
});

// 🔥 PROCESS + EMAIL
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,async()=>{

const file="output/result.xlsx";
const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// GROUP
const agentMap={};

data.forEach(r=>{
const a=r["agent name"]||"Unknown";

if(!agentMap[a]) agentMap[a]={total:0,duplicates:0};

agentMap[a].total++;
if(r["duplicate_per_agent"]) agentMap[a].duplicates++;
});

// SEND EMAILS
for(const agent in agentMap){

if(!agentEmails[agent]) continue;

const info=agentMap[agent];

await transporter.sendMail({
from:"your-email@gmail.com",
to:agentEmails[agent],
subject:"Your Performance Report",
text:`Hello ${agent}

Total Lines: ${info.total}
Duplicates: ${info.duplicates}

Keep improving!`
});

}

res.send(page(`
<h2>Processed & Emails Sent ✅</h2>
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

// USER MANAGEMENT
app.get("/users",(req,res)=>{
if(req.session.user.role!=="admin") return res.send("Denied");

const users=getUsers();

res.send(page(`
<h2>Users</h2>

<form method="post">
<input name="username">
<input name="password">
<select name="role">
<option value="agent">Agent</option>
<option value="admin">Admin</option>
</select>
<button>Create</button>
</form>

<pre>${JSON.stringify(users,null,2)}</pre>
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
