import { invariantResponse } from "@epic-web/invariant";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx";
import { prisma } from "#app/utils/db.server.ts";
import { getUserImgSrc } from "#app/utils/misc.tsx";
import { useOptionalUser } from "#app/utils/user.ts";
import { PlusIcon } from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Container,
	Flex,
	Grid,
	Heading,
	ScrollArea,
} from "@radix-ui/themes";

export async function loader({ params }: LoaderFunctionArgs) {
	const owner = await prisma.user.findFirst({
		select: {
			id: true,
			name: true,
			username: true,
			image: { select: { id: true } },
			notes: { select: { id: true, title: true } },
		},
		where: { username: params.username },
	});

	invariantResponse(owner, "Owner not found", { status: 404 });

	return json({ owner });
}

export default function NotesRoute() {
	const data = useLoaderData<typeof loader>();
	const user = useOptionalUser();
	const isOwner = user?.id === data.owner.id;
	const ownerDisplayName = data.owner.name ?? data.owner.username;

	return (
		<Flex pb="6" minHeight="400px" height="100%" px="6" className="container">
			<Grid columns="4" width="100%">
				<Box
					position="relative"
					gridColumn="1"
					className="bg-[var(--gray-3)] md:rounded-l-3xl"
				>
					<Flex direction="column" inset="0" position="absolute">
						<Flex
							direction={{ initial: "column", lg: "row" }}
							align="center"
							justify={{ initial: "center", lg: "start" }}
							gap={{ initial: "2", lg: "4" }}
							pb="4"
							pl="8"
							pr="4"
							pt="4"
							asChild
						>
							<Link to={`/users/${data.owner.username}`}>
								<img
									src={getUserImgSrc(data.owner.image?.id)}
									alt={ownerDisplayName}
									className="h-16 w-16 rounded-full object-cover lg:h-24 lg:w-24"
								/>
								<Heading
									size={{ initial: "4", md: "5", lg: "6" }}
									align={{
										initial: "center",
										lg: "left",
									}}
								>
									{ownerDisplayName}'s Notes
								</Heading>
							</Link>
						</Flex>

						<ScrollArea scrollbars="vertical">
							<Flex direction="column" gap="2" px="3">
								{isOwner ? (
									<Button asChild>
										<NavLink to="new">
											<PlusIcon />
											New Note
										</NavLink>
									</Button>
								) : null}
								{data.owner.notes.map((note) => (
									<Button key={note.id} variant="soft" asChild>
										<NavLink to={note.id} preventScrollReset prefetch="intent">
											{note.title}
										</NavLink>
									</Button>
								))}
							</Flex>
						</ScrollArea>
					</Flex>
				</Box>
				<Box
					position="relative"
					gridColumn="3"
					gridColumnStart="2"
					gridColumnEnd="5"
					className="bg-[var(--olive-2)] md:rounded-r-3xl"
				>
					<Outlet />
				</Box>
			</Grid>
		</Flex>
	);
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	);
}
