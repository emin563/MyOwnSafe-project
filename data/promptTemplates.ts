import type { FileType } from '@/db/types';

export type PromptCategory =
  | 'Receipts & Expenses'
  | 'Warranties & Returns'
  | 'Contracts & Legal'
  | 'IDs & Personal Docs'
  | 'Business & Invoices'
  | 'Education'
  | 'Medical'
  | 'Vehicles & Insurance'
  | 'Real Estate & Home'
  | 'General';

export type PromptTemplateAsset = {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  supportedTypes: FileType[];
  prompt: string; // supports {docTitle} {docType} {categoryName}
};

const ALL_TYPES: FileType[] = ['image', 'pdf', 'word', 'excel', 'document'];
const DOC_TYPES: FileType[] = ['pdf', 'word', 'excel', 'document'];
const IMAGE_PDF: FileType[] = ['image', 'pdf'];

export const PROMPT_TEMPLATES_100: PromptTemplateAsset[] = [
  // ── General (20) ────────────────────────────────────────────────────────
  {
    id: 'gen_summary_001',
    title: 'Summarize in 5 bullets',
    description: 'Fast overview + key takeaways.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Summarize this {docType} titled \"{docTitle}\" from category \"{categoryName}\".\n' +
      'Return exactly 5 bullets, then a short \"What to do next\" section.',
  },
  {
    id: 'gen_qa_002',
    title: 'Answer my questions (Q&A mode)',
    description: 'Ask clarifying questions if needed.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'You are analyzing this {docType}: \"{docTitle}\" (category: {categoryName}).\n' +
      'I will ask questions next. If the document is unclear, ask me 3 clarifying questions first.',
  },
  {
    id: 'gen_extract_json_003',
    title: 'Extract to JSON',
    description: 'Structured fields with nulls for missing data.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract key information from this {docType} (\"{docTitle}\") into JSON.\n' +
      'Include: document_type, issuer, parties, dates, totals, currency, reference_numbers, addresses, phone_emails.\n' +
      'Use null when unknown.',
  },
  {
    id: 'gen_translate_004',
    title: 'Translate to English',
    description: 'Keep names and numbers unchanged.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Translate this {docType} \"{docTitle}\" into English.\n' +
      'Keep proper nouns, codes, and numbers unchanged. Provide a clean translation only.',
  },
  {
    id: 'gen_action_items_005',
    title: 'Action items + deadlines',
    description: 'Find tasks, dates, and responsibilities.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'From this {docType} \"{docTitle}\", extract all action items.\n' +
      'For each: who, what, due date (if any), and evidence line/section if possible.',
  },
  {
    id: 'gen_redflags_006',
    title: 'Red flags & risks',
    description: 'Spot unusual clauses, fees, or missing info.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Review \"{docTitle}\" ({docType}). Identify red flags, missing info, or risks.\n' +
      'Return: Top 5 red flags + why each matters + what to verify.',
  },
  {
    id: 'gen_clean_notes_007',
    title: 'Clean summary note',
    description: 'Produce a vault-friendly note to paste.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a short note (max 6 lines) summarizing this {docType} titled \"{docTitle}\".\n' +
      'Format as a compact checklist suitable for personal records.',
  },
  {
    id: 'gen_key_terms_008',
    title: 'Key terms glossary',
    description: 'Explain terms in plain language.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'List and explain key terms found in this {docType} \"{docTitle}\".\n' +
      'Explain in simple language with short examples.',
  },
  {
    id: 'gen_compare_009',
    title: 'Compare to my notes',
    description: 'Check mismatches against user-provided data.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'I will paste my notes next.\n' +
      'Compare my notes with this {docType} \"{docTitle}\" and list mismatches or missing items.',
  },
  {
    id: 'gen_email_draft_010',
    title: 'Draft a support email',
    description: 'Professional message referencing key details.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Draft a concise support email based on this {docType} \"{docTitle}\".\n' +
      'Ask for resolution politely. Include key identifiers and dates from the document.',
  },
  {
    id: 'gen_table_011',
    title: 'Convert to table',
    description: 'Summarize key fields in a clean table.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Convert the important information in \"{docTitle}\" ({docType}) into a table.\n' +
      'Include a final row: \"Missing/unclear\" items.',
  },
  {
    id: 'gen_timeline_012',
    title: 'Build a timeline',
    description: 'Sequence events and dates.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a chronological timeline from this {docType} \"{docTitle}\".\n' +
      'Include dates, events, people/organizations, and what evidence supports each.',
  },
  {
    id: 'gen_checklist_013',
    title: 'Compliance checklist',
    description: 'Turn requirements into checkboxes.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Turn this {docType} \"{docTitle}\" into a checklist of requirements.\n' +
      'Use checkbox format and group by section.',
  },
  {
    id: 'gen_questions_014',
    title: 'Ask me follow-up questions',
    description: 'Identify missing inputs needed for next steps.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Based on this {docType} \"{docTitle}\", ask me up to 10 follow-up questions\n' +
      'that would help you give better advice or a better summary.',
  },
  {
    id: 'gen_entity_list_015',
    title: 'List people & organizations',
    description: 'Extract named entities and roles.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract all people, organizations, and roles from \"{docTitle}\" ({docType}).\n' +
      'Return as a list: name — role — relevant reference number (if any).',
  },
  {
    id: 'gen_numbers_016',
    title: 'Extract all numbers',
    description: 'Amounts, IDs, phone numbers, dates.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract all important numbers from this {docType} \"{docTitle}\": amounts, IDs, dates, phone numbers, totals.\n' +
      'Return as categorized bullet lists.',
  },
  {
    id: 'gen_one_liner_017',
    title: 'One-line summary',
    description: 'Single sentence description.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Write a single-sentence summary of \"{docTitle}\" ({docType}) suitable for a file name.',
  },
  {
    id: 'gen_rename_suggestions_018',
    title: 'Suggest better title',
    description: 'Improve naming based on content.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Suggest 5 better titles for this {docType} document currently titled \"{docTitle}\".\n' +
      'Use a consistent naming style: Vendor - DocType - Date - KeyIdentifier.',
  },
  {
    id: 'gen_safety_share_019',
    title: 'Sharing safety check',
    description: 'What to redact before sharing.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Before I share \"{docTitle}\" ({docType}) externally, list sensitive data to redact.\n' +
      'Provide a prioritized checklist.',
  },
  {
    id: 'gen_plain_language_020',
    title: 'Explain in plain language',
    description: 'Make it understandable to anyone.',
    category: 'General',
    supportedTypes: ALL_TYPES,
    prompt:
      'Explain this {docType} \"{docTitle}\" in plain language.\n' +
      'Avoid jargon and keep it under 200 words.',
  },

  // ── Receipts & Expenses (12) ────────────────────────────────────────────
  {
    id: 'rcpt_expense_021',
    title: 'Receipt → expense entry',
    description: 'Vendor, date, total, category suggestion.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'This is a receipt: \"{docTitle}\".\n' +
      'Extract vendor, date, subtotal, tax, total, currency, and payment method.\n' +
      'Suggest an expense category and a short memo.',
  },
  {
    id: 'rcpt_items_022',
    title: 'Itemize line items',
    description: 'List items with quantities and prices.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Extract all line items from this receipt \"{docTitle}\".\n' +
      'Return a table: item, qty, unit_price, total_price.',
  },
  {
    id: 'rcpt_reimburse_023',
    title: 'Reimbursement summary',
    description: 'Explain what to submit for reimbursement.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Create a reimbursement summary for receipt \"{docTitle}\".\n' +
      'Include who paid, what for, date, total, and any reference numbers.',
  },
  {
    id: 'rcpt_tax_024',
    title: 'Tax breakdown',
    description: 'Identify taxes, VAT, tips, fees.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'From receipt \"{docTitle}\", extract all taxes/fees/tips and explain each.\n' +
      'Return: subtotal, tax lines, tip, fees, grand total.',
  },
  {
    id: 'rcpt_duplicate_check_025',
    title: 'Duplicate expense check',
    description: 'Create a fingerprint to detect duplicates.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Create a “duplicate fingerprint” for receipt \"{docTitle}\": vendor + date + total + last4 (if present).\n' +
      'Output as a single line.',
  },
  {
    id: 'rcpt_budget_026',
    title: 'Budget category suggestion',
    description: 'Map purchase to a budget category.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Based on this receipt \"{docTitle}\", suggest the best budget category and why.\n' +
      'Also suggest 2 alternative categories.',
  },
  {
    id: 'rcpt_refund_027',
    title: 'Refund/return steps',
    description: 'What info to provide and next steps.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Using this receipt \"{docTitle}\", draft steps to request a refund/return.\n' +
      'List required info (order/receipt number, date, total) and a short message template.',
  },
  {
    id: 'rcpt_vendor_contact_028',
    title: 'Find vendor contact info',
    description: 'Extract phone, address, email, website.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Extract vendor contact details from receipt \"{docTitle}\".\n' +
      'Return: address, phone, email, website (if present).',
  },
  {
    id: 'rcpt_currency_029',
    title: 'Currency normalization',
    description: 'Interpret currency and totals clearly.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Identify the currency and total amount from receipt \"{docTitle}\".\n' +
      'If multiple totals exist, explain which is the payable total.',
  },
  {
    id: 'rcpt_warranty_link_030',
    title: 'Receipt → warranty info',
    description: 'Find product and purchase date for warranty.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'From receipt \"{docTitle}\", extract purchase date, product names, and any serial/model numbers.\n' +
      'Format as a warranty-ready checklist.',
  },
  {
    id: 'rcpt_business_031',
    title: 'Business expense note',
    description: 'Short justification for bookkeeping.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Write a short business-expense note for receipt \"{docTitle}\".\n' +
      'Include purpose, attendees (if any), and why it was necessary.',
  },
  {
    id: 'rcpt_anomaly_032',
    title: 'Spot anomalies',
    description: 'Unexpected charges or suspicious items.',
    category: 'Receipts & Expenses',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Review receipt \"{docTitle}\" for anomalies: unexpected fees, duplicate line items, wrong tax, or mismatched totals.\n' +
      'List findings and what to verify.',
  },

  // ── Warranties & Returns (10) ───────────────────────────────────────────
  {
    id: 'war_terms_033',
    title: 'Warranty terms extraction',
    description: 'Coverage, duration, exclusions, claim steps.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Extract warranty terms from \"{docTitle}\".\n' +
      'Return: coverage, duration, start date, exclusions, required proof, claim steps, contact info.',
  },
  {
    id: 'war_return_window_034',
    title: 'Return window & policy',
    description: 'Identify deadlines and conditions.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'From \"{docTitle}\", identify the return window, conditions, and restocking fees.\n' +
      'Summarize as a checklist with deadlines.',
  },
  {
    id: 'war_claim_email_035',
    title: 'Draft warranty claim email',
    description: 'Polite message with needed details.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Draft a warranty claim email based on \"{docTitle}\".\n' +
      'Include product, purchase date, issue description, and request next steps.',
  },
  {
    id: 'war_proof_list_036',
    title: 'Proof checklist',
    description: 'What documents/photos to gather.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Create a checklist of proof needed to file a claim for \"{docTitle}\".\n' +
      'Include photos, serial/model, receipt, and any forms mentioned.',
  },
  {
    id: 'war_serials_037',
    title: 'Extract serial/model numbers',
    description: 'Find device identifiers for claims.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Extract serial numbers, model numbers, IMEI, or product IDs from \"{docTitle}\".\n' +
      'Return as a list with labels.',
  },
  {
    id: 'war_contact_038',
    title: 'Support contacts',
    description: 'Phone/email/address/web from the document.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Find all support contact info in \"{docTitle}\": phone, email, address, website.\n' +
      'Return in a clean list.',
  },
  {
    id: 'war_exclusions_039',
    title: 'Exclusions explained',
    description: 'What is not covered and why.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'List the main exclusions in \"{docTitle}\" and explain each in plain language.\n' +
      'Then suggest how to avoid accidentally voiding coverage.',
  },
  {
    id: 'war_deadlines_040',
    title: 'Deadlines & reminders',
    description: 'Dates to calendar.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Extract all deadlines from \"{docTitle}\" and suggest reminder dates.\n' +
      'Return as: deadline — what it is — suggested reminder date.',
  },
  {
    id: 'war_return_message_041',
    title: 'Return request message',
    description: 'Short script for chat or email.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Write a short return request message based on \"{docTitle}\".\n' +
      'Ask for RMA/return label and confirm refund timing.',
  },
  {
    id: 'war_quick_summary_042',
    title: 'Warranty in 8 lines',
    description: 'Compact reference summary.',
    category: 'Warranties & Returns',
    supportedTypes: ['image', 'pdf', 'word', 'document'],
    prompt:
      'Summarize \"{docTitle}\" warranty terms in max 8 lines.\n' +
      'Include duration, coverage, exclusions, and claim steps.',
  },

  // ── Contracts & Legal (12) ──────────────────────────────────────────────
  {
    id: 'law_obligations_043',
    title: 'Obligations & responsibilities',
    description: 'Who must do what and when.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'From contract \"{docTitle}\", extract obligations for each party.\n' +
      'Return as a table: party — obligation — deadline — penalty (if any).',
  },
  {
    id: 'law_termination_044',
    title: 'Termination & renewal',
    description: 'How to cancel and what happens.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Explain termination and renewal terms in \"{docTitle}\".\n' +
      'Include notice period, fees, and auto-renew conditions.',
  },
  {
    id: 'law_fees_045',
    title: 'Fees & penalties',
    description: 'Costs hidden in fine print.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'List all fees/penalties in \"{docTitle}\".\n' +
      'For each: trigger, amount/formula, and when it applies.',
  },
  {
    id: 'law_plain_046',
    title: 'Explain like I’m 15',
    description: 'Plain-language breakdown.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Explain \"{docTitle}\" in plain language.\n' +
      'Focus on what I’m agreeing to, what I must do, and what could go wrong.',
  },
  {
    id: 'law_risks_047',
    title: 'Top 10 risks',
    description: 'Identify risky clauses and why.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Identify the top 10 risky/one-sided clauses in \"{docTitle}\".\n' +
      'For each: risk, why it matters, and suggested negotiation question.',
  },
  {
    id: 'law_missing_048',
    title: 'Missing clauses check',
    description: 'What should be there but isn’t.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Based on typical contracts, list important clauses missing from \"{docTitle}\" (if any).\n' +
      'Examples: liability limits, dispute resolution, data privacy, termination, SLA.',
  },
  {
    id: 'law_data_privacy_049',
    title: 'Data & privacy implications',
    description: 'What data is collected and shared.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Extract data/privacy-related clauses from \"{docTitle}\".\n' +
      'Summarize: what data is collected, purpose, sharing, retention, and user rights.',
  },
  {
    id: 'law_payment_terms_050',
    title: 'Payment terms',
    description: 'Billing schedule and late payment rules.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Summarize payment terms in \"{docTitle}\": amounts, schedule, invoicing, late fees, refunds.\n' +
      'Return as bullet list.',
  },
  {
    id: 'law_disputes_051',
    title: 'Dispute resolution',
    description: 'Jurisdiction, arbitration, process.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Explain dispute resolution terms in \"{docTitle}\".\n' +
      'Include jurisdiction, arbitration/mediation, and steps to follow.',
  },
  {
    id: 'law_signature_check_052',
    title: 'Signature checklist',
    description: 'What to verify before signing.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Create a pre-sign checklist for \"{docTitle}\": key fields to verify, dates, parties, attachments, and missing info.',
  },
  {
    id: 'law_summary_053',
    title: 'Contract summary (short)',
    description: '1-paragraph summary + key bullets.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Write a 1-paragraph summary of \"{docTitle}\" then list 7 key bullets: obligations, fees, deadlines, termination, risks.',
  },
  {
    id: 'law_questions_054',
    title: 'Questions to ask',
    description: 'Best questions before agreeing.',
    category: 'Contracts & Legal',
    supportedTypes: DOC_TYPES,
    prompt:
      'Generate 12 questions I should ask before agreeing to \"{docTitle}\".\n' +
      'Prioritize risk, cost, termination, and privacy.',
  },

  // ── IDs & Personal Docs (8) ─────────────────────────────────────────────
  {
    id: 'id_sensitive_055',
    title: 'Sensitive fields audit',
    description: 'List sensitive fields and redaction tips.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Review this personal document \"{docTitle}\".\n' +
      'List sensitive fields (ID number, DOB, address, etc.) and suggest redactions before sharing.',
  },
  {
    id: 'id_form_fill_056',
    title: 'Help fill a form',
    description: 'Extract fields usable for a form.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Extract fields from \"{docTitle}\" to help fill forms: full_name, DOB, address, document_number, expiry_date.\n' +
      'Return in JSON.',
  },
  {
    id: 'id_expiry_057',
    title: 'Expiry date reminder',
    description: 'Find expiry and renewal steps.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Find the expiry date (if any) in \"{docTitle}\".\n' +
      'Suggest a renewal checklist and reminder schedule.',
  },
  {
    id: 'id_translation_058',
    title: 'Translate fields to English',
    description: 'Keep names/codes as-is.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Translate the fields on this document \"{docTitle}\" into English.\n' +
      'Keep names, numbers, and codes unchanged.',
  },
  {
    id: 'id_check_consistency_059',
    title: 'Consistency check',
    description: 'Spot mismatched names/dates.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Check \"{docTitle}\" for inconsistencies: name spelling, dates, number formats.\n' +
      'List anything that looks off.',
  },
  {
    id: 'id_share_warning_060',
    title: 'Sharing warning message',
    description: 'Short message to send with the doc.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Write a short message to accompany sharing \"{docTitle}\".\n' +
      'Mention it contains sensitive info and request secure handling.',
  },
  {
    id: 'id_data_minimization_061',
    title: 'Data minimization advice',
    description: 'What not to share.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'For \"{docTitle}\", explain the minimum info usually needed for verification.\n' +
      'List what should be hidden when possible.',
  },
  {
    id: 'id_metadata_note_062',
    title: 'Vault note (personal doc)',
    description: 'Create a concise reference note.',
    category: 'IDs & Personal Docs',
    supportedTypes: IMAGE_PDF,
    prompt:
      'Create a concise vault note for \"{docTitle}\": issuer, issue date, expiry date, and key identifiers (masked).',
  },

  // ── Business & Invoices (12) ────────────────────────────────────────────
  {
    id: 'biz_invoice_extract_063',
    title: 'Invoice extraction',
    description: 'Vendor, invoice #, due date, totals.',
    category: 'Business & Invoices',
    supportedTypes: ['pdf', 'image', 'word', 'excel', 'document'],
    prompt:
      'Extract invoice details from \"{docTitle}\": vendor, invoice_number, invoice_date, due_date, subtotal, tax, total, currency.\n' +
      'Return JSON and a 1-line payment summary.',
  },
  {
    id: 'biz_po_match_064',
    title: 'PO match checklist',
    description: 'What to verify vs purchase order.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a checklist to match this invoice/receipt \"{docTitle}\" against a purchase order.\n' +
      'Include quantities, unit prices, totals, taxes, vendor name, and dates.',
  },
  {
    id: 'biz_payment_email_065',
    title: 'Payment confirmation email',
    description: 'Template for vendor communication.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Draft an email confirming payment for \"{docTitle}\".\n' +
      'Include invoice number, amount, date paid, and ask for receipt confirmation.',
  },
  {
    id: 'biz_dispute_066',
    title: 'Dispute incorrect charge',
    description: 'Draft a dispute message.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Draft a message disputing incorrect charges in \"{docTitle}\".\n' +
      'Ask for corrected invoice and explain the discrepancy clearly.',
  },
  {
    id: 'biz_terms_067',
    title: 'Payment terms summary',
    description: 'Net terms, late fees, discounts.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract payment terms from \"{docTitle}\": net terms, early payment discounts, late fees, accepted methods.\n' +
      'Summarize in bullets.',
  },
  {
    id: 'biz_line_items_068',
    title: 'Line items to spreadsheet',
    description: 'Return CSV-friendly table.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract line items from \"{docTitle}\" into a table: description, qty, unit_price, tax, line_total.\n' +
      'Make it CSV-friendly.',
  },
  {
    id: 'biz_vendor_contact_069',
    title: 'Vendor contact details',
    description: 'Phone/email/address/website.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract vendor contact details from \"{docTitle}\".\n' +
      'Return: company name, address, phone, email, website.',
  },
  {
    id: 'biz_reconciliation_070',
    title: 'Bank reconciliation note',
    description: 'Help match to bank line.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a bank reconciliation note for \"{docTitle}\": payee, amount, date, and reference numbers.\n' +
      'Suggest how it might appear on a bank statement.',
  },
  {
    id: 'biz_tax_vat_071',
    title: 'VAT/GST extraction',
    description: 'Find tax IDs and amounts.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract VAT/GST info from \"{docTitle}\": tax_id numbers, tax rate, tax amount, taxable subtotal.\n' +
      'Return JSON.',
  },
  {
    id: 'biz_contract_link_072',
    title: 'Invoice → contract linkage',
    description: 'Find references to contracts/SOW.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Check \"{docTitle}\" for references to a contract/SOW/PO.\n' +
      'List all referenced numbers and sections where they appear.',
  },
  {
    id: 'biz_followup_073',
    title: 'Follow-up questions to vendor',
    description: 'Clarify unclear items/fees.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Generate 10 concise questions to ask the vendor about \"{docTitle}\" to clarify unclear items, fees, or totals.',
  },
  {
    id: 'biz_summary_074',
    title: 'Invoice summary (short)',
    description: 'One paragraph + key bullets.',
    category: 'Business & Invoices',
    supportedTypes: ALL_TYPES,
    prompt:
      'Write a short invoice summary for \"{docTitle}\": who, what, when, how much, due date.\n' +
      'Then list 5 key bullets.',
  },

  // ── Education (6) ───────────────────────────────────────────────────────
  {
    id: 'edu_notes_075',
    title: 'Study notes',
    description: 'Turn document into study bullets.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Turn this {docType} \"{docTitle}\" into study notes.\n' +
      'Return: key concepts, definitions, and 10 flashcard Q&A pairs.',
  },
  {
    id: 'edu_quiz_076',
    title: 'Create a quiz',
    description: 'Multiple choice + short answers.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a quiz from \"{docTitle}\".\n' +
      'Include 8 multiple-choice questions and 5 short-answer questions with an answer key.',
  },
  {
    id: 'edu_outline_077',
    title: 'Make an outline',
    description: 'Hierarchical outline of content.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a structured outline of \"{docTitle}\".\n' +
      'Use headings and subheadings and keep it concise.',
  },
  {
    id: 'edu_simplify_078',
    title: 'Simplify the text',
    description: 'Rewrite at a lower reading level.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Rewrite \"{docTitle}\" in simpler English.\n' +
      'Keep meaning but reduce jargon and shorten sentences.',
  },
  {
    id: 'edu_flashcards_079',
    title: 'Flashcards (Anki-ready)',
    description: 'Generate Q|A pairs.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create 20 flashcards from \"{docTitle}\".\n' +
      'Output format: Q: ...\\nA: ... (repeat).',
  },
  {
    id: 'edu_explain_080',
    title: 'Explain difficult parts',
    description: 'Identify and clarify hard sections.',
    category: 'Education',
    supportedTypes: ALL_TYPES,
    prompt:
      'Identify the 5 hardest parts of \"{docTitle}\" and explain each with a simple example.',
  },

  // ── Medical (6) ─────────────────────────────────────────────────────────
  {
    id: 'med_summary_081',
    title: 'Medical summary',
    description: 'Diagnoses, meds, tests, next steps.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Summarize this medical document \"{docTitle}\".\n' +
      'Extract: diagnoses, medications (dose/frequency), tests, results, follow-ups, and warning signs.',
  },
  {
    id: 'med_questions_082',
    title: 'Questions for my doctor',
    description: 'Prepare for an appointment.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Based on \"{docTitle}\", generate 12 questions to ask my doctor.\n' +
      'Focus on risks, alternatives, and next steps.',
  },
  {
    id: 'med_meds_083',
    title: 'Medication list',
    description: 'Extract meds and instructions.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract all medications from \"{docTitle}\".\n' +
      'Return table: name, dose, frequency, purpose (if stated), warnings.',
  },
  {
    id: 'med_lab_084',
    title: 'Lab results explanation',
    description: 'Explain abnormal values in plain English.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Explain lab results in \"{docTitle}\".\n' +
      'Highlight abnormal values and explain what they might indicate (non-diagnostic).',
  },
  {
    id: 'med_insurance_085',
    title: 'Medical billing check',
    description: 'Spot billing anomalies.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Review \"{docTitle}\" for billing anomalies: duplicate charges, unclear codes, mismatched totals.\n' +
      'List what to verify with the provider/insurer.',
  },
  {
    id: 'med_followup_086',
    title: 'Follow-up checklist',
    description: 'Turn into a follow-up plan.',
    category: 'Medical',
    supportedTypes: ALL_TYPES,
    prompt:
      'Turn \"{docTitle}\" into a follow-up checklist with dates, tasks, and what to monitor.',
  },

  // ── Vehicles & Insurance (7) ────────────────────────────────────────────
  {
    id: 'veh_policy_summary_087',
    title: 'Insurance policy summary',
    description: 'Coverage, deductibles, exclusions.',
    category: 'Vehicles & Insurance',
    supportedTypes: DOC_TYPES,
    prompt:
      'Summarize this insurance document \"{docTitle}\".\n' +
      'Extract: coverage limits, deductibles, exclusions, claim steps, contacts.',
  },
  {
    id: 'veh_claim_steps_088',
    title: 'Claim steps checklist',
    description: 'What to do after an incident.',
    category: 'Vehicles & Insurance',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a step-by-step claim checklist based on \"{docTitle}\".\n' +
      'Include what evidence to gather and what numbers to reference.',
  },
  {
    id: 'veh_repair_estimate_089',
    title: 'Repair estimate extraction',
    description: 'Parts, labor, totals.',
    category: 'Vehicles & Insurance',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract repair estimate details from \"{docTitle}\": parts, labor, tax, total, shop info.\n' +
      'Return a table and a short summary.',
  },
  {
    id: 'veh_registration_090',
    title: 'Registration renewal',
    description: 'Expiry and renewal steps.',
    category: 'Vehicles & Insurance',
    supportedTypes: ALL_TYPES,
    prompt:
      'Find expiry/renewal details in \"{docTitle}\".\n' +
      'Create a renewal checklist and suggested reminder dates.',
  },
  {
    id: 'veh_policy_compare_091',
    title: 'Compare two policies',
    description: 'Use this as baseline for comparison.',
    category: 'Vehicles & Insurance',
    supportedTypes: DOC_TYPES,
    prompt:
      'I will provide a second policy next.\n' +
      'Compare it against this document \"{docTitle}\" and highlight differences in coverage and cost.',
  },
  {
    id: 'veh_ticket_help_092',
    title: 'Ticket/notice guidance',
    description: 'Deadlines and next actions.',
    category: 'Vehicles & Insurance',
    supportedTypes: ALL_TYPES,
    prompt:
      'Review this notice \"{docTitle}\".\n' +
      'Extract deadlines, required actions, fees, and where/how to respond.',
  },
  {
    id: 'veh_vin_extract_093',
    title: 'Extract VIN & identifiers',
    description: 'VIN, plate, policy numbers.',
    category: 'Vehicles & Insurance',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract vehicle identifiers from \"{docTitle}\": VIN, plate number, policy number, claim number.\n' +
      'Return as labeled list.',
  },

  // ── Real Estate & Home (7) ──────────────────────────────────────────────
  {
    id: 'home_lease_summary_094',
    title: 'Lease summary',
    description: 'Rent, deposit, rules, deadlines.',
    category: 'Real Estate & Home',
    supportedTypes: DOC_TYPES,
    prompt:
      'Summarize lease \"{docTitle}\": rent, deposit, term, renewal, termination notice, key rules.\n' +
      'Return as checklist.',
  },
  {
    id: 'home_utility_bill_095',
    title: 'Utility bill extraction',
    description: 'Account, period, usage, total.',
    category: 'Real Estate & Home',
    supportedTypes: ALL_TYPES,
    prompt:
      'Extract utility bill details from \"{docTitle}\": account number, billing period, usage, charges, total.\n' +
      'Return JSON + a short summary.',
  },
  {
    id: 'home_maintenance_request_096',
    title: 'Maintenance request draft',
    description: 'Clear message for landlord/service.',
    category: 'Real Estate & Home',
    supportedTypes: ALL_TYPES,
    prompt:
      'Draft a maintenance request message based on \"{docTitle}\".\n' +
      'Be clear, polite, include dates and requested resolution.',
  },
  {
    id: 'home_homeowners_policy_097',
    title: 'Homeowners policy summary',
    description: 'Coverage, deductibles, exclusions.',
    category: 'Real Estate & Home',
    supportedTypes: DOC_TYPES,
    prompt:
      'Summarize homeowners/home insurance document \"{docTitle}\".\n' +
      'Extract coverage, deductible, exclusions, claim steps, contacts.',
  },
  {
    id: 'home_mortgage_terms_098',
    title: 'Mortgage terms overview',
    description: 'Rates, payments, penalties.',
    category: 'Real Estate & Home',
    supportedTypes: DOC_TYPES,
    prompt:
      'Explain the key mortgage terms in \"{docTitle}\": rate, payment schedule, escrow, penalties, and important dates.',
  },
  {
    id: 'home_moveout_checklist_099',
    title: 'Move-out checklist',
    description: 'Steps to get deposit back.',
    category: 'Real Estate & Home',
    supportedTypes: ALL_TYPES,
    prompt:
      'Create a move-out checklist based on \"{docTitle}\".\n' +
      'Include cleaning, photos, keys, forwarding address, and deposit timeline.',
  },
  {
    id: 'home_contractor_quote_100',
    title: 'Contractor quote comparison',
    description: 'Summarize scope and costs.',
    category: 'Real Estate & Home',
    supportedTypes: ALL_TYPES,
    prompt:
      'Summarize this quote \"{docTitle}\".\n' +
      'Extract scope, materials, labor, timeline, total cost, payment schedule, and warranty/guarantees.',
  },
];

