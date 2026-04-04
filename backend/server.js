const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('.'));

// HOME
app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:50px;">
            <img src="/logo.jpeg" width="120"/><br><br>
            <h2>LOC 7 Communications Limited</h2>

            <form action="/process" method="post" enctype="multipart/form-data">
                <p>Upload Report 1</p>
                <input type="file" name="files" required /><br><br>

                <p>Upload Report 2</p>
                <input type="file" name="files" required /><br><br>

                <button type="submit" style="padding:10px 20px; background:green; color:white;">
                    Process Reports
                </button>
            </form>
        </div>
    `);
});

// PROCESS
app.post('/process', upload.array('files', 2), (req, res) => {
    const file1 = req.files[0].path;
    const file2 = req.files[1].path;

    if (!fs.existsSync('output')) {
        fs.mkdirSync('output');
    }

    exec(`python3 processor/compare.py ${file1} ${file2}`, (error, stdout, stderr) => {
        if (error) {
            return res.send(`<pre>${stderr}</pre>`);
        }

        res.send(`
            <div style="text-align:center;">
                <h2>Processing Complete ✅</h2>

                <a href="/download">
                    <button style="padding:10px 20px; background:green; color:white;">
                        Download Excel
                    </button>
                </a>

                <br><br>
                <pre>${stdout}</pre>
            </div>
        `);
    });
});

// DOWNLOAD
app.get('/download', (req, res) => {
    const filePath = path.join(__dirname, '..', 'output', 'result.xlsx');

    if (!fs.existsSync(filePath)) {
        return res.send("File not found ❌");
    }

    res.download(filePath);
});

// START
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
