'use strict';

const redactedValue = '[REDACTED]';
const sensitiveKeyPatterns = [
  /access[_-]?token/i,
  /public[_-]?token/i,
  /link[_-]?token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /authorization/i,
  /account[_-]?number/i,
  /routing[_-]?number/i,
  /iban/i,
  /^mask$/i,
  /balance/i,
  /amount/i,
];

const shouldRedactKey = (key) =>
  sensitiveKeyPatterns.some((pattern) => pattern.test(key));

const redact = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      shouldRedactKey(key) ? redactedValue : redact(entryValue, seen),
    ]),
  );
};

const writeLog = (level, message, details) => {
  const payload = {
    level,
    message,
    at: new Date().toISOString(),
    ...(details ? { details: redact(details) } : {}),
  };

  console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
};

module.exports = {
  error: (message, details) => writeLog('error', message, details),
  info: (message, details) => writeLog('info', message, details),
  warn: (message, details) => writeLog('warn', message, details),
};
