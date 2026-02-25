// const nodemailer = require("nodemailer");

// const sendEmail = async(to, subject, html) => {

//     const transporter = nodemailer.createTransport({
//         service: "gmail",
//         auth: {
//             user: process.env.EMAIL,
//             pass: process.env.PASS
//         }
//     });

//     await transporter.sendMail({
//         from: process.env.EMAIL,
//         to,
//         subject,
//         html
//     });
// };

// module.exports = sendEmail;





const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // VERY IMPORTANT (465 nahi use karna)
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    family: 4 // ⭐⭐ MAIN FIX (forces IPv4, Render compatible)
});

const sendEmail = async(to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"Wanderlust" <${process.env.EMAIL}>`,
            to,
            subject,
            html
        });
        console.log("Email sent successfully");
    } catch (err) {
        console.log("MAIL ERROR:", err.message);
    }
};

module.exports = sendEmail;