#!/bin/bash

set -e

chown -R personal-finance:personal-finance /opt/personal-finance

sudo -u personal-finance env HOME=/home/personal-finance bash -c '

  export NVM_DIR="$HOME/.nvm"

  source "$NVM_DIR/nvm.sh"

  cd /opt/personal-finance/node

  npm ci --omit=dev

'

/usr/bin/systemctl restart personal-finance

/usr/bin/systemctl is-active --quiet personal-finance