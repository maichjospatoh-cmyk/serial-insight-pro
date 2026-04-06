console.log("AUTOMATION SYSTEM READY ✅");

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

const USERS_FILE = "users.json";
const HISTORY_FILE = "history.json";

// INIT FILES
if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: hashed }
  ], null, 2));
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const getHistory = () => JSON.parse(fs.readFileSync(HISTORY_FILE));
const saveHistory = (h) => fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));

// UI
function page(content){
return `
<html>
<body style="text-align:center;font-family:Arial;background:linear-gradient(135deg,#0f7a2f,#28a745);color:black;padding-top:60px">
<img src="/assets/logo.jpeg" width="90"><br><br>
<div style="background:white;padding:20px;width:400px;margin:auto;border-radius:10px">
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
<input type="password" name="password"><br><br>
<button>Login</button>
</form>`)));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user) return res.send("Invalid");

if(!(await bcrypt.compare(req.body.password,user.password))) return res.send("Invalid");

req.session.user=user;
res.redirect("/home");
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files">
<input type="file" name="files"><br><br>
<button>Process</button>
</form>
<br>
<a href="/dashboard">Dashboard</a> |
<a href="/history">History</a> |
<a href="/logout">Logout</a>
`)));

// PROCESS + SAVE HISTORY
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{

const file="output/result.xlsx";
const data=xlsx.utils.sheet_to_json(xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]]);

const total=data.length;
const duplicates=data.filter(x=>x.duplicate_per_agent).length;

const record={
date:new Date().toISOString(),
total,
duplicates
};

const history=getHistory();
history.push(record);
saveHistory(history);

res.send(page(`
<h2>Processed ✅</h2>
<a href="/dashboard">View Dashboard</a>
`));
});
});

// DASHBOARD
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send("No data");

const data=xlsx.utils.sheet_to_json(xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]]);

const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

res.send(page(`
<h3>Dashboard</h3>
<pre>${JSON.stringify(map,null,2)}</pre>
<a href="/home">Back</a>
`));
});

// HISTORY PAGE
app.get("/history",(req,res)=>{
const history=getHistory().reverse();

res.send(page(`
<h3>History</h3>
<table border="1" style="margin:auto">
<tr><th>Date</th><th>Total</th><th>Duplicates</th></tr>
${history.map(h=>`
<tr>
<td>${h.date}</td>
<td>${h.total}</td>
<td style="color:red">${h.duplicates}</td>
</tr>
`).join("")}
</table>
<a href="/home">Back</a>
`));
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Running"));
