console.log("ENTERPRISE + HISTORY + EMAIL READY ✅");

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
app.use(express.static("."));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = "users.json";
const HISTORY_FILE = "history.json";

// INIT FILES
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed, role: "admin" }
  ], null, 2));
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

// HELPERS
const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

const getHistory = () => JSON.parse(fs.readFileSync(HISTORY_FILE));
const saveHistory = (h) => fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));

// UI
function layout(title, content, user=null){
return `
<html>
<head>
<title>${title}</title>
<style>
body{font-family:Arial;background:#f4f6f8;text-align:center}
.card{background:white;padding:20px;width:400px;margin:auto;border-radius:10px}
.nav a{margin:10px;color:green;font-weight:bold}
</style>
</head>
<body>
<img src="/logo.jpeg" width="100"/>
${user?`<h3>${user.username}</h3>`:""}
<div class="card">${content}</div>
${user?`<div class="nav">
<a href="/home">Upload</a>
<a href="/dashboard">Dashboard</a>
<a href="/history">History</a>
<a href="/logout">Logout</a>
</div>`:""}
</body></html>`;
}

// LOGIN FIRST
app.get("/", (req,res)=>!req.session.user?res.redirect("/login"):res.redirect("/home"));

// LOGIN
app.get("/login",(req,res)=>res.send(layout("Login",`
<h2>Login</h2>
<form method="post">
<input name="username"><input type="password" name="password">
<button>Login</button>
</form>`)));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user)return res.send("Invalid");
if(!(await bcrypt.compare(req.body.password,user.password)))return res.send("Invalid");
req.session.user=user;res.redirect("/home");
});

const auth=(req,res,next)=>!req.session.user?res.redirect("/login"):next();

// HOME
app.get("/home",auth,(req,res)=>res.send(layout("Upload",`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files" required>
<input type="file" name="files" required>
<button>Process</button>
</form>`,req.session.user)));

// PROCESS + SAVE HISTORY
app.post("/process",auth,upload.array("files",2),(req,res)=>{
const f1=req.files[0].path;
const f2=req.files[1].path;

if(!fs.existsSync("output"))fs.mkdirSync("output");

exec(`python3 processor/compare.py ${f1} ${f2}`,()=>{
const file="output/result.xlsx";
const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const summary={
date:new Date().toISOString(),
total:data.length,
duplicates:data.filter(x=>x.duplicate_per_agent).length
};

const hist=getHistory();
hist.push(summary);
saveHistory(hist);

res.send(layout("Done",`
<h2>Processed ✅</h2>
<a href="/download">Download</a>`,req.session.user));
});
});

// HISTORY PAGE
app.get("/history",auth,(req,res)=>{
const hist=getHistory().reverse();

res.send(layout("History",`
<h2>History</h2>
<table border="1" style="margin:auto">
<tr><th>Date</th><th>Total</th><th>Duplicates</th></tr>
${hist.map(h=>`
<tr>
<td>${h.date}</td>
<td>${h.total}</td>
<td style="color:red">${h.duplicates}</td>
</tr>`).join("")}
</table>
`,req.session.user));
});

// DASHBOARD
app.get("/dashboard",auth,(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file))return res.send("No data");

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

res.send(layout("Dashboard",`
<pre>${JSON.stringify(map,null,2)}</pre>
`,req.session.user));
});

// DOWNLOAD
app.get("/download",auth,(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file))return res.send("No file");
res.download(file);
});

// LOGOUT
app.get("/logout",(req,res)=>{req.session.destroy();res.redirect("/login")});

app.listen(process.env.PORT||10000,()=>console.log("Running"));
