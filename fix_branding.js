const fs = require('fs');
const path = require('path');

const baseDir = 'c:\\asd\\htdocs\\ACTIVITIES\\CAPSTONE2';

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // 1. Titles
            content = content.replace(/LensCraft Studio/g, 'SnailShutter');
            content = content.replace(/LensCraft/g, 'SnailShutter');

            // 2. Auth specifics
            content = content.replace(/Sign in to manage your photography sessions/g, 'Sign in to manage your mindful photography sessions');
            content = content.replace(/Join our studio and let us help you create lasting memories through the art of photography\./g, 'Join our mindful studio and let us help you create lasting memories through the art of thoughtful photography.');
            content = content.replace(/Create your account to book sessions and access your photo gallery\./g, 'Create your client account to book sessions and access your mindful photo gallery.');
            content = content.replace(/linear-gradient\(135deg, #1a1a2e 0%, #2d1b4e 40%, #d4a574 100%\)/g, 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 40%, #E8F5E9 100%)');

            // 3. Logo replacements
            // The previous regex hit SnailShutter because we just replaced LensCraft -> SnailShutter above.
            // So the text in the logo block is now <span>SnailShutter</span> instead of LensCraft.
            const logoBlock = /<div class="logo-icon">\s*<i class="fas fa-camera"><\/i>\s*<\/div>\s*<span>SnailShutter<\/span>/g;

            // Adjust path for deep client components
            let newLogo = `<img src="/assets/images/logo.png" alt="SnailShutter" style="height: 40px;">`;
            if (fullPath.includes('client\\components') || fullPath.includes('client/components') || fullPath.includes('client\\bookings.html')) {
                newLogo = `<img src="../assets/images/logo.png" alt="SnailShutter" style="height: 40px;">`;
            }

            content = content.replace(logoBlock, newLogo);

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed:', fullPath);
            }
        }
    }
}

['admin', 'staff', 'client', 'auth'].forEach(d => processDir(path.join(baseDir, d)));
