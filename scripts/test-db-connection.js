#!/usr/bin/env node
/**
 * Quick script to test the database connection and URL encoding.
 * Run with: node scripts/test-db-connection.js
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Helper to URL-encode password if needed
function encodePassword(password) {
  return encodeURIComponent(password);
}

// Helper to rebuild connection string with encoded password
function rebuildConnectionString(originalUrl) {
  const match = originalUrl.match(/^(postgresql:\/\/[^:]+:)([^@]+)(@.+)$/);
  if (!match) {
    return originalUrl; // Can't parse, return as-is
  }
  const [, prefix, password, suffix] = match;
  const encodedPassword = encodePassword(password);
  return `${prefix}${encodedPassword}${suffix}`;
}

async function testConnection() {
  const originalUrl = process.env.DATABASE_URL;
  
  if (!originalUrl) {
    console.error('❌ DATABASE_URL is not set in your .env file');
    process.exit(1);
  }

  console.log('Original DATABASE_URL:', originalUrl);
  
  // Check if password contains special characters that need encoding
  const match = originalUrl.match(/^postgresql:\/\/[^:]+:([^@]+)@/);
  if (match) {
    const password = match[1];
    const needsEncoding = /[<>(){}[\]\\^`|~\s]/.test(password);
    
    if (needsEncoding) {
      console.log('\n⚠️  Password contains special characters that should be URL-encoded');
      console.log('Encoded password:', encodePassword(password));
      const encodedUrl = rebuildConnectionString(originalUrl);
      console.log('\n✅ Properly encoded DATABASE_URL:');
      console.log(encodedUrl);
      console.log('\nTrying connection with encoded URL...\n');
      
      // Try with encoded URL
      const pool = new Pool({
        connectionString: encodedUrl,
        ssl: { rejectUnauthorized: false },
      });

      try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
        console.log('✅ Connection successful!');
        console.log('Database:', result.rows[0].db_name);
        console.log('Server time:', result.rows[0].current_time);
        client.release();
        await pool.end();
        return;
      } catch (err) {
        console.error('❌ Connection failed with encoded URL:', err.message);
        await pool.end();
      }
    }
  }

  // Try original URL
  console.log('\nTrying connection with original URL...\n');
  const pool = new Pool({
    connectionString: originalUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log('✅ Connection successful!');
    console.log('Database:', result.rows[0].db_name);
    console.log('Server time:', result.rows[0].current_time);
    client.release();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();

