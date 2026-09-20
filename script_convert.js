const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
    try {
        const imagePath = "C:\\Users\\mcs\\.gemini\\antigravity\\brain\\f10ef372-341d-45a9-978b-41d66a6bf472\\media__1776743375484.jpg";
        console.log('Loading image from:', imagePath);
        
        const image = nativeImage.createFromPath(imagePath);
        
        if (image.isEmpty()) {
            console.error('Failed to load image! The image is empty or invalid.');
            app.quit();
            return;
        }

        const pngBuffer = image.toPNG();
        
        fs.writeFileSync(path.join(__dirname, 'public/logo.png'), pngBuffer);
        fs.copyFileSync(imagePath, path.join(__dirname, 'public/logo.jpg')); // Keep a JPG copy just in case
        
        console.log('Successfully converted image to proper PNG format and saved as public/logo.png');
    } catch (err) {
        console.error('Error during conversion:', err);
    }
    app.quit();
});
