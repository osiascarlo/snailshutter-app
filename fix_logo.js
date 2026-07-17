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

            // Only update logo scaling for auth and dashboard pages, leave index.html alone
            // Dashboards will usually have it in the sidebar
            if (fullPath.includes('\\auth\\') || fullPath.includes('/auth/')) {
                content = content.replace(/style="height: 40px;"/g, 'style="height: 100px; max-width: 100%; object-fit: contain;"');
            } else if (fullPath.includes('\\admin\\') || fullPath.includes('/admin/') ||
                fullPath.includes('\\staff\\') || fullPath.includes('/staff/') ||
                fullPath.includes('\\client\\') || fullPath.includes('/client/')) {
                content = content.replace(/style="height: 40px;"/g, 'style="height: 80px; max-width: 100%; object-fit: contain; margin-left: -10px;"');
            }

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Scaled logo up in:', fullPath);
            }
        }
    }
}

['admin', 'staff', 'client', 'auth'].forEach(d => processDir(path.join(baseDir, d)));
