console.log("ENTERPRISE SYSTEM WITH DASHBOARD + HISTORY ✅");

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

// ROOT
app.get("/", (req, res) => res.redirect("/login"));

// FILES
const USERS_FILE = "users.json";
const HISTORY_FILE = "history.json";

if (!fs.existsSync(USERS_FILE)) {
  const hashed = bcrypt.hashSync("admin123", 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([{ username: "admin", password: hashed }], null, 2));
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

const getHistory = () => JSON.parse(fs.readFileSync(HISTORY_FILE));
const saveHistory = (h) => fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));

// UI
function page(content){
return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
  width:520px;
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
  if(req.path === "/login") return next();
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

const ok=await bcrypt.compare(req.body.password,user.password);
if(!ok) return res.send(page("Invalid"));

req.session.user=user;
res.redirect("/home");
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload Reports</h2>

<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files" required>
<input type="file" name="files" required>
<button>Process</button>
</form>

<div class="nav">
<a href="/dashboard">Dashboard</a>
<a href="/history">History</a>
<a href="/change-password">Password</a>
<a href="/logout">Logout</a>
</div>
`)));

// PROCESS + SAVE HISTORY
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{

const file="output/result.xlsx";
const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const total=data.length;
const duplicates=data.filter(r=>r["duplicate_per_agent"]).length;

const record={
date:new Date().toISOString(),
total,
duplicates
};

const hist=getHistory();
hist.push(record);
saveHistory(hist);

res.send(page(`
<h2>Processed ✅</h2>
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

// DASHBOARD (WITH CHART)
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send(page("No data"));

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const map={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
map[a]=(map[a]||0)+1;
});

const labels=Object.keys(map);
const values=Object.values(map);

res.send(page(`
<h2>Dashboard</h2>

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
<a href="/home">Upload</a>
<a href="/logout">Logout</a>
</div>
`));
});

// HISTORY
app.get("/history",(req,res)=>{
const hist=getHistory().reverse();

res.send(page(`
<h2>History</h2>

<table border="1" style="width:100%">
<tr><th>Date</th><th>Total</th><th>Duplicates</th></tr>

${hist.map(h=>`
<tr>
<td>${h.date}</td>
<td>${h.total}</td>
<td style="color:red">${h.duplicates}</td>
</tr>
`).join("")}

</table>

<div class="nav">
<a href="/home">Back</a>
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

res.send(page("Updated ✅"));
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Server running"));
