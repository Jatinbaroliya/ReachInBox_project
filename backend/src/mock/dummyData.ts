import { IEmail } from '../models/Email';

export const dummyAccounts = [
	{
		email: 'demo@acme.com',
		provider: 'IMAP',
		host: 'imap.example.com',
		port: 993,
		tls: true,
		isConnected: true
	},
	{
		email: 'sales@acme.com',
		provider: 'IMAP',
		host: 'imap.example.com',
		port: 993,
		tls: true,
		isConnected: false
	},
	{
		email: 'ops@northwind.io',
		provider: 'IMAP',
		host: 'imap.example.com',
		port: 993,
		tls: true,
		isConnected: true
	}
];

function generateDummyEmails(): Partial<IEmail & { _id: string }>[] {
	const emails: Partial<IEmail & { _id: string }>[] = [];
	const now = Date.now();
	let idCounter = 1;

	const categories: (IEmail['category'] | undefined)[] = [
		'Interested',
		'Meeting Booked',
		'Not Interested',
		'Spam',
		'Out of Office',
		undefined
	];

	const templates = [
		{
			from: 'amelia@helixlabs.ai',
			subject: 'Partnership idea: embed Onebox in our onboarding',
			body: 'We help B2B teams onboard faster. A native Onebox would save our CSMs hours — open to a 20‑min chat?',
			category: 'Interested' as IEmail['category']
		},
		{
			from: 'no-reply@calendar.com',
			subject: 'Calendar invite: Product review sync',
			body: 'A new meeting invite has been created. Please accept or propose another time.',
			category: 'Meeting Booked' as IEmail['category']
		},
		{
			from: 'recruiting@contoso.com',
			subject: 'Application received — Senior TS Engineer',
			body: 'Thanks for applying. Our team will review your profile and get back to you shortly.',
			category: undefined
		},
		{
			from: 'billing@fabrikam.io',
			subject: 'Invoice FAB‑2025‑10 is due in 7 days',
			body: 'Your invoice is attached. Please remit payment by the due date to avoid service interruption.',
			category: undefined
		},
		{
			from: 'oliver@northwind.io',
			subject: 'Re: Budget approved — let’s proceed',
			body: 'Great news on the budget. Looping in procurement to kick off the vendor process.',
			category: 'Interested' as IEmail['category']
		},
		{
			from: 'vacation@outofoffice.com',
			subject: 'Automatic reply: I am out of office',
			body: 'I am currently OOO with limited access to email and will return next Monday.',
			category: 'Out of Office' as IEmail['category']
		},
		{
			from: 'promo@cheaplistings.biz',
			subject: 'Win a free cruise today!!!',
			body: 'Congratulations! You have been selected for an exclusive offer. Click to claim.',
			category: 'Spam' as IEmail['category']
		},
		{
			from: 'julia@acme.com',
			subject: 'Thanks, but not a priority right now',
			body: 'Appreciate the reach‑out. We are heads‑down on other initiatives this quarter.',
			category: 'Not Interested' as IEmail['category']
		}
	];

	const accounts = ['demo@acme.com', 'sales@acme.com', 'ops@northwind.io'];

	for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
		for (let i = 0; i < 3; i++) {
			const account = accounts[i % accounts.length];
			const tmpl = templates[(dayOffset + i) % templates.length];
			const ts = now - dayOffset * 24 * 60 * 60 * 1000 - i * 90 * 60 * 1000;
			const category = tmpl.category ?? categories[(dayOffset + i) % categories.length];

			emails.push({
				_id: String(idCounter),
				messageId: `dummy-${idCounter}`,
				account,
				folder: 'INBOX',
				from: tmpl.from,
				to: [account],
				subject: tmpl.subject,
				body: tmpl.body,
				html: i % 2 === 0 ? `<p>${tmpl.body}</p>` : '',
				date: new Date(ts),
				category,
				isRead: (dayOffset + i) % 3 === 0,
				isFlagged: (dayOffset + i) % 7 === 0,
				attachments: (dayOffset + i) % 5 === 0 ? [{ filename: 'invoice.pdf', size: 120 * 1024 }] : []
			});
			idCounter++;
		}
	}

	return emails;
}

export const dummyEmails: Partial<IEmail & { _id: string }>[] = generateDummyEmails();


