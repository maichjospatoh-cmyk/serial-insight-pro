console.log("ULTIMATE SYSTEM (EMAIL + MOBILE + ROLES) ✅");

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

if (!fs.existsSync("history")) fs.mkdirSync("history");

// EMAIL SETUP (PUT YOUR EMAIL)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "maichjospatoh@gmail.com",
    pass: "admin123"
  }
});

// USERS
const USERS_FILE="users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10), role:"admin" }
  ], null, 2));
}

const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers=(u)=>fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2));

function isAdmin(req){
  return req.session.user?.role === "admin";
}

// UI
function page(content){
return `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{margin:0;font-family:Arial;display:flex;}

.sidebar{
  width:240px;
  background:#0f7a2f;
  color:white;
  height:100vh;
  padding:20px;
  position:fixed;
}

.sidebar img{
  width:140px;
  display:block;
  margin:auto;
  margin-bottom:20px;
}

.sidebar a{
  display:block;
  color:white;
  margin:12px 0;
  text-decoration:none;
  font-size:18px;
}

.main{
  margin-left:240px;
  padding:20px;
  width:100%;
  background:#f4f4f4;
}

.card{
  background:white;
  padding:20px;
  border-radius:12px;
  margin-bottom:20px;
}

.cards{
  display:flex;
  gap:20px;
  flex-wrap:wrap;
}

.kpi{
  flex:1;
  background:#0f7a2f;
  color:white;
  padding:20px;
  border-radius:12px;
  text-align:center;
}

.toast{
  position:fixed;
  top:20px;
  right:20px;
  background:#28a745;
  color:white;
  padding:15px;
  border-radius:8px;
}

/* MOBILE */
@media(max-width:768px){
  .sidebar{
    position:relative;
    width:100%;
    height:auto;
  }
  .main{
    margin-left:0;
  }
  .cards{
    flex-direction:column;
  }
}
</style>
</head>

<body>

<div class="sidebar">
<img src="/assets/logo.jpeg">
<a href="/dashboard">Dashboard</a>
<a href="/home">Upload</a>
${global.user?.role==="admin" ? `<a href="/users">Users</a>` : ``}
<a href="/email">Email</a>
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
  global.user=req.session.user;
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

if(!(await bcrypt.compare(req.body.password,u.password)))
  return res.send("Invalid");

req.session.user=u;
res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.redirect("/home");

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

const total=data.reduce((a,b)=>a+b.Total,0);
const dup=data.reduce((a,b)=>a+b.Duplicates,0);
const quality=((total-dup)/total*100||0).toFixed(1);

const labels=data.map(r=>r.Agent);
const values=data.map(r=>r.Total);

res.send(page(`
<div class="cards">
<div class="kpi"><h3>Total</h3><h1>${total}</h1></div>
<div class="kpi"><h3>Duplicates</h3><h1>${dup}</h1></div>
<div class="kpi"><h3>Quality</h3><h1>${quality}%</h1></div>
</div>

<div class="card">
<canvas id="chart"></canvas>
</div>

<script>
new Chart(document.getElementById("chart"),{
type:"bar",
data:{labels:${JSON.stringify(labels)},datasets:[{data:${JSON.stringify(values)}}]}
});
</script>
`));
});

// EMAIL PAGE
app.get("/email",(req,res)=>{
res.send(page(`
<div class="card">
<h2>Email Report</h2>
<p>Email will be sent automatically after processing</p>
</div>
`));
});

// USERS
app.get("/users",(req,res)=>{
if(!isAdmin(req)) return res.send("Access denied");

const users=getUsers();

res.send(page(`
<div class="card">
<h2>Users</h2>

<form method="post">
<input name="username"><br><br>
<input name="password" type="password"><br><br>
<select name="role">
<option value="agent">Agent</option>
<option value="admin">Admin</option>
</select><br><br>
<button>Add</button>
</form>

<hr>

${users.map(u=>`${u.username} (${u.role})<br>`).join("")}
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

// PROCESS + EMAIL + HISTORY
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, async ()=>{

const timestamp=new Date().toISOString().replace(/[:.]/g,"-");
const filePath=`history/report-${timestamp}.xlsx`;

fs.copyFileSync("output/result.xlsx",filePath);

// SEND EMAIL
try{
await transporter.sendMail({
  from:"yourgmail@gmail.com",
  to:"receiver@email.com",
  subject:"Daily Serial Report",
  text:"Attached report",
  attachments:[{path:filePath}]
});
}catch(e){
console.log("Email failed",e);
}

res.send(page(`
<div class="toast">Report processed & email sent</div>

<div class="card">
<h2>Done</h2>
<a href="/dashboard">Go Dashboard</a>
</div>
`));
});
});

// HOME
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

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
