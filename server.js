console.log("ENTERPRISE SYSTEM WITH EMAIL ✅");

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

// 🔐 EMAIL CONFIG (CHANGE THIS)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password"
  }
});

// 👇 MAP YOUR AGENTS HERE
const agentEmails = {
  "Agent1": "agent1@gmail.com",
  "Agent2": "agent2@gmail.com"
};

const USERS_FILE = "users.json";

if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

// 🎨 UI
function page(content){
return `
<html>
<head>
<style>
body{
  margin:0;
  font-family:Arial;
  background: linear-gradient(135deg,#0f7a2f,#28a745,#0f7a2f);
  display:flex;
  align-items:center;
  justify-content:center;
  height:100vh;
}
.card{
  background:white;
  padding:40px;
  width:500px;
  border-radius:14px;
  text-align:center;
}
.logo{width:150px;margin-bottom:20px;}
input{width:95%;padding:12px;margin:10px 0;}
button{background:#0f7a2f;color:white;padding:12px;border:none;}
.nav a{font-size:18px;margin:0 10px;color:#0f7a2f;font-weight:bold;text-decoration:none;}
.download-btn{display:inline-block;margin-top:10px;padding:10px;background:#0f7a2f;color:white;}
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
<input name="password" type="password">
<button>Login</button>
</form>
`)));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user) return res.send(page("Invalid"));

if(!(await bcrypt.compare(req.body.password,user.password))) return res.send(page("Invalid"));

req.session.user=user;
res.redirect("/home");
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload Reports</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files">
<input type="file" name="files">
<button>Process</button>
</form>

<div class="nav">
<a href="/dashboard">Dashboard</a>
<a href="/change-password">Password</a>
<a href="/logout">Logout</a>
</div>
`)));

// 🔥 PROCESS + EMAIL
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,async()=>{

const file="output/result.xlsx";
const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

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
subject:"Performance Report",
text:`Agent: ${agent}

Total Lines: ${info.total}
Duplicates: ${info.duplicates}`
});
}

res.send(page(`
<h2>Processed & Emails Sent ✅</h2>
<a href="/download" class="download-btn">Download Excel</a>
`));

});
});

// DOWNLOAD
app.get("/download",(req,res)=>{
const file=path.join(__dirname,"output","result.xlsx");
if(!fs.existsSync(file)) return res.send(page("No file"));
res.download(file);
});

// DASHBOARD
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send(page("No data"));

const data=xlsx.utils.sheet_to_json(xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]]);

const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

res.send(page(`
<h2>Dashboard</h2>
<pre>${JSON.stringify(map,null,2)}</pre>

<div class="nav">
<a href="/home">Upload</a>
<a href="/logout">Logout</a>
</div>
`));
});

// CHANGE PASSWORD
app.get("/change-password",(req,res)=>res.send(page(`
<h2>Change Password</h2>
<form method="post">
<input name="oldPassword" type="password">
<input name="newPassword" type="password">
<button>Update</button>
</form>
`)));

app.post("/change-password",async(req,res)=>{
const users=getUsers();
const i=users.findIndex(u=>u.username===req.session.user.username);

const match=await bcrypt.compare(req.body.oldPassword,users[i].password);
if(!match) return res.send(page("Wrong password"));

users[i].password=await bcrypt.hash(req.body.newPassword,10);
saveUsers(users);

res.send(page("Updated"));
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Server running"));
