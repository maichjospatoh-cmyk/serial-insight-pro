const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("SERVER WORKING ✅");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Running"));
