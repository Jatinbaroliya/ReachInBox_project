import express from 'express';
import {
  getEmails,
  searchEmailsController,
  getEmailById,
  getSuggestedReply,
  recategorizeEmails
} from '../controllers/emailController';

const router = express.Router();

router.get('/', getEmails);
router.get('/search', searchEmailsController);
router.post('/recategorize', recategorizeEmails);
// More specific routes must come before generic :id route
router.get('/:id/suggested-reply', getSuggestedReply);
router.get('/:id', getEmailById);

export default router;