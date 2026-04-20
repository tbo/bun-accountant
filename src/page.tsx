import { Html } from "@elysiajs/html";
import type { Children } from "@kitajs/html";

import type { BookingListItem } from "./schema";

const euros = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const titleize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
const formatAmount = (amountCents: number) => euros.format(amountCents / 100);

const Page = ({ title, children }: { title: string; children: Children }) => (
	<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<link rel="stylesheet" href="/assets/styles.css" />
			<title>{title}</title>
		</head>
		<body>
			<main class="container">{children}</main>
		</body>
	</html>
);

const BookingsTable = ({ bookings }: { bookings: BookingListItem[] }) => (
	<figure>
		<table>
			<thead>
				<tr>
					<th scope="col">Date</th>
					<th scope="col">Description</th>
					<th scope="col">Amount</th>
					<th scope="col">Status</th>
				</tr>
			</thead>
			<tbody>
				{bookings.length === 0 ? (
					<tr>
						<td colspan={4}>No bookings yet.</td>
					</tr>
				) : (
					bookings.map(({ id, bookedOn, description, amountCents, status }) => (
						<tr id={`booking-${id}`}>
							<td>{bookedOn}</td>
							<td>{description}</td>
							<td>{formatAmount(amountCents)}</td>
							<td>{titleize(status)}</td>
						</tr>
					))
				)}
			</tbody>
		</table>
	</figure>
);

export const HomePage = ({ bookings }: { bookings: BookingListItem[] }) => (
	<Page title="Bookings">
		<h1>Bookings</h1>
		<BookingsTable bookings={bookings} />
	</Page>
);
