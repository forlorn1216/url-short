const QRCode = require('qrcode');

async function generateQRCode(url) {
  try {
    console.log(`Generating QR code for URL: ${url}`);
    const dataUrl = await QRCode.toDataURL(url);
    console.log('QR code generated successfully');
    return dataUrl;
  } catch (error) {
    console.error('QR Code Generation Failed:', error);
    return null;
  }
}

module.exports = generateQRCode;
