const express = require("express");
const router = express.Router();
const passport = require("passport");

const User = require("../models/user");
const sendEmail = require("../utils/sendEmail");
const { userSchema, forgotSchema, resetSchema, otpSchema, signupSchema } = require("../schema");
const {
    saveReditectUrl
} = require("../middleware.js")



const {
    isLoggedIn
} = require("../middleware.js");



const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");




const validateSignup = (req, res, next) => {
    const { error } = signupSchema.validate(req.body);

    if (error) {
        req.flash("error", error.details[0].message);
        return res.redirect("/signup");
    }
    next();
};

const validateOtp = (req, res, next) => {
    const { error } = otpSchema.validate(req.body);

    if (error) {
        req.flash("error", error.details[0].message);
        return res.redirect("back");
    }
    next();
};
const validatePassword = (req, res, next) => {
    const { error } = resetSchema.validate(req.body);

    if (error) {
        req.flash("error", error.details[0].message);
        return res.redirect("back");
    }
    next();
};

//  SIGNUP 

// signup page
router.get("/signup", (req, res) => {
    res.render("users/signup");
});

// send OTP
router.post("/signup", validateSignup, async(req, res) => {
    try {
        const { email, role } = req.body;
        req.session.signupRole = role || "customer";

        if (!email) {
            req.flash("error", "Email is required");
            return res.redirect("/signup");
        }

        const lowerEmail = email.toLowerCase();

        const existingUser = await User.findOne({ email: lowerEmail });
        if (existingUser) {
            req.flash("error", "Email already registered");
            return res.redirect("/signup");
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // store temporary data in session
        req.session.tempUser = {
            email: lowerEmail,
            otp: otp,
            otpExpire: Date.now() + 300000
        };

        await sendEmail(
            lowerEmail,
            "Email Verification OTP",
            `<h2>Your Verification OTP</h2>
             <h1>${otp}</h1>
             <p>Valid for 5 minutes</p>`
        );

        req.flash("success", "OTP sent to your email");
        res.redirect(`/verify-email?email=${lowerEmail}`);

    } catch (err) {
        console.log(err);
        req.flash("error", "Something went wrong");
        res.redirect("/signup");
    }
});


//  VERIFY EMAIL 

router.get("/verify-email", (req, res) => {
    res.render("users/verifyEmail", { email: req.query.email });
});

router.post("/verify-email", validateOtp, async(req, res) => {
    const { email, otp } = req.body;

    const tempUser = req.session.tempUser;

    if (!tempUser ||
        tempUser.email !== email.toLowerCase() ||
        tempUser.otp !== otp ||
        tempUser.otpExpire < Date.now()) {

        req.flash("error", "Invalid or expired OTP");
        return res.redirect(`/verify-email?email=${email}`);
    }

    // mark verified
    req.session.verifiedEmail = email.toLowerCase();
    delete req.session.tempUser;

    req.flash("success", "Email verified! Now create password.");
    res.redirect(`/set-password?email=${email}`);
});


//  SET PASSWORD 

router.get("/set-password", (req, res) => {
    res.render("users/setPassword", { email: req.query.email });
});

router.post("/set-password", validatePassword, async(req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect(`/set-password?email=${email}`);
    }

    if (req.session.verifiedEmail !== email.toLowerCase()) {
        req.flash("error", "Unauthorized request");
        return res.redirect("/signup");
    }

    // create user AFTER verification
    const newUser = new User({
        username: email.toLowerCase(),
        email: email.toLowerCase(),
        isVerified: true,
        role: req.session.signupRole || "customer"
    });

    await User.register(newUser, password);
    delete req.session.signupRole;


    delete req.session.verifiedEmail;

    req.flash("success", "Account created! Please login.");
    res.redirect("/login");
});


//  LOGIN 

router.get("/login", (req, res) => {
    res.render("users/login");
});

router.post("/login", saveReditectUrl, (req, res, next) => {

    passport.authenticate("local", async(err, user, info) => {

        if (err) return next(err);

        // wrong password / email
        if (!user) {
            req.flash("error", "Invalid email or password");
            return res.redirect("/login");
        }

        // ⭐ BLOCK CHECK BEFORE LOGIN SESSION
        if (user.blocked) {
            req.flash("error", "Your host account has been temporarily suspended. ");
            return res.redirect("/login");
        }



        const selectedRole = req.body.role;

        // ===== ROLE MISMATCH CHECK =====

        // admin alag handle hoga
        if (selectedRole !== "admin") {

            // agar user ka real role aur selected role alag hai
            if (user.role !== selectedRole) {
                req.flash("error", `You registered as ${user.role}. Please login as ${user.role}.`);
                return res.redirect("/login");
            }
        }






        // ===== ADMIN SECRET CHECK =====
        if (selectedRole === "admin") {

            // only your email allowed
            if (user.email !== process.env.ADMIN_EMAIL) {
                req.flash("error", "You are not admin!");
                return res.redirect("/login");
            }

            // secret key check
            if (req.body.adminKey !== process.env.ADMIN_SECRET) {
                req.flash("error", "Invalid admin secret key!");
                return res.redirect("/login");
            }

            // mark admin login session
            req.session.adminLogin = true;
        }


        // login user
        // ===== SEND LOGIN OTP INSTEAD OF DIRECT LOGIN =====

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.loginOtp = otp;
        user.loginOtpExpire = Date.now() + 5 * 60 * 1000; // 5 min

        await user.save();

        // send email
        await sendEmail(
            user.email,
            "Wanderlust Login OTP",
            `<h2>Your Login OTP</h2>
     <h1>${otp}</h1>
     <p>This OTP is valid for 5 minutes.</p>`
        );

        // store temporary login session
        req.session.tempLoginUser = user._id;

        // DO NOT LOGIN YET
        req.flash("success", "OTP sent to your email");
        res.redirect("/login-otp");


    })(req, res, next);
});

// ================= LOGIN OTP VERIFY =================

// OTP page
router.get("/login-otp", (req, res) => {

    if (!req.session.tempLoginUser) {
        req.flash("error", "Session expired. Please login again.");
        return res.redirect("/login");
    }

    res.render("users/loginOtp");
});


// verify OTP
router.post("/login-otp", async(req, res, next) => {

    const { otp } = req.body;

    const user = await User.findById(req.session.tempLoginUser);

    if (!user || !user.loginOtp || user.loginOtp !== otp || user.loginOtpExpire < Date.now()) {
        req.flash("error", "Invalid or expired OTP");
        return res.redirect("/login-otp");
    }

    // clear OTP
    user.loginOtp = undefined;
    user.loginOtpExpire = undefined;
    await user.save();

    // FINAL LOGIN
    req.logIn(user, (err) => {
        if (err) return next(err);

        delete req.session.tempLoginUser;

        req.flash("success", "Login successful!");
        res.redirect("/listings");
    });
});



//  LOGOUT 

router.get("/logout", (req, res, next) => {
    req.logout(function(err) {
        if (err) return next(err);
        req.flash("success", "Logged out!");
        res.redirect("/login");
    });
});


//  FORGOT PASSWORD 

router.get("/forgot", (req, res) => {
    res.render("users/forgotPassword");
});

router.post("/forgot", validateSignup, async(req, res) => {
    const { email } = req.body;
    const lowerEmail = email.toLowerCase();

    const user = await User.findOne({ email: lowerEmail });
    if (!user) {
        req.flash("error", "Email not registered");
        return res.redirect("/forgot");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.resetUser = {
        email: lowerEmail,
        otp: otp,
        otpExpire: Date.now() + 300000
    };

    await sendEmail(
        lowerEmail,
        "Password Reset OTP",
        `<h2>Password Reset OTP</h2>
         <h1>${otp}</h1>
         <p>Valid for 5 minutes</p>`
    );

    req.flash("success", "OTP sent to email");
    res.redirect(`/verify-reset?email=${lowerEmail}`);
});


//  VERIFY RESET OTP 

router.get("/verify-reset", (req, res) => {
    res.render("users/verifyResetOtp", { email: req.query.email });
});

router.post("/verify-reset", validateOtp, async(req, res) => {
    const { email, otp } = req.body;

    const resetUser = req.session.resetUser;

    if (!resetUser ||
        resetUser.email !== email.toLowerCase() ||
        resetUser.otp !== otp ||
        resetUser.otpExpire < Date.now()) {

        req.flash("error", "Invalid or expired OTP");
        return res.redirect(`/verify-reset?email=${email}`);
    }

    req.session.resetVerified = email.toLowerCase();
    delete req.session.resetUser;

    req.flash("success", "OTP verified");
    res.redirect(`/new-password?email=${email}`);
});


//  NEW PASSWORD 

router.get("/new-password", (req, res) => {
    res.render("users/newPassword", { email: req.query.email });
});

router.post("/new-password", validatePassword, async(req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect(`/new-password?email=${email}`);
    }

    if (req.session.resetVerified !== email.toLowerCase()) {
        req.flash("error", "Unauthorized request");
        return res.redirect("/forgot");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    await user.setPassword(password);
    await user.save();

    delete req.session.resetVerified;

    req.flash("success", "Password changed! Please login.");
    res.redirect("/login");
});



// DELETE ACCOUNT
router.delete("/delete-account", isLoggedIn, async(req, res) => {
    try {

        const userId = req.user._id;

        // 1️⃣ delete bookings where user is guest
        await Booking.deleteMany({ user: userId });

        // 2️⃣ find listings owned by user
        const userListings = await Listing.find({ owner: userId });

        const listingIds = userListings.map(l => l._id);

        // 3️⃣ delete bookings on those listings
        await Booking.deleteMany({ listing: { $in: listingIds } });

        // 4️⃣ delete reviews written by user
        await Review.deleteMany({ author: userId });

        // 5️⃣ delete reviews of user's listings
        await Review.deleteMany({ listing: { $in: listingIds } });

        // 6️⃣ delete listings
        await Listing.deleteMany({ owner: userId });

        // 7️⃣ finally delete user
        await User.findByIdAndDelete(userId);

        // logout
        req.logout(function(err) {
            if (err) { return next(err); }
        });

        req.flash("success", "Your account and all data has been deleted.");
        res.redirect("/");

    } catch (err) {
        console.log(err);
        req.flash("error", "Account deletion failed.");
        res.redirect("/profile");
    }
});

module.exports = router;