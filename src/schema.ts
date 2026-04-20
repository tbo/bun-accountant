import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type BookingStatus = "draft" | "finalized";

export const bookings = pgTable("bookings", {
	id: serial("id").primaryKey(),
	bookedOn: date("booked_on", { mode: "string" }).notNull(),
	description: text("description").notNull(),
	amountCents: integer("amount_cents").notNull(),
	status: text("status").$type<BookingStatus>().notNull().default("draft"),
	createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
});

export type BookingListItem = Pick<
	typeof bookings.$inferSelect,
	"id" | "bookedOn" | "description" | "amountCents" | "status"
>;
