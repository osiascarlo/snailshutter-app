# Logo Upload Instructions

## 📁 Current Setup

All pages now use a placeholder logo file:
- **File**: `assets/images/logo-placeholder.svg`
- **Size**: 200x40px
- **Format**: SVG

## 🔄 How to Replace with Your Exact Logo

### Option 1: Replace the File Directly
1. **Upload your logo file** to: `assets/images/logo-placeholder.svg`
2. **Supported formats**: SVG, PNG, JPG
3. **Recommended size**: 200x40px (will scale automatically)
4. **Keep the same filename**: `logo-placeholder.svg`

### Option 2: Update All References
If you prefer a different filename:
1. **Upload your logo** to: `assets/images/your-logo.svg`
2. **Update these files** to reference your new filename:
   - `index.html` (line 14)
   - `auth/login.html` (line 15) 
   - `auth/register.html` (line 15)
   - `client/dashboard.html` (line 20)

## 📐 Logo Specifications

For best results, your logo should be:
- **Width**: 200px
- **Height**: 40px  
- **Format**: SVG (recommended) or PNG
- **Background**: Transparent
- **Colors**: Green (#7AA52B) and Black (#000000)

## 🌐 After Upload

Once you replace the logo file:
1. **Refresh your browser** at http://localhost:3000
2. **Check all pages**:
   - Landing page navigation
   - Login page header
   - Register page header  
   - Dashboard sidebar

## ✅ Current Status

All pages are now pointing to the placeholder logo file. Simply replace `logo-placeholder.svg` with your exact design and it will appear everywhere automatically!
