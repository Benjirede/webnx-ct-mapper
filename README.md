# 🐳 WebNX Custom Tech Floor Asset & Project Mapper

An interactive digital twin dashboard built to solve physical inventory fragmentation and streamline workflow allocation inside the WebNX configuration lab.

## 🚀 The Business Problem Solved

Previously, hardware components assigned to large-scale custom builds were staged on warehouse pallets in the CT floor area with zero real-time tracking. Technicians had to manually search the physical floor to match pallets with incoming project profiles.

This utility creates a localized **digital map grid** of the physical floor space, mapping spatial coordinate locations to active hardware batches and matching them directly with active profiles in the primary company database.

---

## 🛠️ Technical Stack & Architecture

* **Framework:** Next.js 15 (App Router Architecture)
* **Frontend UI:** React 19, TypeScript, Tailwind CSS (Interactive Grid Engine)
* **Database Layer:** SQLite (`better-sqlite3`) with explicit atomicity and multi-statement transaction wrappers.
* **Concurrency Engine:** Optimistic locking via incremental database state version checks protecting record mutations from race conditions.
* **Cross-Platform Standalone Container:** Multi-stage Docker build utilizing an offline dependency cache engine to bypass cross-compilation native binary timeouts during compilation layers.

---

## 📋 Onboarding Prerequisites

Every developer or manager testing this application must have **Docker** installed and running on their local machine:

### 🪟 Windows Users
* Download and install **Docker Desktop**: [://docker.com](https://www.://docker.com). Ensure the Docker Desktop app is launched and active in your taskbar.

### 🍏 macOS Users
* Download and install **Docker Desktop**: [://docker.com](https://www.://docker.com). Ensure the app is launched and active.

### 🐧 Ubuntu Linux Users
Open your native terminal workspace and run the following command pipeline to install the engine and unlock permission restrictions:
```bash
sudo apt update && sudo apt install -y docker.io make git
sudo usermod -aG docker $USER
```
*⚠️ **Crucial Note:** You **must reboot your system** after executing the user group commands for the configuration permissions to bind correctly.*

---

## 🚀 One-Command Quick Start Guide

Clone the codebase and move into the project root directory before choosing your platform's single-step deployment shortcut below:
```bash
git clone <your-company-git-repo-url>/webnx-ct-mapper.git
cd webnx-ct-mapper
```

### 🍏 macOS & 🐧 Linux Users (Using Make)
Open your terminal window and execute the automated setup pipeline:
```bash
make setup && make run
```

### 🪟 Windows Users (Using Native PowerShell)
Open a standard Windows PowerShell prompt (or right-click the folder and select *Open in Terminal*) and execute the native execution script:
```powershell
.\run-stack.ps1
```

Once your script path finishes running, your deployment stack is fully live! Open your browser and navigate directly to:
👉 **`http://localhost:3000`**

---

## 🧪 Verifying Environment Integrity

To fire the automated 5-point production integration suite (verifying layout states, 409 concurrency lock catches, and single-transaction atomic move handlers), choose your platform validation task:

* **macOS / Linux:** Run `make test`
* **Windows:** Run `./test-image.sh` within Git Bash or your terminal prompt.

---

## 🧹 Tearing Down the Stack

To purge the active application container from your system's host memory and immediately release the port `3000` network bind, execute your cleanup hook:

* **macOS / Linux:** Run `make stop`
* **Windows:** Run `docker stop ct-mapper-prod && docker rm ct-mapper-prod`

*(Your active map layout states, metadata profiles, and audit ledger timelines will remain completely safe inside your local `./data` directory folder for future runs).*
