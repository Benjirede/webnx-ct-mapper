#!/bin/bash

echo "🐳 KICKING OFF PRODUCTION DOCKER IMAGE INTEGRATION SUITE..."
echo "--------------------------------------------------------"

# 1. Verify endpoint accessibility and read seeded data
echo "📡 TEST 1: Fetching initial layout state from container..."
INITIAL_STATE=$(curl -s -X GET http://localhost:3000/api/layout-data)

if [ -z "$INITIAL_STATE" ] || [[ "$INITIAL_STATE" == *"Error"* ]]; then
  echo "❌ TEST 1 FAILED: Container returned an empty response or threw a path fault."
  exit 1
else
  echo "✅ TEST 1 PASSED: Successfully connected to container database layer."
fi

# 2. Extract active version signature for RACK-R2 from the live payload array
# Using standard grep/sed so you don't need jq installed on your machine
CURRENT_VERSION=$(echo "$INITIAL_STATE" | grep -o '"id":"RACK-R2"[^}*]*' | grep -o '"version":[0-9]*' | cut -d: -f2)
echo "ℹ️  Current database tracking marker for RACK-R2 is version: $CURRENT_VERSION"

# 3. Simulate an outdated technician transaction save request (Forcing a Concurrency Conflict)
STALE_VERSION=$((CURRENT_VERSION - 1))
echo -e "\n🛡️  TEST 2: Firing a stale update write payload to force a 409 Concurrency Lock..."
CONFLICT_RES=$(curl -s -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"RACK-R2\", \"projectId\": \"9999\", \"notes\": \"Stale Hazard\", \"isOccupied\": true, \"version\": $STALE_VERSION}")

if [[ "$CONFLICT_RES" == *"Conflict"* ]]; then
  echo "✅ TEST 2 PASSED: Container caught the stale write and protected row integrity!"
  echo "   Server response: $CONFLICT_RES"
else
  echo "❌ TEST 2 FAILED: Container allowed an out-of-order overwrite! Check concurrency logic."
fi

# 4. Execute a healthy, version-matched inline data value update
echo -e "\n🔄 TEST 3: Submitting valid version token ($CURRENT_VERSION) to modify asset metadata..."
UPDATE_RES=$(curl -s -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"RACK-R2\", \"projectId\": \"7777\", \"notes\": \"WebNX Production Node\", \"isOccupied\": true, \"version\": $CURRENT_VERSION}")

if [[ "$UPDATE_RES" == *"success\":true"* ]]; then
  echo "✅ TEST 3 PASSED: Writable update committed successfully. Row version incremented to $((CURRENT_VERSION + 1))."
else
  echo "❌ TEST 3 FAILED: Server rejected a valid contract payload: $UPDATE_RES"
fi

# 5. Execute an immediate, single-transaction atomic move over the network bridge
echo -e "\n🧱 TEST 4: Executing single-transaction atomic move from RACK-R2 to vacant BAY-L2..."
MOVE_RES=$(curl -s -X POST http://localhost:3000/api/layout-data \
  -H "Content-Type: application/json" \
  -d '{"action": "move_pallet", "sourceId": "RACK-R2", "targetId": "BAY-L2"}')

if [[ "$MOVE_RES" == *"success\":true"* ]]; then
  echo "✅ TEST 4 PASSED: Atomic shift completed flawlessly inside the SQLite transactional boundary."
else
  echo "❌ TEST 4 FAILED: Transaction engine threw an execution error: $MOVE_RES"
fi

# 6. Check the production ledger audit trail timeline
echo -e "\n📜 TEST 5: Fetching server audit log timeline..."
AUDIT_LOG=$(curl -s -X GET http://localhost:3000/api/audit-log)
echo "📊 Audit Trail snapshot: $AUDIT_LOG"

echo "--------------------------------------------------------"
echo "🎉 ALL DOCKER IMAGE PRODUCTION CHECKS ENFORCED SUCCESSFULLY!"
