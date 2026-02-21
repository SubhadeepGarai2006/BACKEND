 const Listing = require("./models/listing");
 const Review = require("./models/review");







 module.exports.isLoggedIn = (req, res, next) => {
     if (!req.isAuthenticated()) {
         req.session.redirectTo = req.originalUrl;
         req.flash("error", "You must be signed in first!");
         return res.redirect("/login");
     }
     next();
 };


 module.exports.saveReditectUrl = (req, res, next) => {
     if (req.session.redirectTo) {
         res.locals.redirectTo = req.session.redirectTo;
     }
     next();
 };



 module.exports.isOwner = async(req, res, next) => {
     let { id } = req.params;
     let listing = await Listing.findById(id);

     if (!listing.owner._id.equals(req.user._id)) {
         req.flash("error", "Unauthorized");
         return res.redirect(`/listings/${id}`);
     }

     next();
 };


 module.exports.isReviewAuthor = async(req, res, next) => {
     let { id, reviewId } = req.params;
     let review = await Review.findById(reviewId);

     if (!review.author.equals(req.user._id)) {
         req.flash("error", "Unauthorized for delete review");
         return res.redirect(`/listings/${id}`);
     }

     next();
 };
 module.exports.isHost = (req, res, next) => {

     if (!req.isAuthenticated()) {
         req.flash("error", "You must be logged in!");
         return res.redirect("/login");
     }

     if (req.user.role !== "host" && req.user.role !== "admin") {
         req.flash("error", "Only property owners can create listings!");
         return res.redirect("/listings");
     }

     next();

 };
 module.exports.isAdmin = (req, res, next) => {

     if (!req.isAuthenticated()) {
         req.flash("error", "Login required");
         return res.redirect("/login");
     }

     if (req.user.role !== "admin") {
         req.flash("error", "Admin access only");
         return res.redirect("/listings");
     }

     next();
 };