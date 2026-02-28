/**
 * E2E Test Setup
 * Sets required environment variables for testing
 */

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-testing';
process.env.JWT_ISSUER = 'appfy-auth';
process.env.SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret';
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32chars!!';
process.env.ENCRYPTION_SALT = 'appfy-enc-test';
process.env.EMAIL_HASH_SALT = 'test-email-hash-salt';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
