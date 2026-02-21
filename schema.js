const Joi = require("joi");

// SIGNUP
const userSchema = Joi.object({

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),

    password: Joi.string()
        .min(6)
        .max(20)
        .required()
});

// FORGOT
const forgotSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
});

// RESET PASSWORD
const resetSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),

    password: Joi.string()
        .min(6)
        .required(),

    confirmPassword: Joi.any()
        .valid(Joi.ref("password"))
        .required()
        .messages({ "any.only": "Passwords do not match" })
});

// OTP VERIFY
const otpSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),

    otp: Joi.string()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
});


// REVIEW SCHEMA


const reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().min(1).max(5).required(),
        comment: Joi.string().required()
    }).required()
});

const listingSchema = Joi.object({

    // ⭐ image yaha ayega (TOP LEVEL)
    image: Joi.any(),
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),

        price: Joi.number().required(),
        capacity: Joi.number().min(1).required(),

        roomPlans: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                extraPrice: Joi.number().required()
            })
        ).min(1).required()
    }).required()

}).unknown(true);



// SIGNUP (OTP STEP)
const signupSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),

    role: Joi.string().valid("customer", "host", "admin").default("customer")

});


module.exports = {
    userSchema,
    forgotSchema,
    resetSchema,
    otpSchema,
    reviewSchema,
    listingSchema,
    signupSchema
};