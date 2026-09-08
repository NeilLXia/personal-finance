'use strict';

require('dotenv').config({ quiet: true });

const { resolveDatabaseSecret } = require('./src/config/databaseSecret');

const main = async () => {
  await resolveDatabaseSecret();

  // Require these only after the secret has been loaded into the environment:
  // src/db/connection builds its pool from process.env at module load.
  const { createApp } = require('./src/app');
  const { startServer } = require('./src/server');

  await startServer(createApp());
};

main().catch((error) => {
  // The logger may not be loaded yet; keep this path dependency-free.
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
