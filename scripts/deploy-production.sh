#!/bin/bash
set -e

sudo -iu personal-finance bash -lc '
  cd /opt/personal-finance/node
  npm ci --omit=dev
'

/usr/bin/systemctl restart personal-finance
/usr/bin/systemctl is-active --quiet personal-finance