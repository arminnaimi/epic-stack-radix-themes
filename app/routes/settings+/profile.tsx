import { invariantResponse } from "@epic-web/invariant";
import type { SEOHandle } from "@nasa-gcn/remix-seo";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useMatches } from "@remix-run/react";
import { z } from "zod";
import { Spacer } from "#app/components/spacer.tsx";
import { requireUserId } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { useUser } from "#app/utils/user.ts";
import { ChevronRightIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Button, Card, Container, Flex } from "@radix-ui/themes";
import React from "react";

export const BreadcrumbHandle = z.object({ breadcrumb: z.any() });
export type BreadcrumbHandle = z.infer<typeof BreadcrumbHandle>;

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: (
		<Button variant="ghost">
			<FileTextIcon />
			Edit Profile
		</Button>
	),
	getSitemapEntries: () => null,
};

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request);
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { username: true },
	});
	invariantResponse(user, "User not found", { status: 404 });
	return json({});
}

const BreadcrumbHandleMatch = z.object({
	handle: BreadcrumbHandle,
});

export default function EditUserProfile() {
	const user = useUser();
	const matches = useMatches();
	const breadcrumbs = matches
		.map((m) => {
			const result = BreadcrumbHandleMatch.safeParse(m);
			if (!result.success || !result.data.handle.breadcrumb) return null;
			return (
				<Link key={m.id} to={m.pathname} className="flex items-center">
					{result.data.handle.breadcrumb}
				</Link>
			);
		})
		.filter(Boolean);

	return (
		<Container size="2" mb="6" mt="5">
			<Container>
				<Flex gap="3" align="center">
					<Button variant="ghost" asChild>
						<Link to={`/users/${user.username}`}>Profile</Link>
					</Button>

					{breadcrumbs.map((breadcrumb, i, arr) => (
						<React.Fragment key={breadcrumb.key}>
							<ChevronRightIcon /> {breadcrumb}
						</React.Fragment>
					))}
				</Flex>
			</Container>
			<Spacer size="xs" />
			<Container>
				<Card>
					<Outlet />
				</Card>
			</Container>
		</Container>
	);
}
