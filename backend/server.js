const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

// Home page (UPLOAD UI)
app.get("/", (req, res) => {
  res.send(`
    <h2>Serial Insight Pro</h2>
    <form action="/process" method="post" enctype="multipart/form-data">
      <input type="file" name="files" multiple required />
      <br/><br/>
      <button type="submit">Upload & Process</button>
    </form>
  `);
});

// Process files
app.post("/process", upload.array("files"), (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    return res.send("Please upload at least 2 files");
  }

  exec(`python3 processor/compare.py ${files[0].path} ${files[1].path}`, (err) => {
    if (err) {
      console.error(err);
      return res.send("Processing error");
    }

    res.download("output.xlsx");
  });
});

app.listen(5000, () => console.log("Server running"));
