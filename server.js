console.log("ENTERPRISE AUTO EMAIL + VAN SYSTEM ✅");

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

// 🔥 EMAIL CONFIG (EDIT THIS)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password"
  }
});

// 🔥 AGENT EMAIL MAP
const agentEmails = {
  "agent1": "agent1@gmail.com",
  "agent2": "agent2@gmail.com"
};

// USERS
const USERS_FILE="users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { username: "admin", password: bcrypt.hashSync("admin123",10) }
  ]));
}

const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));

// UI
function page(c){
return `<html><body style="text-align:center;font-family:Arial;background:#0f7a2f;color:white;padding:50px">
<img src="/assets/logo.jpeg" width="140"><br><br>
<div style="background:white;color:black;padding:20px;width:500px;margin:auto;border-radius:10px">
${c}
</div></body></html>`;
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
</form>
`)));

app.post("/login",async(req,res)=>{
const u=getUsers().find(x=>x.username===req.body.username);
if(!u) return res.send("Invalid");
if(!(await bcrypt.compare(req.body.password,u.password))) return res.send("Invalid");
req.session.user=u;
res.redirect("/home");
});

// HOME
app.get("/home",(req,res)=>res.send(page(`
<h2>Upload</h2>
<form action="/process" method="post" enctype="multipart/form-data">
<input type="file" name="files"><br><br>
<input type="file" name="files"><br><br>
<button>Process</button>
</form>
<a href="/dashboard">Dashboard</a>
`)));

// 🔥 PROCESS + EMAIL
app.post("/process",upload.array("files",2),(req,res)=>{
exec(`python3 processor/compare.py ${req.files[0].path} ${req.files[1].path}`, async ()=>{

const file="output/result.xlsx";

const wb=xlsx.readFile(file);
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

for(const row of data){
const agent=row.Agent;

if(agentEmails[agent]){
await transporter.sendMail({
from:"your-email@gmail.com",
to:agentEmails[agent],
subject:"Your Report",
text:`Agent: ${agent}
Van: ${row["Van Plate"]}
Total: ${row.Total}
Duplicates: ${row.Duplicates}
Quality: ${row["Quality %"]}%`,
attachments:[{filename:"report.xlsx",path:file}]
});
}
}

res.send(page(`
<h2>Done + Emails Sent ✅</h2>
<a href="/download">Download Excel</a>
`));

});
});

// DOWNLOAD
app.get("/download",(req,res)=>{
res.download("output/result.xlsx");
});

// DASHBOARD (WITH VAN)
app.get("/dashboard",(req,res)=>{
const wb=xlsx.readFile("output/result.xlsx");
const data=xlsx.utils.sheet_to_json(wb.Sheets["Dashboard"]);

res.send(page(`
<h2>Dashboard</h2>

<table border="1" style="width:100%">
<tr><th>Agent</th><th>Van</th><th>Total</th><th>Dup</th><th>Quality</th></tr>
${data.map(r=>`
<tr>
<td>${r.Agent}</td>
<td>${r["Van Plate"]}</td>
<td>${r.Total}</td>
<td style="color:red">${r.Duplicates}</td>
<td>${r["Quality %"]}%</td>
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

app.listen(process.env.PORT||10000);
