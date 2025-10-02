const fs = require('fs');
const path = require('path');

// Function to read and display log files
function viewLogs() {
  const logDir = path.join(__dirname, '..', 'logs');
  
  if (!fs.existsSync(logDir)) {
    console.log('No logs directory found');
    return;
  }
  
  const logFiles = fs.readdirSync(logDir);
  
  if (logFiles.length === 0) {
    console.log('No log files found');
    return;
  }
  
  console.log('Available log files:');
  logFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  // Display contents of each log file
  logFiles.forEach(file => {
    const filePath = path.join(logDir, file);
    console.log(`\n=== Contents of ${file} ===`);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(content || 'No content');
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  });
}

viewLogs();