const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware.js");

router.get("/terms", isLoggedIn, (req, res) => {
    res.render("static/terms");
});

router.get("/privacy", isLoggedIn, (req, res) => {
    res.render("static/privacy");
});

module.exports = router;