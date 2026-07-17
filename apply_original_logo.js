const fs = require('fs');
const path = require('path');

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            // skip node_modules
            if (item !== 'node_modules') {
                processDir(fullPath);
            }
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Replace logo.png and logo-placeholder.svg with logo.svg
            content = content.replace(/\/assets\/images\/logo\.png/g, '/assets/images/logo.svg');
            content = content.replace(/\.\.\/assets\/images\/logo\.png/g, '../assets/images/logo.svg');
            content = content.replace(/assets\/images\/logo-placeholder\.svg/g, 'assets/images/logo.svg');
            
            // Revert the styles back to original if needed
            content = content.replace(/style="height: 150px;"/g, '');
            content = content.replace(/style="height: 80px; max-width: 100%; object-fit: contain; margin-left: -10px;"/g, '');
            content = content.replace(/style="height: 100px; max-width: 100%; object-fit: contain;"/g, '');

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated logo in:', fullPath);
            }
        }
    }
}

const baseDir = 'c:\\asd\\htdocs\\ACTIVITIES\\CAPSTONE2';
processDir(baseDir);
