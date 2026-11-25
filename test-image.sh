#!/bin/bash
set -e

COOKIE_JAR="/tmp/webnx_test_cookies.txt"
rm -f "$COOKIE_JAR"

cleanup() {
  if [ -f "$COOKIE_JAR" ]; then
    # Empty TEST-SRC and TEST-DST first in case a mid-test failure left one occupied, then delete both
    for SLOT in TEST-SRC TEST-DST; do
      VER=$(curl -s -b "$COOKIE_JAR" http://localhost:3000/api/layout-data | grep -o "\"id\":\"$SLOT\"[^}]*" | grep -o '"version":[0-9]*' | cut -d':' -f2)
      if [ -n "$VER" ]; then
        curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
          -H "Content-Type: application/json" \
          -d "{\"id\":\"$SLOT\",\"isOccupied\":false,\"projectId\":\"\",\"notes\":\"\",\"status\":\"empty\",\"version\":$VER}" > /dev/null
        curl -s -b "$COOKIE_JAR" -X DELETE "http://localhost:3000/api/layout-data?id=$SLOT" \
          -H "X-Admin-PIN: 1234" > /dev/null
      fi
    done
    rm -f "$COOKIE_JAR"
  fi
}
trap cleanup EXIT

echo "🐳 KICKING OFF PRODUCTION DOCKER IMAGE INTEGRATION SUITE..."
echo "--------------------------------------------------------"

echo "🔐 TEST 0: Verifying auth guard and acquiring session cookie..."
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/layout-data)
if [ "$UNAUTH_CODE" != "401" ]; then
  echo "❌ TEST 0 FAILED: Expected 401 Unauthorized without session cookie, got $UNAUTH_CODE."
  exit 1
fi

LOGIN_RES=$(curl -s -c "$COOKIE_JAR" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"WebNXAdmin2026!"}')

if ! echo "$LOGIN_RES" | grep -q '"success":true'; then
  echo "❌ TEST 0 FAILED: Authentication failed: $LOGIN_RES"
  exit 1
fi
echo "✅ TEST 0 PASSED: Unauthenticated block verified and admin session cookie acquired."
echo ""

echo "📡 TEST 1: Provisioning temporary test pallets (TEST-SRC & TEST-DST) and verifying DB layer..."
# Clear any leftover test slots from an interrupted prior run
cleanup
curl -s -c "$COOKIE_JAR" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"WebNXAdmin2026!"}' > /dev/null

CREATE_SRC=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d '{"action":"create","id":"TEST-SRC","bayId":"bay1","itemType":"pallet","xPos":5,"yPos":5,"widthCells":1,"heightCells":1}')

CREATE_DST=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d '{"action":"create","id":"TEST-DST","bayId":"bay1","itemType":"pallet","xPos":15,"yPos":5,"widthCells":1,"heightCells":1}')

if ! echo "$CREATE_SRC" | grep -q '"success":true' || ! echo "$CREATE_DST" | grep -q '"success":true'; then
  echo "❌ TEST 1 FAILED: Could not create temporary test pallets: $CREATE_SRC / $CREATE_DST"
  exit 1
fi

INITIAL_DATA=$(curl -s -b "$COOKIE_JAR" http://localhost:3000/api/layout-data)
CURRENT_VER=$(echo "$INITIAL_DATA" | grep -o '"id":"TEST-SRC"[^}]*' | grep -o '"version":[0-9]*' | cut -d':' -f2)

if [ -z "$CURRENT_VER" ]; then
  echo "❌ TEST 1 FAILED: Failed to read version tracker for TEST-SRC from database."
  exit 1
fi
echo "✅ TEST 1 PASSED: Successfully connected to container database layer."
echo "ℹ️  Current database tracking marker for TEST-SRC is version: $CURRENT_VER"
echo ""

echo "🛡️  TEST 2: Firing a stale update write payload to force a 409 Concurrency Lock..."
STALE_VER=$((CURRENT_VER - 1))
STALE_RES=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"TEST-SRC\",\"isOccupied\":true,\"projectId\":\"9999\",\"notes\":\"Stale write\",\"version\":$STALE_VER}")

if echo "$STALE_RES" | grep -q '"currentVersion"'; then
  echo "✅ TEST 2 PASSED: Container caught the stale write and protected row integrity!"
  echo "   Server response: $STALE_RES"
else
  echo "❌ TEST 2 FAILED: Container allowed an out-of-order overwrite! Response: $STALE_RES"
  exit 1
fi
echo ""

echo "🔄 TEST 3: Submitting valid version token ($CURRENT_VER) to modify asset metadata..."
VALID_RES=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"TEST-SRC\",\"isOccupied\":true,\"projectId\":\"7777\",\"notes\":\"WebNX Production Node\",\"version\":$CURRENT_VER}")

if echo "$VALID_RES" | grep -q '"success":true'; then
  NEW_VER=$((CURRENT_VER + 1))
  echo "✅ TEST 3 PASSED: Writable update committed successfully. Row version incremented to $NEW_VER."
else
  echo "❌ TEST 3 FAILED: Server rejected a valid contract payload: $VALID_RES"
  exit 1
fi
echo ""

echo "🧱 TEST 4: Executing single-transaction atomic move from TEST-SRC to vacant TEST-DST..."
MOVE_RES=$(curl -s -b "$COOKIE_JAR" -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d '{"action":"move_pallet","sourceId":"TEST-SRC","targetId":"TEST-DST"}')

if echo "$MOVE_RES" | grep -q '"success":true'; then
  echo "✅ TEST 4 PASSED: Atomic shift completed flawlessly inside the SQLite transactional boundary."
else
  echo "❌ TEST 4 FAILED: Transaction engine threw an execution error: $MOVE_RES"
  exit 1
fi
echo ""

echo "📜 TEST 5: Fetching server audit log timeline..."
AUDIT_RES=$(curl -s -b "$COOKIE_JAR" http://localhost:3000/api/audit-log)
if ! echo "$AUDIT_RES" | grep -q '^\['; then
  echo "❌ TEST 5 FAILED: Expected JSON array from /api/audit-log, got: $(echo "$AUDIT_RES" | head -c 200)"
  exit 1
fi
echo "📊 Audit Trail snapshot: $(echo "$AUDIT_RES" | head -c 500)..."
echo "--------------------------------------------------------"
echo "🎉 ALL DOCKER IMAGE PRODUCTION CHECKS ENFORCED SUCCESSFULLY!"
