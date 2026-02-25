const nodemailer = require("nodemailer");

const sendEmail = async(to, subject, html) => {

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL,
        to,
        subject,
        html
    });
};

module.exports = sendEmail;