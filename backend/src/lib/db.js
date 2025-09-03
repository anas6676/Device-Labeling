import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/warehouse';

export const pool = new pg.Pool({ connectionString });

export async function initSchema() {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(`
			CREATE TABLE IF NOT EXISTS imports (
				id SERIAL PRIMARY KEY,
				batch_tag VARCHAR(255) NOT NULL,
				created_at TIMESTAMP DEFAULT NOW()
			);
		`);
		await client.query(`
			CREATE TABLE IF NOT EXISTS devices (
				id SERIAL PRIMARY KEY,
				sn_device VARCHAR(255) NOT NULL,
				import_id INT REFERENCES imports(id) ON DELETE CASCADE,
				full_name VARCHAR(255),
				email VARCHAR(255),
				phone_number VARCHAR(50),
				work_order VARCHAR(50),
				device_label VARCHAR(50),
				items_number TEXT,
				address TEXT,
				category VARCHAR(255),
				model_name VARCHAR(255),
				created_at TIMESTAMP DEFAULT NOW()
			);
		`);
		// Ensure column exists for user_info_raw
		await client.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name='devices' AND column_name='user_info_raw'
				) THEN
					ALTER TABLE devices ADD COLUMN user_info_raw TEXT;
				END IF;
			END
			$$;
		`);
		// Ensure columns exist for category and model_name
		await client.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name='devices' AND column_name='category'
				) THEN
					ALTER TABLE devices ADD COLUMN category VARCHAR(255);
				END IF;
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name='devices' AND column_name='model_name'
				) THEN
					ALTER TABLE devices ADD COLUMN model_name VARCHAR(255);
				END IF;
			END
			$$;
		`);
		await client.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_unique_sn_per_import
			ON devices (import_id, sn_device);
		`);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}