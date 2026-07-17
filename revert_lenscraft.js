const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Not using glob, will write a simple recursive function

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else if (name.endsWith('.html')) {
            files.push(name);
        }
    }
    return files;
}

function revertFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Revert titles
    content = content.replace(/ \| LensCraft Studio<\/title>/g, ' | SnailShutter</title>');
    content = content.replace(/ \| LensCraft/g, ' | SnailShutter');

    // Revert auth pages specific text
    content = content.replace(/Sign in to manage your photography sessions/g, 'Sign in to manage your mindful photography sessions');
    content = content.replace(/Join our studio and let us help you create lasting memories through the art of photography\./g, 'Join our mindful studio and let us help you create lasting memories through the art of thoughtful photography.');
    content = content.replace(/Create your account to book sessions and access your photo gallery\./g, 'Create your client account to book sessions and access your mindful photo gallery.');

    // Revert sidebar/auth logo
    const lenscraftLogo = `<div class="logo-icon"><i class="fas fa-camera"></i></div>\n                    <span>LensCraft</span>`;
    const snailshutterLogo = `<img src="/assets/images/logo.png" alt="SnailShutter" style="height: 150px;">`;
    content = content.split(lenscraftLogo).join(snailshutterLogo);

    const lenscraftLogoClient = `<div class="logo-icon"><i class="fas fa-camera"></i></div>\n            <span>LensCraft</span>`;
    const snailshutterLogoClient = `<img src="/assets/images/logo.png" alt="SnailShutter" style="height: 150px;">`;
    content = content.split(lenscraftLogoClient).join(snailshutterLogoClient);

    const lenscraftLogoSidebar = `<div class="logo-icon"><i class="fas fa-camera"></i></div>\n                    <span>LensCraft</span>`;
    const snailshutterLogoSidebarClient = `<img src="../assets/images/logo.png" alt="SnailShutter" style="height: 150px;">`;
    // For client components specifically:
    if (filepath.includes('client\\components') || filepath.includes('client/components') || filepath.includes('client\\bookings.html')) {
        content = content.split(lenscraftLogo).join(snailshutterLogoSidebarClient);
        content = content.split(lenscraftLogoClient).join(snailshutterLogoSidebarClient);
    }

    // Revert the auth right background
    content = content.replace(/linear-gradient\(135deg, #1a1a2e 0%, #2d1b4e 40%, #d4a574 100%\);/g, 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 40%, #E8F5E9 100%);');

    fs.writeFileSync(filepath, content, 'utf8');
}

const baseDir = 'c:\\asd\\htdocs\\ACTIVITIES\\CAPSTONE2';
const folders = ['admin', 'staff', 'client', 'auth'];

let allFiles = [];
for (const folder of folders) {
    const dirPath = path.join(baseDir, folder);
    if (fs.existsSync(dirPath)) {
        allFiles = allFiles.concat(getFiles(dirPath));
    }
}

for (const f of allFiles) {
    revertFile(f);
    console.log("Reverted", f);
}
