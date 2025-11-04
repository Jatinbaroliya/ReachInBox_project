import express from 'express';
import {
  getEmails,
  searchEmailsController,
  getEmailById,
  getSuggestedReply
} from '../controllers/emailController';

const router = express.Router();

router.get('/', getEmails);
router.get('/search', searchEmailsController);
router.get('/:id', getEmailById);
router.get('/:id/suggested-reply', getSuggestedReply);

export default router;