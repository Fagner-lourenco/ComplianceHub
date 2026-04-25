/**
 * Helper: Structured Logger
 * Outputs JSON-formatted logs for Cloud Logging ingestion.
 */

/**
 * Log levels aligned with Cloud Logging severity.
 */
const LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

function log(level, message, meta = {}) {
  const entry = {
    severity: level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Use console methods appropriate to severity
  if (level === LEVELS.ERROR || level === LEVELS.CRITICAL) {
    console.error(JSON.stringify(entry));
  } else if (level === LEVELS.WARNING) {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function debug(message, meta) { log(LEVELS.DEBUG, message, meta); }
function info(message, meta) { log(LEVELS.INFO, message, meta); }
function warn(message, meta) { log(LEVELS.WARNING, message, meta); }
function error(message, meta) { log(LEVELS.ERROR, message, meta); }
function critical(message, meta) { log(LEVELS.CRITICAL, message, meta); }

module.exports = { log, debug, info, warn, error, critical, LEVELS };
