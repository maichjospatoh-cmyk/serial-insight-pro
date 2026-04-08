console.log("FINAL SYSTEM WITH ROOT FIX ✅");

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

// 🔥 ROOT FIX (VERY IMPORTANT)
app.get("/", (req, res) => {
  res.redirect("/login");
});

// EMAIL CONFIG (EDIT THESE)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password"
  }
});

// AGENT EMAILS
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
button{background:#0f7a2f;color
