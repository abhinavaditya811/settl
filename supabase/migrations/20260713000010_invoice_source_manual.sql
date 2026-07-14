-- Source.MANUAL (settl/schema/invoice.py) - an invoice typed directly into the
-- dashboard form, not parsed from a file. Its own migration file: ALTER TYPE ...
-- ADD VALUE cannot run in the same transaction that later uses the new value.
alter type invoice_source add value if not exists 'manual';
