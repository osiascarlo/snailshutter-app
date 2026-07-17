const fs = require('fs');

const cssPath = 'c:\\asd\\htdocs\\ACTIVITIES\\CAPSTONE2\\assets\\css\\style.css';
let content = fs.readFileSync(cssPath, 'utf8');

// Fix nav-logo img height
content = content.replace(/\.nav-logo img \{ height: 120px;/g, '.nav-logo img { height: 40px;');
// Fix landing-nav.scrolled .nav-logo img height
content = content.replace(/\.landing-nav\.scrolled \.nav-logo img \{\n    height: 90px;/g, '.landing-nav.scrolled .nav-logo img {\n    height: 40px;');
// Fix sidebar-logo img height
content = content.replace(/\.sidebar-logo img \{\n    height: 150px;/g, '.sidebar-logo img {\n    height: 40px;');

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Fixed logo sizes in style.css');
