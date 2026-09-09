#!/bin/bash
set -e

cd /opt/personal-finance/node

npm ci --omit=dev

sudo systemctl restart personal-finance
sudo systemctl is-active --quiet personal-finance

