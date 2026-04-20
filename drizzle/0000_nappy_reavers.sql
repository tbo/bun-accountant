CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booked_on" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL
);
