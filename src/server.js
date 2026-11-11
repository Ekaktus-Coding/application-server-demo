let config;
try {
  config = require('./config');
} catch (error) {
  console.error(`Startup configuration error: ${error.message}`);
  process.exit(1);
}

const app = require('./app');
const { seedUsers } = require('./data/users');

async function startServer() {
  try {
    // Seed demo accounts before accepting any requests
    await seedUsers();

    const server = app.listen(config.PORT, () => {
      console.log(`Server listening on http://localhost:${config.PORT}`);
    });

    server.on('error', (error) => {
      console.error(`Server error: ${error.message}`);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error(`Startup error: ${error.message}`);
    process.exit(1);
  }
}

// Start the server if this script is executed directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
