'use strict';

const express = require('express');

const payslipService = require('../services/payslipService');
const { route } = require('../http/asyncRoute');
const { uploadLimiter } = require('../middleware/rateLimiters');
const payslipUpload = require('../middleware/payslipUpload');
const { requirePdfUpload } = require('../http/requestParsers');

const router = express.Router();

router.get(
  '/payslips',
  route(async (request, response) => {
    response.json(await payslipService.listPayslips());
  }),
);

router.post(
  '/payslips/upload',
  uploadLimiter,
  payslipUpload.single('payslip_pdf'),
  route(async (request, response) => {
    const file = requirePdfUpload(request);

    response.json(
      await payslipService.uploadPayslipPdf({
        originalFilename: file.originalname || 'payslip.pdf',
        buffer: file.buffer,
      }),
    );
  }),
);

module.exports = router;
