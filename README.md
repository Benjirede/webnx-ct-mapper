# WebNX Custom Tech (CT) Floor Asset & Project Mapper

An interactive, responsive digital twin dashboard built to solve physical inventory fragmentation and streamline workflow allocation inside the WebNX configuration lab.

## 🚀 The Business Problem Solved

Previously, hardware components assigned to large-scale, custom server builds were staged on warehouse pallets in the CT floor area with zero real-time visual tracking. This forced techs to manually search the floor to match physical pallets with incoming client project profiles, leading to time fragmentation.

This internal utility creates a localized **digital map grid** of the physical floor space, mapping spatial coordinate locations to active hardware batches and matching them directly with active profiles in the primary company database.

## 🛠️ Technical Stack

* **Framework:** Next.js 14 (App Router Architecture)
* **Frontend UI:** React, TypeScript, Tailwind CSS (Interactive Grid Engine)
* **Backend Data Layer:** Node.js API Routes with localized filesystem JSON stream caching for lightweight, zero-overhead execution behind strict datacenter firewalls.

## ⚙️ Key Architectural Implementations

* **Decoupled URL Integration:** Securely maps operational anchors to external company tracking IDs (`https://webnx.com[id]`) via clean URL parsing, providing immediate business utility without touching or risking production database integrity.
* **Responsive State Engine:** Utilizes React state to instantly track populated vs. empty spatial slots, flashing visual alerts (Tailwind dynamic styles) to prevent pallet allocation collisions.
* **Enterprise Asset Ready:** Engineered explicitly using JavaScript/TypeScript to natively align with WebNX's existing web property infrastructure (`webnx.com` and `gorillaservers.com`).


# 🐳 WebNX Tech Floor Digital Twin Mapper (Production Deployment)

This repository contains the production-optimized standalone container environment for mapping and tracking tech floor assets with built-in optimistic concurrency guards and atomic transaction handlers.

## 🚀 Quick Start Guide (The Easiest Method)

If your system has `make` installed, you can spin up and fully test the isolated application image using single-word automation tasks:

```bash
# 1. Initialize local dependencies & grant folder permissions
make setup

# 2. Compile and launch the production container stack
make run

# 3. Run the 5-point automated integration test suite
make test
```

Once `make run` completes, open your web browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🛠️ Manual Docker Deployment Commands

If you do not have `make` installed on your machine, execute this sequence sequentially to stand up the image environment manually:

### 1. Configure Host Folder Permissions
Ensure the container user has full read/write clearance to host file mappings for the database:
```bash
mkdir -p data && chmod 777 data
```

### 2. Compile the Production Image
Build the container using the offline dependency configuration:
```bash
docker build -t webnx-ct-mapper .
```

### 3. Spin up the Container Stack
Launch the container in detached mode, map port `3000`, and link the local database storage volume:
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name ct-mapper-prod \
  webnx-ct-mapper
```

### 4. Verify Local Execution Stability
Fire the integrated endpoint suite to ensure layout validations, 409 conflict catches, and atomic movement routines pass cleanly:
```bash
chmod +x test-image.sh
./test-image.sh
```

---

## 🧹 Tearing Down the Stack
To clear the container out of active memory and release port `3000`, run:
```bash
docker stop ct-mapper-prod && docker rm ct-mapper-prod
```
*(Your map layout data and audit histories will remain perfectly safe inside your local `./data` folder).*
