const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");

const app = express();

// Upload config
const upload = multer({ dest: "uploads/" });

// Serve static files (index.html, logo, etc.)
app.use(express.static(path.join(__dirname, "..")));

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Process route
app.post("/process", upload.array("files"), (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    return res.send("Please upload at least 2 files");
  }

  exec(
    `python3 processor/compare.py ${files[0].path} ${files[1].path}`,
    (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return res.send("Processing error: " + stderr);
      }

      res.sendFile(path.join(__dirname, "..", "preview.html"));
    }
  );
});

// ✅ DOWNLOAD ROUTE (FIXED)
app.get("/download", (req, res) => {
  const filePath = path.join(__dirname, "..", "output.xlsx");

  res.download(filePath, "result.xlsx", (err) => {
    if (err) {
      console.error(err);
      res.status(500).send("File not found");
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
