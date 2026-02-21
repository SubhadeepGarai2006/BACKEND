const mongoose = require("mongoose");
const Review = require("./review.js");

const Schema = mongoose.Schema;

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    // ⭐ FIXED IMAGE STRUCTURE
    image: {
        url: String,
        filename: String
    },


    price: Number,
    location: String,
    country: String,
    reviews: [{
        type: Schema.Types.ObjectId,
        ref: "Review",
    }, ],

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },



    roomPlans: [{
        name: String, // AC / NonAC / Deluxe
        extraPrice: Number
    }],






    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },


    capacity: {
        type: Number,
        default: 1
    },




    geometry: {
        lat: Number,
        lng: Number
    },



    isDeleted: {
        type: Boolean,
        default: false
    }



});





/**
   CASCADE DELETE
  Listing delete hote hi uske saare reviews delete ho jayenge
 */
listingSchema.post("findOneAndDelete", async function(listing) {
    if (listing && listing.reviews.length > 0) {
        await Review.deleteMany({
            _id: { $in: listing.reviews },
        });
    }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;