[![Website](https://img.shields.io/badge/Project-Live-black?style=for-the-badge)](https://invoicepro-caf2e.web.app/)

# Smart InvoicePro (InvoicePro-Caf2e) 🚀

InvoicePro-Caf2e is a full-featured invoice management web application designed to simplify invoice creation and customer management. Users can create, edit, save, and track invoices while accessing a powerful dashboard with analytics and invoice history.

```text
  [ Client Browser UI ] ─── (Manages UI Layout) ───> [ Bootstrap 5.3 ]
         │
         ├─── (Calculations & Charts) ───> [ script.js ]
         │
         └─── (Secure Data Handshake) ───> [ Google Firebase Suite ]
                                                  ├── Authentication
                                                  ├── Cloud Firestore
                                                  └── Hosting CDN

### 🚀 Core Platform Features
* **📊 Analytics Aggregator:** Compiles asynchronous Firestore data streams to compute real-time operational metrics like Gross Revenue and Monthly Growth.
* **🧾 Calculative Invoice Core:** Fast client-side computation layer executing tax matrix assessments and discount calculations with zero latency.
* **👥 CRM Indexer:** Relational document association linking specific client data profiles directly to their historical tracking logs.
* **🕒 Temporal Status Ledger:** An immutable state timeline management setup reflecting real-time validation properties: `Paid`, `Pending`, or `Overdue`.

---
### 🛠️ Tech Stack & Architecture

| Layer | Technologies / Components |
| :--- | :--- |
| **Frontend Core** | `HTML5`, `CSS3`, `JavaScript` |
| **UI Framework** | `Bootstrap v5.3` (Utility-first configurations & responsive grids) |
| **Data Visualization** | `script.js ` |
| **Cloud Infrastructure (BaaS)** | `Google Firebase Suite` (`Firestore`, `Authentication`, `Hosting`) |

---

### 📂 Physical Directory Mapping

This project contains a minimal, optimized footprint of production-ready asset files:

```text
├── .firebaserc       # JSON token mapping this local folder to your remote Firebase Project
├── firebase.json     # Configuration handling edge routing, security parameters, and web assets
├── index.html        # Core Single Entry Point layout document (The user interface)
├── style.css         # Custom layout stylesheets, visual typography, and component adjustments
├── script.js         # Core application engine handling math logic and Firestore data handshakes
└── server            # Supplementary environment deployment configurations
