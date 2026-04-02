const express = require("express");
const multer = require("multer");
const path = require("path");
const { exec } = require("child_process");

const app = express();

// ✅ Serve static files (logo, HTML, etc.)
app.use(express.static(path.join(__dirname, "..")));

// ✅ Multer setup (file uploads)
const upload = multer({ dest: "uploads/" });

// ✅ Home route (loads your HTML)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

// ✅ Process route
app.post("/process", upload.array("files"), (req, res) => {
    try {
        const files = req.files;

        if (!files || files.length < 2) {
            return res.status(400).send("Please upload at least 2 files");
        }

        exec(
            `python3 processor/compare.py ${files[0].path} ${files[1].path}`,
            (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Processing error: " + err.message);
                }

                res.sendFile(path.join(__dirname, "..", "preview.html"));
            }
        );

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ✅ Download route (for Excel output)
app.get("/download", (req, res) => {
    const filePath = path.join(__dirname, "..", "preview.xlsx");
    res.download(filePath);
});

// ✅ Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
