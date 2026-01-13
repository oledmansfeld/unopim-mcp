/**
 * Simple Node.js wrapper to start HTTP server with environment variables
 * This works better in WSL/Windows environments
 */

// Set environment variables
process.env.UNOPIM_BASE_URL = 'http://REDACTED-IP:8000';
process.env.UNOPIM_CLIENT_ID = 'REDACTED-CLIENT-ID';
process.env.UNOPIM_CLIENT_SECRET = 'REDACTED-SECRET';
process.env.UNOPIM_USERNAME = 'REDACTED-EMAIL';
process.env.UNOPIM_PASSWORD = 'REDACTED-PASSWORD';
process.env.UNOPIM_DEFAULT_LOCALE = 'da_DK';
process.env.UNOPIM_DEFAULT_CURRENCY = 'DKK';
process.env.PORT = process.env.PORT || '3000';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Starting UnoPim MCP Server (HTTP Mode)                  ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');
console.log('Configuration:');
console.log(`  Base URL: ${process.env.UNOPIM_BASE_URL}`);
console.log(`  Port: ${process.env.PORT}`);
console.log('');

// Import and run the server
import('./dist/index-http.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
