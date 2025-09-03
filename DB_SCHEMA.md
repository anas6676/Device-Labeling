## Database Schema

This document describes the current database schema used by the application.

### Tables

#### 1) `imports`
- **id**: SERIAL PRIMARY KEY
- **batch_tag**: VARCHAR(255) NOT NULL
- **created_at**: TIMESTAMP DEFAULT NOW()

Usage:
- Represents a batch (import session) that groups devices uploaded together.

Indexes / Constraints:
- Primary key on `id`.

#### 2) `devices`
- **id**: SERIAL PRIMARY KEY
- **sn_device**: VARCHAR(255) NOT NULL
- **import_id**: INT REFERENCES `imports`(id) ON DELETE CASCADE
- **full_name**: VARCHAR(255)
- **email**: VARCHAR(255)
- **phone_number**: VARCHAR(50)
- **work_order**: VARCHAR(50)
- **device_label**: VARCHAR(50)
- **items_number**: TEXT
- **address**: TEXT
- **category**: VARCHAR(255)
- **model_name**: VARCHAR(255)
- **user_info_raw**: TEXT
- **created_at**: TIMESTAMP DEFAULT NOW()

Usage:
- Stores device rows that belong to a specific import (batch).
- `user_info_raw` captures the original free-form user info string for parsing.
- `category` and `model_name` store optional metadata applied to devices (e.g. via Category/Model uploads).

Indexes / Constraints:
- Primary key on `id`.
- Foreign key `import_id` → `imports.id` with `ON DELETE CASCADE`.
- Unique index `idx_devices_unique_sn_per_import` on `(import_id, sn_device)` to prevent duplicate serial numbers within the same batch.

### Relationships
- One `imports` row can have many `devices` (1:N relationship via `devices.import_id`).
- Deleting an `imports` row cascades the delete to all related `devices` rows.

### Notes on Data Flow
- Excel upload endpoint (`POST /imports/:id/devices/upload`):
  - Default mode: reads rows as `[SN, Items Number]` and inserts/updates devices.
  - Category/Model metadata mode: if a header row contains both `Category` and `model name`, the upload sets `category` and `model_name` for all devices in the target batch.
- Device update endpoint (`PUT /devices/:id`):
  - Accepts structured fields directly, or parses `user_info` (raw pipe-separated string) into columns like `full_name`, `email`, `phone_number`, etc.

### Reports
- Asset Import report includes: `sn_device`, `items_number`, `category`, `model_name`.


