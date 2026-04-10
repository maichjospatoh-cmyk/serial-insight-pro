console.log("FINAL ENTERPRISE UI SYSTEM ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");

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
app.get("/", (req,res)=>res.redirect("/login"));

// USERS
const USERS_FILE="users.json";

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10) }
  ], null, 2));
}

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));

// 🔥 UI WITH SIDEBAR
function page(content){
return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{
  margin:0;
  font-family:Arial;
  display:flex;
}

/* SIDEBAR */
.sidebar{
  width:220px;
  background:#0f7a2f;
  color:white;
  height:100vh;
  padding:20px;
  position:fixed;
}

.sidebar img{
  width:120px;
  display:block;
  margin:auto;
  margin-bottom:20px;
}

.sidebar a{
  display:block;
  color:white;
  text-decoration:none;
  margin:15px 0;
  font-size:18px;
}

/* MAIN */
.main{
  margin-left:220px;
  padding:30px;
  width:100%;
  background:#f4f4f4;
  min-height:100vh;
}

.card{
  background:white;
  padding:25px;
  border-radius:10px;
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
}
</style>
</head>

<body>

<div class="sidebar">
<img src="/assets/logo.jpeg">

<a href="/dashboard">📊 Dashboard</a>
<a href="/home">⬆ Upload</a>
<a href="/change-password">🔒 Password</a>
<a href="/logout">🚪 Logout</a>
</div>

<div class="main">
<div class="card">
${content}
</div>
</div>

</body>
</html>
`;
}

// AUTH
app.use((req,res,next)=>{
  if(req.path==="/login") return next();
  if(!req.session.user) return res.redirect("/login");
  next();
});

// LOGIN (simple page)
app.get("/login",(req,res)=>res.send(`
<html>
<body style="font-family:Arial;background:#0f7a2f;text-align:center;padding-top:100px">
<img src="/assets/logo.jpeg" width="150"><br><br>

<div style="background:white;padding:30px;width:300px;margin:auto;border-radius:10px">
<h2>Login</h2>
<form method="post">
<input name="username"><br><br>
<input name="password" type="password"><br><br>
<button>Login</button>
</form>
</div>

</body>
</html>
`));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user) return res.send("Invalid login");

const ok=await bcrypt.compare(req.body.password,user.password);
if(!ok) return res.send("Invalid login");

req.session.user=user;
res.redirect("/dashboard");
});

// DASHBOARD (AUTO REDIRECT IF NO DATA)
app.get("/dashboard",(req,res)=>{
const file="output/result.xlsx";

if(!fs.existsSync(file)){
  return res.redirect("/home");
}

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const total=data.length;
const duplicates=data.filter(r=>r["duplicate_per_agent"]).length;
const clean=total-duplicates;
const quality = total ? ((clean/total)*100).toFixed(1) : 0;

const agentMap={};

data.forEach(r=>{
  const a=r["agent name"]||"Unknown";
  if(!agentMap[a]) agentMap[a]={total:0,dup:0};
  agentMap[a].total++;
  if(r["duplicate_per_agent"]) agentMap[a].dup++;
});

const ranking = Object.entries(agentMap).map(([name,val])=>{
  const score = val.total ? ((val.total-val.dup)/val.total)*100 : 0;
  return {name,score:score.toFixed(1)};
}).sort((a,b)=>b.score-a.score);

const labels=Object.keys(agentMap);
const values=Object.values(agentMap).map(v=>v.total);

res.send(page(`
<h2>Executive Dashboard</h2>

<h3>Total: ${total}</h3>
<h3 style="color:red">Duplicates: ${duplicates}</h3>
<h3 style="color:green">Quality: ${quality}%</h3>

<h3>Top Agent: ${ranking[0]?.name || "N/A"}</h3>

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

<h3>Ranking</h3>
${ranking.map(r=>`${r.name} - ${r.score}%`).join("<br>")}
`));
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload Reports</h2>

<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files" required><br><br>
<input type="file" name="files" required><br><br>
<button>Process</button>
</form>
`)));

// PROCESS
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`,()=>{
res.send(page(`
<h2>Processing Complete</h2>

<a href="/download">Download Excel</a><br><br>
<a href="/download-pdf">Download PDF Report</a>
`));
});
});

// DOWNLOAD EXCEL
app.get("/download",(req,res)=>{
res.download("output/result.xlsx");
});

// DOWNLOAD PDF
app.get("/download-pdf",(req,res)=>{
const file="output/result.xlsx";
if(!fs.existsSync(file)) return res.send("No data");

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const total=data.length;
const duplicates=data.filter(r=>r["duplicate_per_agent"]).length;
const clean=total-duplicates;
const quality = total ? ((clean/total)*100).toFixed(1) : 0;

const agentMap={};
data.forEach(r=>{
const a=r["agent name"]||"Unknown";
if(!agentMap[a]) agentMap[a]={total:0,dup:0};
agentMap[a].total++;
if(r["duplicate_per_agent"]) agentMap[a].dup++;
});

const ranking = Object.entries(agentMap).map(([name,val])=>{
const score = val.total ? ((val.total-val.dup)/val.total)*100 : 0;
return {name,score:score.toFixed(1)};
}).sort((a,b)=>b.score-a.score);

const doc = new PDFDocument();

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition","attachment; filename=report.pdf");

doc.pipe(res);

doc.fontSize(18).text("Serial Insight Report",{align:"center"});
doc.moveDown();

doc.text(`Total: ${total}`);
doc.text(`Duplicates: ${duplicates}`);
doc.text(`Quality: ${quality}%`);

doc.moveDown();
doc.text("Agent Ranking:");

ranking.forEach(r=>{
doc.text(`${r.name} - ${r.score}%`);
});

doc.end();
});

// CHANGE PASSWORD
app.get("/change-password",(req,res)=>res.send(page(`
<h2>Change Password</h2>
<form method="post">
<input name="oldPassword" type="password"><br><br>
<input name="newPassword" type="password"><br><br>
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

res.send(page("Password updated"));
});

// LOGOUT
app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000);
