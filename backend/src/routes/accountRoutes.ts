import express from 'express';
import { isDummyMode } from '../config/runtime';
import { dummyAccounts } from '../mock/dummyData';

const router = express.Router();

router.get('/', (_req, res) => {
	if (isDummyMode) {
		return res.json(dummyAccounts);
	}

	// In normal mode, this would return real accounts from DB (not implemented yet)
	return res.json([]);
});

export default router;


