import express from "express";


const app = express();
app.use(express.json());

app.get("/health", async (req, res) => {
    console.log("hello");
    res.json("hello");
})

app.listen(3000)