// Raster derivatives of the vector app icon exported from the Pouch Figma file.
const Jimp = require('jimp-compact');
const fs = require('fs');
async function main() {
  const icon = await Jimp.read('assets/images/icon.png');
  await icon.clone().resize(64, 64).writeAsync('assets/images/favicon.png');
  const foreground = icon.clone();
  foreground.scan(0, 0, foreground.bitmap.width, foreground.bitmap.height, function (x, y, i) {
    const d = this.bitmap.data;
    // The icon is light artwork on green. Preserve antialiased edge coverage.
    const alpha = Math.max(0, Math.min(1, (d[i] - 40) / (247 - 40)));
    d[i] = 247; d[i + 1] = 246; d[i + 2] = 242; d[i + 3] = Math.round(alpha * 255);
  });
  await foreground.writeAsync('assets/images/android-icon-foreground.png');
  await foreground.clone().resize(256, 256).writeAsync('assets/images/splash-icon.png');
  await foreground.writeAsync('assets/images/android-icon-monochrome.png');
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  config.expo.ios.icon = './assets/images/icon.png';
  config.expo.android.adaptiveIcon.backgroundColor = '#286447';
  delete config.expo.android.adaptiveIcon.backgroundImage;
  const splash = config.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen');
  splash[1].backgroundColor = '#286447';
  splash[1].imageWidth = 96;
  fs.writeFileSync('app.json', JSON.stringify(config, null, 2) + '\n');
}
main().catch(e => { console.error(e); process.exit(1); });
