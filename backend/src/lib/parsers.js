export function parseUserInfo(userInfo) {
	if (!userInfo || typeof userInfo !== 'string') {
		return {};
	}
	// Split by | and trim
	const parts = userInfo.split('|').map((p) => p.trim()).filter(Boolean);
	let full_name = null;
	let email = null;
	let phone_number = null;
	let work_order = null;
	let device_label = null;
	let sn_device = null;

	for (const part of parts) {
		if (!email && /@/.test(part)) {
			email = part;
			continue;
		}
		if (!phone_number && /\+?\d[\d\s\-()]{5,}/.test(part)) {
			phone_number = part;
			continue;
		}
		if (!work_order && /^WO\w+/i.test(part)) {
			work_order = part;
			continue;
		}
		if (!device_label && /^[A-Z]{2,}[A-Za-z0-9_-]*\d+/i.test(part)) {
			device_label = part;
			continue;
		}
		if (!sn_device && /^[A-Za-z0-9]{5,}$/i.test(part)) {
			sn_device = part;
			continue;
		}
		if (!full_name) {
			full_name = part;
		}
	}

	return { full_name, email, phone_number, work_order, device_label, sn_device };
}