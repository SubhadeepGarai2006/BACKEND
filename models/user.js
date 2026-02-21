const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new mongoose.Schema({





    email: {
        type: String,
        required: true,
        unique: true
    },


    role: {
        type: String,
        enum: ["customer", "host", "admin"],
        default: "customer"
    },

    blocked: {
        type: Boolean,
        default: false
    },


    isVerified: {
        type: Boolean,
        default: false
    },

    // signup email OTP
    otp: String,
    otpExpire: Date,

    // forgot password OTP
    otpAttempts: { type: Number, default: 0 },
    resetOtp: String,
    resetOtpExpire: Date,



    loginOtp: String,
    loginOtpExpire: Date,
    isOtpVerified: {
        type: Boolean,
        default: false
    }


});

userSchema.plugin(passportLocalMongoose, { usernameField: "email", });


module.exports = mongoose.model("User", userSchema);