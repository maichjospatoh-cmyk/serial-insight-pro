console.log("AUTO DAILY SYSTEM ACTIVE ✅");

const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

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

// EMAIL CONFIG
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password"
  }
});

const agentEmails = {
  "agent1": "agent1@gmail.com",
  "agent2": "agent2@gmail.com"
};

// AUTO PROCESS FUNCTION
async function runAutoProcess(){

  console.log("Running scheduled job...");

  const file1="auto/file1.xlsx";
  const file2="auto/file2.xlsx";

  if(!fs.existsSync(file1) || !fs.existsSync(file2)){
    console.log("Auto files missing");
    return;
  }

  exec(`python3 processor/compare.py ${file1} ${file2}`, async ()=>{

    const wb=xlsx.readFile("output/result.xlsx");
    const data=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const agentMap={};

    data.forEach(r=>{
      const a=r["agent name"]||"Unknown";
      if(!agentMap[a]) agentMap[a]={total:0,duplicates:0};
      agentMap[a].total++;
      if(r["duplicate_per_agent"]) agentMap[a].duplicates++;
    });

    for(const agent in agentMap){
      if(!agentEmails[agent]) continue;

      const info=agentMap[agent];

      await transporter.sendMail({
        from:"your-email@gmail.com",
        to:agentEmails[agent],
        subject:"Daily Report",
        text:`Agent: ${agent}

Total: ${info.total}
Duplicates: ${info.duplicates}`
      });
    }

    console.log("Emails sent");
  });
}

// 🔥 RUN EVERY DAY AT 18:00
cron.schedule("0 18 * * *", runAutoProcess);

// UI
function page(content){
return `
<html>
<body style="text-align:center;font-family:Arial;background:linear-gradient(135deg,#0f7a2f,#28a745);padding-top:80px">
<img src="/assets/logo.jpeg" width="120"><br><br>
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
const USERS_FILE="users.json";
if(!fs.existsSync(USERS_FILE)){
fs.writeFileSync(USERS_FILE,JSON.stringify([
{username:"admin",password:bcrypt.hashSync("admin123",10),role:"admin"}
]));
}

const getUsers=()=>JSON.parse(fs.readFileSync(USERS_FILE));

app.get("/login",(req,res)=>res.send(page(`
<h2>Login</h2>
<form method="post">
<input name="username"><br><br>
<input type="password" name="password"><br><br>
<button>Login</button>
</form>
`)));

app.post("/login",async(req,res)=>{
const user=getUsers().find(u=>u.username===req.body.username);
if(!user) return res.send("Invalid");

if(!(await bcrypt.compare(req.body.password,user.password))) return res.send("Invalid");

req.session.user=user;
res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard",(req,res)=>res.send(page(`
<h2>System Running Automatically ✅</h2>

<p>No manual upload needed</p>

<a href="/logout">Logout</a>
`)));

app.get("/logout",(req,res)=>{
req.session.destroy(()=>res.redirect("/login"));
});

app.listen(process.env.PORT||10000,()=>console.log("Running"));
