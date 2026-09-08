#!/usr/bin/env bash
set -euo pipefail

: "${EC2_INSTANCE_ID:?Set EC2_INSTANCE_ID to the target backend instance id}"
: "${SSM_SERVICE_ROLE_ARN:?Set SSM_SERVICE_ROLE_ARN to the EventBridge role that can run SSM commands}"

RULE_NAME="${EVENTBRIDGE_RULE_NAME:-expense-tracker-monthly-plaid-sync}"
REGION="${AWS_REGION:-us-east-1}"
APP_DIR="${APP_DIR:-/opt/personal-finance}"
SCHEDULE_EXPRESSION="${SCHEDULE_EXPRESSION:-cron(0 10 1 * ? *)}"

aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "$SCHEDULE_EXPRESSION" \
  --state ENABLED \
  --region "$REGION"

aws events put-targets \
  --rule "$RULE_NAME" \
  --region "$REGION" \
  --targets "[
    {
      \"Id\": \"monthly-plaid-sync\",
      \"Arn\": \"arn:aws:ssm:${REGION}::document/AWS-RunShellScript\",
      \"RoleArn\": \"${SSM_SERVICE_ROLE_ARN}\",
      \"RunCommandParameters\": {
        \"RunCommandTargets\": [
          {
            \"Key\": \"InstanceIds\",
            \"Values\": [\"${EC2_INSTANCE_ID}\"]
          }
        ]
      },
      \"Input\": \"{\\\"commands\\\":[\\\"cd ${APP_DIR} && ./scripts/run-monthly-plaid-sync.sh\\\"]}\"
    }
  ]"

echo "EventBridge rule ${RULE_NAME} configured in ${REGION}"
