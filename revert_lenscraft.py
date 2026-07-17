import os
import glob

def revert_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert titles
    content = content.replace(' | LensCraft Studio</title>', ' | SnailShutter</title>')
    content = content.replace(' | LensCraft', ' | SnailShutter')

    # Revert auth pages specific text
    content = content.replace('Sign in to manage your photography sessions', 'Sign in to manage your mindful photography sessions')
    content = content.replace('Join our studio and let us help you create lasting memories through the art of photography.', 'Join our mindful studio and let us help you create lasting memories through the art of thoughtful photography.')
    content = content.replace('Create your account to book sessions and access your photo gallery.', 'Create your client account to book sessions and access your mindful photo gallery.')
    
    # Revert sidebar/auth logo
    lenscraft_logo = """<div class="logo-icon"><i class="fas fa-camera"></i></div>
                    <span>LensCraft</span>"""
    snailshutter_logo = '<img src="/assets/images/logo.png" alt="SnailShutter" style="height: 150px;">'
    content = content.replace(lenscraft_logo, snailshutter_logo)
    
    lenscraft_logo_client = """<div class="logo-icon"><i class="fas fa-camera"></i></div>
            <span>LensCraft</span>"""
    snailshutter_logo_client = '<img src="/assets/images/logo.png" alt="SnailShutter" style="height: 150px;">'
    content = content.replace(lenscraft_logo_client, snailshutter_logo_client)

    # Revert the auth right background
    content = content.replace('linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 40%, #d4a574 100%);', 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 40%, #E8F5E9 100%);')

    # Revert "Mindful" words
    content = content.replace('<h2>Every Picture Tells a Story</h2>', '<h2>Every Picture Tells a Story</h2>')
    content = content.replace('<h2>Start Your Journey</h2>', '<h2>Start Your Journey</h2>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

html_files = []
base_dir = r"c:\asd\htdocs\ACTIVITIES\CAPSTONE2"
for folder in ['admin', 'staff', 'client', 'client/components', 'auth']:
    html_files.extend(glob.glob(os.path.join(base_dir, folder, '*.html')))

for f in html_files:
    revert_file(f)
    print("Reverted", f)
