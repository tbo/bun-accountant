import { Html } from "@elysiajs/html";
import type { Children } from "@kitajs/html";

const Page = ({ title, children }: { title: string; children: Children }) => (
	<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>{title}</title>
		</head>
		<body>{children}</body>
	</html>
);

export const HomePage = () => (
	<Page title="Hello">
		<h1>Hello, world!</h1>
	</Page>
);
