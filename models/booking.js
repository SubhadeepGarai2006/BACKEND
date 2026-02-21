const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({



    image: {
        url: String,
        filename: String
    },

    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    fromDate: {
        type: Date,
        required: true
    },

    toDate: {
        type: Date,
        required: true
    },

    guests: {
        type: Number,
        required: true
    },
    // ⭐⭐⭐ ADD THIS ⭐⭐⭐
    roomPlan: {
        type: String,
        required: true
    },





    // ⭐ PAYMENT FIELDS
    paymentId: String,
    orderId: String,
    signature: String,

    basePrice: Number,
    gst: Number,
    platformFee: Number,
    totalPrice: Number,

    paymentStatus: {
        type: String,
        default: "Pending"
    },

    status: {
        type: String,
        default: "Confirmed"
    },





}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);