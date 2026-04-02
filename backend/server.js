const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

// HOME PAGE
app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Serial Insight Pro</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0f5132, #198754);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }

        .container {
          background: white;
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
          width: 420px;
          text-align: center;
        }

        img {
          width: 140px;
          margin-bottom: 10px;
        }

        h2 {
          color: #0f5132;
          margin-bottom: 20px;
        }

        .upload-box {
          margin: 12px 0;
          text-align: left;
        }

        label {
          font-weight: bold;
          font-size: 14px;
        }

        input[type="file"] {
          width: 100%;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #ccc;
          margin-top: 5px;
        }

        button {
          margin-top: 20px;
          padding: 12px;
          width: 100%;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: bold;
        }

        button:hover {
          background: #b02a37;
        }
      </style>
    </head>

    <body>
      <div class="container">

        <img src="https://raw.githubusercontent.com/maichjospatoh-cmyk/serial-insight-pro/main/WhatsApp%20Image%202026-01-14%20at%2012.38.50.jpeg" style="display:block; margin:0 auto;" />

        <h2>LOC 7 Communications Limited</h2>

        <form action="/process" method="post" enctype="multipart/form-data">

          <div class="upload-box">
            <label>Upload Report 1</label>
            <input type="file" name="files" required />
          </div>

          <div class="upload-box">
            <label>Upload Report 2</label>
            <input type="file" name="files" required />
          </div>

          <button type="submit">Process Reports</button>

        </form>

<br/>

<a href="/download" style="text-decoration:none;">
  <button type="button">Download Excel</button>
</a>

      </div>
    </body>
    </html>
  `);
});

app.get("/process", (req, res) => {
  res.redirect("/");
});

// PROCESS
app.post("/process", upload.array("files"), (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    return res.send("Please upload at least 2 files");
  }

  exec(`python3 processor/compare.py ${files[0].path} ${files[1].path}`, (err) => {
    if (err) {
  console.error(err);
  return res.send("ERROR: " + err.message);
}

    res.sendFile(__dirname + "/../preview.html");
  });
});

app.get("/download", (req, res) => {
  res.download("output.xlsx");
});
app.listen(5000, () => console.log("Server running"));
