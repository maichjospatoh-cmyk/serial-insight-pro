const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use(express.static("."));

// HOME PAGE
app.get("/", (req, res) => {
  res.send(`
    <div style="text-align:center;">
      <h2>Upload Reports</h2>

      <form action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="files" required><br><br>
        <input type="file" name="files" required><br><br>
        <button>Process</button>
      </form>
    </div>
  `);
});

// PROCESS FILES
app.post("/process", upload.array("files", 2), (req, res) => {
  const f1 = req.files[0].path;
  const f2 = req.files[1].path;

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  exec(`python3 processor/compare.py ${f1} ${f2}`, (err, stdout, stderr) => {
    if (err) return res.send(stderr);

    res.send(`
      <h2>Done ✅</h2>
      <a href="/download">Download Excel</a>
    `);
  });
});

// DOWNLOAD
app.get("/download", (req, res) => {
  const file = path.join(__dirname, "output", "result.xlsx");

  if (!fs.existsSync(file)) return res.send("File not found");

  res.download(file);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Running"));
