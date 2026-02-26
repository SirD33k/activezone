================================================================================
           UPLOAD THESE FILES TO YOUR CPANEL HOSTING
================================================================================

UPLOAD LOCATION:
- cPanel File Manager: /home/yourusername/active-zone-hub/
- OR use FTP/SFTP to upload to the same location

WHAT'S INCLUDED:
- server.js (Backend Node.js application)
- package.json (Dependencies list)
- .env (Configuration file - UPDATE with your credentials!)
- database/schema.sql (MySQL database structure)
- All HTML files (index, store, checkout, etc.)
- src/ folder (JavaScript files)
- images/ folder (Image assets if any)

IMPORTANT - BEFORE UPLOADING:
1. Edit the .env file and update with YOUR actual values:
   - Database credentials from cPanel MySQL
   - Your domain URL
   - Paystack LIVE API keys
   - TOTP secret for Google Authenticator

2. DO NOT upload:
   - node_modules/ (will be created on server)
   - This README file

AFTER UPLOADING:
1. Create MySQL database in cPanel and import schema.sql
2. Setup Node.js App in cPanel (point to server.js)
3. Run NPM Install in cPanel Node.js interface
4. Start the application

FULL INSTRUCTIONS:
See: CPANEL_DEPLOYMENT_GUIDE.txt in the original project folder

================================================================================
