const multer = require("multer");
const { storage } = require("../utils/cloudinary");
const upload = multer({ storage });
const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { listingSchema } = require("../schema");
const { isLoggedIn, isOwner, isHost } = require("../middleware.js");
const Booking = require("../models/booking");


const axios = require("axios");



// VALIDATE LISTING
const validateListing = (req, res, next) => {

    // ⭐ multer multipart fix
    if (!req.body.listing) {
        req.body.listing = {
            title: req.body["listing[title]"],
            description: req.body["listing[description]"],
            price: req.body["listing[price]"],
            location: req.body["listing[location]"],
            country: req.body["listing[country]"],
            capacity: req.body["listing[capacity]"],
            roomPlans: req.body.roomPlans || []
        };
    }

    let { error } = listingSchema.validate(req.body);

    if (error) {
        throw new ExpressError(
            error.details.map(el => el.message).join(","),
            400
        );
    }
    next();
};


// INDEX
router.get("/", wrapAsync(async(req, res) => {
    const allListings = await Listing.find({ status: "approved" });
    res.render("listings/index", { allListings });
}));


// NEW
router.get("/new", isLoggedIn, isHost, (req, res) => {
    res.render("listings/new");
});



// MY LISTINGS PAGE
router.get("/my", isLoggedIn, async(req, res) => {

    const myListings = await Listing.find({
        owner: req.user._id
    });

    res.render("listings/myListings", { myListings });
});


// SEARCH LISTINGS
router.get("/search", async(req, res) => {

    const { title } = req.query;

    const listings = await Listing.find({
        title: { $regex: title, $options: "i" } // case insensitive search
    });

    res.render("listings/search", { listings, title });
});




router.get("/:id", wrapAsync(async(req, res) => {

    let { id } = req.params;

    let bookedDates = []; // ⭐ IMPORTANT (always defined)

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: { path: "author" }
        })
        .populate("owner").lean();

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    if (listing.status !== "approved" && (!req.user || req.user.role !== "admin")) {
        req.flash("error", "This listing is under review.");
        return res.redirect("/listings");
    }

    // ===== AVAILABILITY BADGE =====
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const unavailable = await Booking.findOne({
        listing: listing._id,

        paymentStatus: "Paid",
        fromDate: { $lte: now },
        toDate: { $gt: now }
    });

    // ===== BOOKED DATES =====
    const bookings = await Booking.find({
        listing: listing._id,
        status: "Confirmed"
    }).select("fromDate toDate");

    bookings.forEach(b => {
        let start = new Date(b.fromDate);
        let end = new Date(b.toDate);

        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
            bookedDates.push(d.toISOString().split("T")[0]);
        }
    });

    res.render("listings/show", { listing, unavailable, bookedDates });
}));


// CREATE
router.post("/", isLoggedIn, isHost, upload.single("image"), validateListing, wrapAsync(async(req, res) => {

    // ⭐ convert roomPlans price
    req.body.listing.roomPlans = req.body.listing.roomPlans.map(p => ({
        name: p.name,
        extraPrice: Number(p.extraPrice)
    }));

    // ⭐ IMAGE FIX (MAIN PART)
    const newListing = new Listing(req.body.listing);

    // Cloudinary upload image save
    newListing.image = {
        url: req.file.path,
        filename: req.file.filename
    };

    // ===== GEOCODING =====
    const address = req.body.listing.location + ", " + req.body.listing.country;

    const geoRes = await axios.get(
        "https://nominatim.openstreetmap.org/search", {
            params: {
                q: address,
                format: "json",
                limit: 1
            },
            headers: {
                "User-Agent": "college-project"
            }
        }
    );

    if (!geoRes.data.length) {
        req.flash("error", "Invalid location. Please enter correct address.");
        return res.redirect("/listings/new");
    }

    newListing.owner = req.user._id;
    newListing.status = "pending";

    newListing.geometry = {
        lat: Number(geoRes.data[0].lat),
        lng: Number(geoRes.data[0].lon)
    };

    await newListing.save();

    req.flash("success", "Listing submitted for review. It will be visible after admin approval.");
    res.redirect("/listings");
}));

// EDIT
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async(req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    res.render("listings/edit", { listing });
}));

router.put("/:id", isLoggedIn, isOwner, upload.single("image"), validateListing, wrapAsync(async(req, res) => {

    let { id } = req.params;

    // ⭐ roomPlans price number me convert
    req.body.listing.roomPlans = req.body.listing.roomPlans.map(p => ({
        name: p.name,
        extraPrice: Number(p.extraPrice)
    }));



    // ⭐ IMAGE UPDATE
    // ⭐ CLOUDINARY IMAGE UPDATE
    if (req.file) {
        req.body.listing.image = {
            url: req.file.path,
            filename: req.file.filename
        };
    }


    // ========= GEOCODING (LOCATION → COORDINATES) =========
    const address = req.body.listing.location + ", " + req.body.listing.country;

    const geoRes = await axios.get(
        "https://nominatim.openstreetmap.org/search", {
            params: {
                q: address,
                format: "json",
                limit: 1
            },
            headers: {
                "User-Agent": "college-project"
            }
        }
    );

    // ⭐ agar address galat hua
    if (!geoRes.data.length) {
        req.flash("error", "Invalid location. Please enter proper address.");
        return res.redirect(`/listings/${id}/edit`);
    }

    // ⭐ geometry update
    req.body.listing.geometry = {
        lat: Number(geoRes.data[0].lat),
        lng: Number(geoRes.data[0].lon)
    };

    // ⭐ admin ko dubara review ke liye
    req.body.listing.status = "pending";


    // ========= FINAL UPDATE =========
    await Listing.findByIdAndUpdate(id, req.body.listing, {
        runValidators: true,
        new: true
    });

    req.flash("success", "Listing updated and sent for admin review!");
    res.redirect(`/listings/${id}`);
}));




// DELETE
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async(req, res) => {

    let { id } = req.params;

    await Listing.findByIdAndDelete(id);

    req.flash("error", "Listing Deleted!");
    res.redirect("/listings");
}));




module.exports = router;