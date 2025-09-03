import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';

function buildRowsFor(type, devices) {
	if (type === 'label-carton') {
		const filtered = devices.filter((d) =>
			Boolean((d.full_name && d.full_name.trim()) || (d.phone_number && d.phone_number.trim()) || (d.items_number && d.items_number.trim()) || (d.address && d.address.trim()) || (d.work_order && d.work_order.trim()) || (d.device_label && d.device_label.trim()))
		);
		return filtered.map((d) => [
			d.full_name || '',
			d.phone_number || '',
			[d.work_order, d.device_label, d.sn_device].filter(Boolean).join('|'),
			d.items_number || '',
			d.address || ''
		]);
	}
	if (type === 'device-label') {
		const filtered = devices.filter((d) => Boolean(d.device_label && d.device_label.trim()));
		return filtered.map((d) => [d.device_label || '']);
	}
	if (type === 'asset-import') {
		const filtered = devices.filter((d) => Boolean((d.items_number && d.items_number.trim()) || (d.category && d.category.trim()) || (d.model_name && d.model_name.trim())));
		return filtered.map((d) => [d.sn_device || '', d.items_number || '', d.category || '', d.model_name || '']);
	}
	throw new Error('Unknown report type');
}

function buildHeadersFor(type) {
	if (type === 'label-carton') {
		return ['full_name', 'phone_number', 'work_order|device_label|sn_device', 'items_number', 'address'];
	}
	if (type === 'device-label') {
		return ['device_label'];
	}
	if (type === 'asset-import') {
		return ['sn_device', 'items_number', 'category', 'model_name'];
	}
	throw new Error('Unknown report type');
}

export async function generateReports(type, format, devices) {
	const safeType = type;
	const rows = buildRowsFor(safeType, devices);
	const headers = buildHeadersFor(safeType);

	if (format === 'csv') {
		const csv = stringify([headers, ...rows]);
		const buffer = Buffer.from(csv, 'utf8');
		return {
			buffer,
			filename: `${safeType}.csv`,
			contentType: 'text/csv'
		};
	}

	// default xlsx
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Report');
	sheet.addRow(headers);
	for (const row of rows) sheet.addRow(row);
	const buffer = await workbook.xlsx.writeBuffer();
	return {
		buffer: Buffer.from(buffer),
		filename: `${safeType}.xlsx`,
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	};
}