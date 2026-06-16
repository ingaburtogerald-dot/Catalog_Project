const fs = require('fs');
let admin = fs.readFileSync('assets/js/admin.js', 'utf8');

const sessionCode = `window.clearGyroSession = function() {
  localStorage.removeItem('gyro_admin_logged_in');
  localStorage.removeItem('gyro_admin_dev_mode');
  localStorage.removeItem('gyro_user_name');
  localStorage.removeItem('gyro_user_photo');
  localStorage.removeItem('gyro_user_role');
  localStorage.removeItem('gyro_user_roles');
  localStorage.removeItem('gyro_last_activity');
  sessionStorage.removeItem('gyro_welcome_shown');
};

`;

if (!admin.includes('window.clearGyroSession')) {
  admin = sessionCode + admin;
}

// Fix btnLogout
admin = admin.replace(
  /btnLogout\.addEventListener\('click', \(\) => \{\s+closeSettingsModal\(\);\s+localStorage\.removeItem\('gyro_admin_logged_in'\);\s+localStorage\.removeItem\('gyro_admin_dev_mode'\);/,
  "btnLogout.addEventListener('click', () => {\n      closeSettingsModal();\n      window.clearGyroSession();"
);

// Fix URL logout
admin = admin.replace(
  /if \(urlParams\.get\('logout'\) === 'true'\) \{\s+localStorage\.removeItem\('gyro_admin_logged_in'\);\s+localStorage\.removeItem\('gyro_admin_dev_mode'\);\s+if \(isDevMode \|\| urlParams\.get\('logout'\) === 'true'\) \{\s+const fromPage = urlParams\.get\('from'\) \|\| 'index\.html';\s+window\.location\.href = fromPage;\s+return;\s+\}\s+\}/g,
  "if (urlParams.get('logout') === 'true') {\n    window.clearGyroSession();\n    if (isDevMode) {\n      const fromPage = urlParams.get('from') || 'index.html';\n      window.location.href = fromPage;\n      return;\n    }\n  }"
);

// Fix trailing logout logic
admin = admin.replace(
  /if \(urlParams\.get\('logout'\) === 'true'\) \{\s+signOut\(auth\)\.then\(\(\) => \{\s+window\.location\.href = urlParams\.get\('from'\) \|\| 'index\.html';\s+\}\)\.catch\(\(\) => \{\s+window\.location\.href = urlParams\.get\('from'\) \|\| 'index\.html';\s+\}\);\s+return;\s+\}/g,
  "if (urlParams.get('logout') === 'true') {\n    window.clearGyroSession();\n    signOut(auth).then(() => {\n      window.location.href = urlParams.get('from') || 'index.html';\n    }).catch(() => {\n      window.location.href = urlParams.get('from') || 'index.html';\n    });\n    return;\n  }"
);

fs.writeFileSync('assets/js/admin.js', admin);
console.log('Fixed admin.js safely');
