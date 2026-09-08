'use strict';

const multer = require('multer');

const TEN_MB = 10 * 1024 * 1024;

// Payslip PDFs are parsed in memory and never written to disk.
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TEN_MB,
  },
  fileFilter: (request, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('Payslip upload must be a PDF'));
      return;
    }

    callback(null, true);
  },
});
