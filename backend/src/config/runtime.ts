import dotenv from 'dotenv';

dotenv.config();

export const isDummyMode = !process.env.MONGODB_URI;

export function logStartupMode() {
	if (isDummyMode) {
		console.warn('⚠️ Running in DUMMY MODE: no env keys detected. Using mock data.');
	} else {
		console.log('✅ Running in NORMAL MODE: environment keys detected.');
	}
}


