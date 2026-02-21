const express = require("express");
const router = express.Router();
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { isLoggedIn, isHost } = require("../middleware.js");


router.get("/dashboard", isLoggedIn, isHost, async(req, res) => {

    const listings = await Listing.find({ owner: req.user._id });

    const bookings = await Booking.find({
            listing: { $in: listings.map(l => l._id) }
        })
        .populate("listing")
        .populate({
            path: "user",
            select: "email username"
        });

    res.render("host/dashboard", { bookings });
});


// cancel booking
router.delete("/booking/:bookingId", isLoggedIn, isHost, async(req, res) => {
    try {

        const booking = await Booking.findById(req.params.bookingId).populate("listing");

        if (!booking) {
            req.flash("error", "Booking not found");
            return res.redirect("/host/dashboard");
        }

        if (!booking.listing.owner.equals(req.user._id)) {
            req.flash("error", "Unauthorized action");
            return res.redirect("/host/dashboard");
        }

        await Booking.findByIdAndDelete(req.params.bookingId);

        req.flash("success", "Booking removed successfully");
        res.redirect("/host/dashboard");

    } catch (err) {
        console.log(err);
        req.flash("error", "Cannot remove booking");
        res.redirect("/host/dashboard");
    }
});

module.exports = router;