/**
 * Simple Node.js wrapper to start HTTP server with environment variables
 * This works better in WSL/Windows environments
 *
 * Copy this file and fill in your credentials, or use a .env file instead.
 */

// Set environment variables
process.env.UNOPIM_BASE_URL = 'https://your-instance.pim.dk';
process.env.UNOPIM_CLIENT_ID = 'your-client-id';
process.env.UNOPIM_CLIENT_SECRET = 'your-client-secret';
process.env.UNOPIM_USERNAME = 'your-username@example.com';
process.env.UNOPIM_PASSWORD = 'your-password';
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
