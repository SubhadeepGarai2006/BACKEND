require("dotenv").config();
const MongoStore = require("connect-mongo").default;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");



const axios = require("axios");




const session = require("express-session");
const flash = require("connect-flash");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// ROUTERS
const listings = require("./routes/listing.js");
const reviews = require("./routes/review.js");
const user = require("./routes/user.js");
const bookingRoutes = require("./routes/booking.js");
const hostRoutes = require("./routes/host");

const adminRoutes = require("./routes/admin");


// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
// const dburl = process.env.ATLASDB_URL;

const staticRoutes = require("./routes/static.js");


//  DB CONNECT 
// async function main() {
//     await mongoose.connect(dburl);
//     console.log(" Connected to MongoDB Atlas");
// }
// main().catch(err => console.log(err));


//  VIEW ENGINE 
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);


//  BASIC MIDDLEWARE 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));


// ================= SESSION STORE (MongoDB) =================
const store = MongoStore.create({
    mongoUrl: process.env.ATLASDB_URL,
    crypto: {
        secret: process.env.SESSION_SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", () => {
    console.log("SESSION STORE ERROR");
});

// SESSION CONFIG
const sessionOption = {
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,

    cookie: {
        httpOnly: true,
        secure: true, // REQUIRED for HTTPS
        sameSite: "none", // VERY IMPORTANT
        maxAge: 1000 * 60 * 60 * 24 * 7
    },
};
app.set("trust proxy", 1);
app.use(session(sessionOption));
app.use(flash());


//  PASSPORT CONFIG (CORRECT ORDER) 
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser((user, done) => {
    done(null, user._id); // store MongoDB ObjectId
});

passport.deserializeUser(async(id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

//  GLOBAL LOCALS (MOST IMPORTANT FIX) 
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
});


//  ROOT 
app.get("/", (req, res) => {
    res.redirect("/listings");
});


//  ROUTES 
app.use("/", user);

app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);
app.use("/bookings", bookingRoutes);

app.use("/host", hostRoutes);
app.use("/admin", adminRoutes);
app.use("/", staticRoutes);



//  404 HANDLER 
app.use((req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
});


//  ERROR HANDLER 
app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("listings/error", { statusCode, message });
});


//  SERVER 
// app.listen(8080, "0.0.0.0", () => {
//     console.log(" Server running on http://localhost:8080");
// });// DB CONNECT & SERVER START
const dburl = process.env.ATLASDB_URL;

async function startServer() {
    try {
        await mongoose.connect(dburl, {
            serverSelectionTimeoutMS: 30000
        });

        console.log("✅ Connected to MongoDB Atlas");

        app.listen(8080, "0.0.0.0", () => {
            console.log("🚀 Server running on http://localhost:8080");
        });

    } catch (err) {
        console.log("❌ DATABASE CONNECTION FAILED");
        console.log(err);
    }
}

startServer();