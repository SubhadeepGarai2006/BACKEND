function showFinalPrice() {

    const base = Number(document
        .getElementById("basePrice")
        .dataset.price);

    const gst = base * 0.18;
    const platform = base * 0.05;

    const final = Math.round(base + gst + platform);

    document.getElementById("finalPrice")
        .innerHTML =
        `Final Price: ₹${final} (incl. taxes & platform fee)`;
}