const express = require("express");
const router = express.Router({ mergeParams: true });

const Listing = require("../models/listing");
const Review = require("../models/review");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { reviewSchema } = require("../schema");
const { isLoggedIn, isReviewAuthor } = require("../middleware.js");


//  VALIDATE REVIEW 
const validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        throw new ExpressError(
            error.details.map(el => el.message).join(","),
            400
        );
    }
    next();
};



//  CREATE REVIEW 
router.post("/",
    validateReview,
    isLoggedIn, wrapAsync(async(req, res) => {

        let listing = await Listing.findById(req.params.id);

        let newReview = new Review(req.body.review);
        newReview.author = req.user._id;

        listing.reviews.push(newReview);

        await newReview.save();
        await listing.save();
        req.flash("success", "Review Added!");

        res.redirect(`/listings/${listing._id}`);
    }));



//  DELETE REVIEW 
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(async(req, res) => {

    let { id, reviewId } = req.params;

    await Review.findByIdAndDelete(reviewId);

    await Listing.findByIdAndUpdate(id, {
        $pull: { reviews: reviewId }
    });

    req.flash("error", "Review Deleted!");

    res.redirect(`/listings/${id}`);
}));


module.exports = router;