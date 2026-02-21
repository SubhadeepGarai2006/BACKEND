const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { isAdmin, isLoggedIn } = require("../middleware.js");
const Listing = require("../models/listing");
const Booking = require("../models/booking");


// ADMIN DASHBOARD
router.get("/dashboard", isLoggedIn, isAdmin, async(req, res) => {
    const hosts = await User.find({ role: "host" });
    res.render("admin/dashboard", { hosts });
});


// BLOCK HOST
router.put("/block/:id", isLoggedIn, isAdmin, async(req, res) => {
    await User.findByIdAndUpdate(req.params.id, { blocked: true });
    req.flash("success", "Host account blocked");
    res.redirect("/admin/dashboard");
});


// MODERATION
router.get("/moderation", isLoggedIn, isAdmin, async(req, res) => {
    const listings = await Listing.find({ status: "pending" }).populate("owner");
    res.render("admin/moderation", { listings });
});

router.put("/approve/:id", isLoggedIn, isAdmin, async(req, res) => {
    await Listing.findByIdAndUpdate(req.params.id, { status: "approved" });
    req.flash("success", "Listing approved");
    res.redirect("/admin/moderation");
});

router.put("/reject/:id", isLoggedIn, isAdmin, async(req, res) => {
    await Listing.findByIdAndUpdate(req.params.id, { status: "rejected" });
    req.flash("error", "Listing rejected");
    res.redirect("/admin/moderation");
});


// VIEW BOOKINGS
router.get("/bookings", isLoggedIn, isAdmin, async(req, res) => {

    let bookings = await Booking.find({})
        .populate({
            path: "listing",
            populate: { path: "owner" }
        })
        .populate("user")
        .lean();

    // safety if listing deleted
    bookings = bookings.map(b => {
        if (!b.listing) {
            b.listing = {
                title: "Listing Removed",
                location: "N/A",
                country: "",
                image: { url: "https://images.unsplash.com/photo-1566073771259-6a8506099945" },
                owner: { email: "Host Deleted" }
            };
        }
        return b;
    });

    res.render("admin/bookings", { bookings });
});





module.exports = router;