import { invariantResponse } from "@epic-web/invariant";
import type { SEOHandle } from "@nasa-gcn/remix-seo";
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
	type SerializeFrom,
	type HeadersFunction,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUserId } from "#app/utils/auth.server.ts";
import { resolveConnectionData } from "#app/utils/connections.server.ts";
import {
	ProviderConnectionForm,
	type ProviderName,
	ProviderNameSchema,
	providerIcons,
	providerNames,
} from "#app/utils/connections.tsx";
import { prisma } from "#app/utils/db.server.ts";
import { makeTimings } from "#app/utils/timing.server.ts";
import { createToastHeaders } from "#app/utils/toast.server.ts";
import type { BreadcrumbHandle } from "./profile.tsx";
import {
	Cross1Icon,
	Link2Icon,
	QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Container,
	Flex,
	IconButton,
	Link,
	Text,
	Tooltip,
} from "@radix-ui/themes";

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: (
		<Button variant="ghost">
			<Link2Icon />
			Connections
		</Button>
	),
	getSitemapEntries: () => null,
};

async function userCanDeleteConnections(userId: string) {
	const user = await prisma.user.findUnique({
		select: {
			password: { select: { userId: true } },
			_count: { select: { connections: true } },
		},
		where: { id: userId },
	});
	// user can delete their connections if they have a password
	if (user?.password) return true;
	// users have to have more than one remaining connection to delete one
	return Boolean(user?._count.connections && user?._count.connections > 1);
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request);
	const timings = makeTimings("profile connections loader");
	const rawConnections = await prisma.connection.findMany({
		select: { id: true, providerName: true, providerId: true, createdAt: true },
		where: { userId },
	});
	const connections: Array<{
		providerName: ProviderName;
		id: string;
		displayName: string;
		link?: string | null;
		createdAtFormatted: string;
	}> = [];
	for (const connection of rawConnections) {
		const r = ProviderNameSchema.safeParse(connection.providerName);
		if (!r.success) continue;
		const providerName = r.data;
		const connectionData = await resolveConnectionData(
			providerName,
			connection.providerId,
			{ timings },
		);
		connections.push({
			...connectionData,
			providerName,
			id: connection.id,
			createdAtFormatted: connection.createdAt.toLocaleString(),
		});
	}

	return json(
		{
			connections,
			canDeleteConnections: await userCanDeleteConnections(userId),
		},
		{ headers: { "Server-Timing": timings.toString() } },
	);
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		"Server-Timing": loaderHeaders.get("Server-Timing") ?? "",
	};
	return headers;
};

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request);
	const formData = await request.formData();
	invariantResponse(
		formData.get("intent") === "delete-connection",
		"Invalid intent",
	);
	invariantResponse(
		await userCanDeleteConnections(userId),
		"You cannot delete your last connection unless you have a password.",
	);
	const connectionId = formData.get("connectionId");
	invariantResponse(typeof connectionId === "string", "Invalid connectionId");
	await prisma.connection.delete({
		where: {
			id: connectionId,
			userId: userId,
		},
	});
	const toastHeaders = await createToastHeaders({
		title: "Deleted",
		description: "Your connection has been deleted.",
	});
	return json({ status: "success" } as const, { headers: toastHeaders });
}

export default function Connections() {
	const data = useLoaderData<typeof loader>();

	return (
		<Container size="2">
			{data.connections.length ? (
				<Flex direction="column" gap="2">
					<Text as="p">Here are your current connections:</Text>
					<Flex direction="column" gap="4">
						{data.connections.map((c) => (
							<Connection
								key={c.id}
								connection={c}
								canDelete={data.canDeleteConnections}
							/>
						))}
					</Flex>
				</Flex>
			) : (
				<Text as="p">You don't have any connections yet.</Text>
			)}
			<Flex
				direction="column"
				gap="5"
				mt="5"
				py="3"
				className="border-b border-t border-border"
			>
				{providerNames.map((providerName) => (
					<ProviderConnectionForm
						key={providerName}
						type="Connect"
						providerName={providerName}
					/>
				))}
			</Flex>
		</Container>
	);
}

function Connection({
	connection,
	canDelete,
}: {
	connection: SerializeFrom<typeof loader>["connections"][number];
	canDelete: boolean;
}) {
	const deleteFetcher = useFetcher<typeof action>();
	const [infoOpen, setInfoOpen] = useState(false);
	const icon = providerIcons[connection.providerName];
	return (
		<Flex justify="between" gap="2">
			<Flex as="span" display="inline-flex" align="center" gap="2">
				{icon}
				<Box as="span">
					{connection.link ? (
						<Link href={connection.link} underline="always">
							{connection.displayName}
						</Link>
					) : (
						connection.displayName
					)}{" "}
					({connection.createdAtFormatted})
				</Box>
			</Flex>
			{canDelete ? (
				<deleteFetcher.Form method="POST">
					<input name="connectionId" value={connection.id} type="hidden" />
					<Tooltip content="Disconnect this account">
						<IconButton
							name="intent"
							value="delete-connection"
							color="red"
							size="2"
							loading={deleteFetcher.state !== "idle"}
						>
							<Cross1Icon />
						</IconButton>
					</Tooltip>
				</deleteFetcher.Form>
			) : (
				<Tooltip
					open={infoOpen}
					onOpenChange={setInfoOpen}
					onClick={() => setInfoOpen(true)}
					content="You cannot delete your last connection unless you have a password."
				>
					<QuestionMarkCircledIcon />
				</Tooltip>
			)}
		</Flex>
	);
}
