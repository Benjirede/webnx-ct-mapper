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

Hi Ben! Looking forward to collab
