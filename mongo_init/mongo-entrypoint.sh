#!/bin/bash
set -e

echo "======================= add user ======================="

mongosh --quiet <<EOF
use $MONGO_DB_NAME

db.createUser({
  user: "$MONGO_USER",
  pwd: "$MONGO_PWD",
  roles: [
    {
      role: "readWrite",
      db: "$MONGO_DB_NAME"
    }
  ]
})
EOF

echo "======================= end add user ======================="
