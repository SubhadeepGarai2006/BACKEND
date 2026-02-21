const express = require("express");
const router = express.Router();

const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { isLoggedIn } = require("../middleware");

const razorpay = require("../utils/razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");



// ================= MY BOOKINGS =================
router.get("/my-bookings", isLoggedIn, async(req, res) => {
    try {

        const bookings = await Booking.find({ user: req.user._id })
            .populate("listing") // ⭐ VERY IMPORTANT
            .lean();



        res.render("bookings/myBookings", { bookings });

    } catch (err) {
        console.log("MY BOOKING ERROR:", err);
        req.flash("error", "Something went wrong");
        res.redirect("/listings");
    }
});


// ================= CREATE RAZORPAY ORDER =================
// ================= CREATE RAZORPAY ORDER =================
router.post("/create-order/:id", isLoggedIn, async(req, res) => {
    try {

        if (!req.session.bookingData) {
            return res.status(400).json({ error: "Session expired" });
        }

        const options = {
            amount: Math.round(Number(req.session.bookingData.totalPrice) * 100),
            currency: "INR",
            receipt: "booking_" + Date.now(),

            // ⭐ STORE BOOKING INFO INSIDE RAZORPAY
            notes: {
                listingId: req.session.bookingData.listingId.toString(),
                userId: req.user._id.toString(),
                fromDate: req.session.bookingData.fromDate,
                toDate: req.session.bookingData.toDate,
                guests: req.session.bookingData.guests,
                roomPlan: req.session.bookingData.selectedPlan,
                basePrice: req.session.bookingData.basePrice,
                platformFee: req.session.bookingData.platformFee,
                gst: req.session.bookingData.gst,
                totalPrice: req.session.bookingData.totalPrice
            }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            id: order.id,
            amount: order.amount
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Order creation failed" });
    }
});



// ================= VERIFY PAYMENT =================
// ================= VERIFY PAYMENT =================
router.post("/verify-payment", async(req, res) => {
    try {

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // 1️⃣ verify signature
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            console.log("Signature mismatch");
            return res.json({ success: false });
        }

        // 2️⃣ Fetch Razorpay order (THIS FIXES EVERYTHING)
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const notes = order.notes;

        // 3️⃣ get listing properly
        const listing = await Listing.findById(notes.listingId);
        if (!listing) {
            console.log("Listing not found");
            return res.json({ success: false });
        }

        // 4️⃣ create booking
        const newBooking = new Booking({
            user: new mongoose.Types.ObjectId(notes.userId),
            listing: new mongoose.Types.ObjectId(notes.listingId),

            fromDate: new Date(notes.fromDate),
            toDate: new Date(notes.toDate),
            guests: Number(notes.guests),

            roomPlan: notes.roomPlan,

            basePrice: Number(notes.basePrice),
            platformFee: Number(notes.platformFee),
            gst: Number(notes.gst),
            totalPrice: Number(notes.totalPrice),

            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            paymentStatus: "Paid"
        });

        await newBooking.save();

        res.json({ success: true });

    } catch (err) {
        console.log("VERIFY ERROR:", err);
        res.status(500).json({ success: false });
    }
});



// ================= BOOKING PAGE =================
router.get("/:id", isLoggedIn, async(req, res) => {
    try {
        const { id } = req.params;

        const listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing not found");
            return res.redirect("/listings");
        }

        res.render("bookings/book", {
            listing,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });

    } catch (err) {
        console.log(err);
        req.flash("error", "Invalid listing ID");
        res.redirect("/listings");
    }
});


// ================= SAVE BOOKING DATA TO SESSION =================
router.post("/:id", isLoggedIn, async(req, res) => {
    try {

        const { fromDate, toDate, guests } = req.body;
        const roomPlan = req.body.roomPlan ? req.body.roomPlan.trim() : "";

        const listing = await Listing.findById(req.params.id);



        // ===== DATE OVERLAP PROTECTION =====

        const existingBooking = await Booking.findOne({
            listing: listing._id,
            status: "Confirmed",
            fromDate: { $lt: new Date(toDate) },
            toDate: { $gt: new Date(fromDate) }
        });

        if (existingBooking) {
            return res.status(400).json({
                error: "Selected dates are already booked"
            });
        }


        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        // find selected plan (SAFE MATCH)
        const selectedPlan = listing.roomPlans.find(
            p => p.name.trim().toLowerCase() === roomPlan.toLowerCase()
        );

        if (!selectedPlan) {
            return res.status(400).json({ error: "Invalid room plan selected" });
        }

        // calculate nights
        const checkIn = new Date(fromDate);
        const checkOut = new Date(toDate);

        const nights = Math.ceil(
            (checkOut - checkIn) / (1000 * 60 * 60 * 24)
        );

        if (nights <= 0) {
            return res.status(400).json({ error: "Invalid dates" });
        }

        // ⭐ IMPORTANT FIX
        const planExtra = Number(selectedPlan.extraPrice);
        const baseRoomPrice = Number(listing.price);
        const pricePerNight = baseRoomPrice + planExtra;

        // total base
        const basePrice = nights * pricePerNight;

        // platform fee (5%)
        const platformFee = Math.round(basePrice * 0.05);

        // GST (18%)
        const gst = Math.round((basePrice + platformFee) * 0.18);

        // final
        const totalPrice = basePrice + platformFee + gst;

        // store session
        req.session.bookingData = {
            listingId: listing._id,
            fromDate,
            toDate,
            guests,
            nights,

            selectedPlan: selectedPlan.name,
            planExtra: planExtra,

            basePrice,
            platformFee,
            gst,
            totalPrice
        };

        return res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Session save failed" });
    }
});


// ================= CANCEL BOOKING =================
router.delete("/cancel/:bookingId", isLoggedIn, async(req, res) => {
    try {
        const { bookingId } = req.params;

        const booking = await Booking.findById(bookingId);

        if (!booking || !booking.user.equals(req.user._id)) {
            req.flash("error", "Unauthorized action!");
            return res.redirect("/bookings/my-bookings");
        }

        await Booking.findByIdAndDelete(bookingId);

        req.flash("success", "Booking cancelled successfully!");
        res.redirect("/bookings/my-bookings");

    } catch (err) {
        console.log(err);
        req.flash("error", "Cannot cancel booking");
        res.redirect("/bookings/my-bookings");
    }
});

module.exports = router;