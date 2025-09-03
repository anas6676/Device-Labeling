import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pool, initSchema } from './lib/db.js';
import { parseUserInfo } from './lib/parsers.js';
import { generateReports } from './lib/reports.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// Create a new batch
app.post('/imports', async (req, res) => {
	try {
		const { batch_tag } = req.body || {};
		if (!batch_tag) return res.status(400).json({ error: 'batch_tag is required' });
		const { rows } = await pool.query(
			'INSERT INTO imports (batch_tag) VALUES ($1) RETURNING *',
			[batch_tag]
		);
		return res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to create batch' });
	}
});

// Edit batch tag
app.put('/imports/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { batch_tag } = req.body || {};
		if (!batch_tag || !batch_tag.trim()) return res.status(400).json({ error: 'batch_tag is required' });
		const { rows } = await pool.query('UPDATE imports SET batch_tag = $1 WHERE id = $2 RETURNING *', [batch_tag.trim(), id]);
		if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
		return res.json(rows[0]);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to update batch' });
	}
});

// Delete batch (cascades to devices)
app.delete('/imports/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const result = await pool.query('DELETE FROM imports WHERE id = $1', [id]);
		return res.status(204).send();
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to delete batch' });
	}
});

// Upload Excel with SNs, insert devices
app.post('/imports/:id/devices/upload', upload.single('file'), async (req, res) => {
	try {
		const importId = Number(req.params.id);
		if (!Number.isFinite(importId)) return res.status(400).json({ error: 'Invalid import id' });
		if (!req.file) return res.status(400).json({ error: 'file is required (Excel)' });

		const buffer = req.file.buffer;
		const xlsx = await import('xlsx');
		const workbook = xlsx.read(buffer, { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];
		const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

		// Detect Category/model-name metadata upload
		if (Array.isArray(rows) && rows.length > 0) {
			const headerRow = rows[0].map((v) => String(v || '').trim().toLowerCase());
			const categoryCol = headerRow.findIndex((h) => h === 'category');
			const modelNameCol = headerRow.findIndex((h) => h === 'model name' || h === 'model_name' || h === 'model');
			if (categoryCol !== -1 && modelNameCol !== -1) {
				// Find first data row with at least one non-empty value
				let categoryVal = null;
				let modelNameVal = null;
				for (let r = 1; r < rows.length; r++) {
					const row = rows[r] || [];
					const c = row[categoryCol] != null ? String(row[categoryCol]).trim() : '';
					const m = row[modelNameCol] != null ? String(row[modelNameCol]).trim() : '';
					if (c || m) {
						categoryVal = c || null;
						modelNameVal = m || null;
						break;
					}
				}
				// If no data row found, treat as empty
				const { rowCount } = await pool.query(
					`UPDATE devices SET category = $1, model_name = $2 WHERE import_id = $3`,
					[categoryVal, modelNameVal, importId]
				);
				return res.json({ updated_devices: rowCount, category: categoryVal, model_name: modelNameVal });
			}
		}

		const headerValuesToSkip = new Set(['sn', 'serial', 'serial number', 'sn_device', 'device_sn', 'category', 'model name', 'model_name', 'model']);
		const pairs = [];
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			const firstCell = row[0];
			if (!firstCell) continue;
			const sn = String(firstCell).trim();
			if (!sn) continue;
			if (headerValuesToSkip.has(sn.toLowerCase())) continue;
			const items = row[1] != null ? String(row[1]).trim() : null;
			pairs.push({ sn, items_number: items });
		}

		if (pairs.length === 0) return res.status(400).json({ error: 'No serial numbers found' });

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			for (const { sn, items_number } of pairs) {
				await client.query(
					`INSERT INTO devices (sn_device, import_id, items_number)
					 VALUES ($1, $2, $3)
					 ON CONFLICT (import_id, sn_device) DO UPDATE SET items_number = COALESCE(EXCLUDED.items_number, devices.items_number)`,
					[sn, importId, items_number || null]
				);
			}
			await client.query('COMMIT');
		} catch (e) {
			await client.query('ROLLBACK');
			throw e;
		} finally {
			client.release();
		}

		return res.json({ inserted: pairs.length });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to upload devices' });
	}
});

// List all batches
app.get('/imports', async (req, res) => {
	try {
		const { rows } = await pool.query('SELECT * FROM imports ORDER BY created_at DESC');
		return res.json(rows);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to list imports' });
	}
});

// List devices in a batch
app.get('/imports/:id/devices', async (req, res) => {
	try {
		const importId = Number(req.params.id);
		const { rows } = await pool.query('SELECT * FROM devices WHERE import_id = $1 ORDER BY id ASC', [importId]);
		return res.json(rows);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to list devices' });
	}
});

// List all devices (for database manager)
app.get('/devices/all', async (req, res) => {
	try {
		const { rows } = await pool.query('SELECT * FROM devices ORDER BY id ASC');
		return res.json(rows);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to list all devices' });
	}
});

// Bulk update devices from Excel by sn_device
app.post('/devices/bulk-update', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file is required (Excel)' });

        const buffer = req.file.buffer;
        const xlsx = await import('xlsx');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (!rows || rows.length < 2) {
            return res.status(400).json({ error: 'No data rows found in sheet' });
        }

        const headerRow = rows[0].map((v) => String(v || '').trim());
        // Map headers (case-insensitive trim)
        const idxOf = (nameVariants) => {
            const lower = headerRow.map((h) => h.toLowerCase());
            for (const variant of nameVariants) {
                const i = lower.indexOf(variant.toLowerCase());
                if (i !== -1) return i;
            }
            return -1;
        };

        const serialCol = idxOf(['serial', 'sn', 'sn_device', 'serial number']);
        const frdcCol = idxOf(['frdc']);
        const taskCodeCol = idxOf(['taskcode', 'task code']);
        const nameCol = idxOf(['name', 'full_name', 'full name']);
        const addressCol = idxOf(['address']);
        const emailCol = idxOf(['useremail', 'email', 'user email']);
        const phoneCol = idxOf(['userphone', 'phone', 'user phone']);

        if (serialCol === -1) {
            return res.status(400).json({ error: 'Missing required column: Serial' });
        }

        let updated = 0;
        let skipped = 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r] || [];
                const serial = row[serialCol] != null ? String(row[serialCol]).trim() : '';
                if (!serial) { skipped++; continue; }

                const mapped = {
                    device_label: frdcCol !== -1 && row[frdcCol] != null ? String(row[frdcCol]).trim() : null,
                    items_number: taskCodeCol !== -1 && row[taskCodeCol] != null ? String(row[taskCodeCol]).trim() : null,
                    full_name: nameCol !== -1 && row[nameCol] != null ? String(row[nameCol]).trim() : null,
                    address: addressCol !== -1 && row[addressCol] != null ? String(row[addressCol]).trim() : null,
                    email: emailCol !== -1 && row[emailCol] != null ? String(row[emailCol]).trim() : null,
                    phone_number: phoneCol !== -1 && row[phoneCol] != null ? String(row[phoneCol]).trim() : null
                };

                const result = await client.query(
                    `UPDATE devices SET
                        device_label = COALESCE($2, device_label),
                        items_number = COALESCE($3, items_number),
                        full_name = COALESCE($4, full_name),
                        address = COALESCE($5, address),
                        email = COALESCE($6, email),
                        phone_number = COALESCE($7, phone_number)
                     WHERE sn_device = $1`,
                    [
                        serial,
                        mapped.device_label,
                        mapped.items_number,
                        mapped.full_name,
                        mapped.address,
                        mapped.email,
                        mapped.phone_number
                    ]
                );
                updated += result.rowCount || 0;
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return res.json({ updated, skipped });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to bulk update devices' });
    }
});

// Update device with parsing
app.put('/devices/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { user_info, items_number, address, sn_device, import_id, full_name, email, phone_number, work_order, device_label } = req.body || {};
		
		// If direct database update (not from parsing)
		if (sn_device !== undefined) {
			const { rows } = await pool.query(
				`UPDATE devices SET
				  sn_device = $1,
				  import_id = $2,
				  full_name = $3,
				  email = $4,
				  phone_number = $5,
				  work_order = $6,
				  device_label = $7,
				  items_number = $8,
				  address = $9
				WHERE id = $10
				RETURNING *`,
				[sn_device, import_id, full_name, email, phone_number, work_order, device_label, items_number, address, id]
			);
			return res.json(rows[0]);
		}
		
		// Original parsing logic
		const parsed = user_info ? parseUserInfo(user_info) : {};
		const values = [
			parsed.full_name || null,
			parsed.email || null,
			parsed.phone_number || null,
			parsed.work_order || null,
			parsed.device_label || null,
			parsed.sn_device || null,
			items_number || null,
			address || null,
			user_info || null,
			id
		];
		const { rows } = await pool.query(
			`UPDATE devices SET
			  full_name = $1,
			  email = $2,
			  phone_number = $3,
			  work_order = $4,
			  device_label = $5,
			  sn_device = COALESCE($6, sn_device),
			  items_number = $7,
			  address = $8,
			  user_info_raw = $9
			WHERE id = $10
			RETURNING *`,
			values
		);
		return res.json(rows[0]);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to update device' });
	}
});

// Delete device
app.delete('/devices/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		await pool.query('DELETE FROM devices WHERE id = $1', [id]);
		return res.status(204).send();
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to delete device' });
	}
});

// Report endpoints (aliases)
app.get('/imports/:id/reports/label-carton', (req, res) => handleReport(req, res, 'label-carton'));
app.get('/imports/:id/reports/device-label', (req, res) => handleReport(req, res, 'device-label'));
app.get('/imports/:id/reports/asset-import', (req, res) => handleReport(req, res, 'asset-import'));

app.get('/imports/:id/reports/:type', (req, res) => handleReport(req, res, req.params.type));

async function handleReport(req, res, type) {
	try {
		const importId = Number(req.params.id);
		const format = (req.query.format || 'xlsx').toString();
		const { rows } = await pool.query('SELECT * FROM devices WHERE import_id = $1 ORDER BY id ASC', [importId]);
		const { buffer, filename, contentType } = await generateReports(type, format, rows);
		res.setHeader('Content-Type', contentType);
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		return res.send(buffer);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Failed to generate report' });
	}
}

const port = process.env.PORT || 3000;

initSchema()
	.then(() => {
		app.listen(port, () => console.log(`API on http://0.0.0.0:${port}`));
	})
	.catch((e) => {
		console.error('Failed to init schema', e);
		process.exit(1);
	});