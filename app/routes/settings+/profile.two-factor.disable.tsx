import type { SEOHandle } from "@nasa-gcn/remix-seo";
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { requireRecentVerification } from "#app/routes/_auth+/verify.server.ts";
import { requireUserId } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { useDoubleCheck } from "#app/utils/misc.tsx";
import { redirectWithToast } from "#app/utils/toast.server.ts";
import type { BreadcrumbHandle } from "./profile.tsx";
import { twoFAVerificationType } from "./profile.two-factor.tsx";
import { LockOpen1Icon } from "@radix-ui/react-icons";
import { Button, Container, Text } from "@radix-ui/themes";

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: (
		<Button variant="ghost">
			<LockOpen1Icon /> Disable
		</Button>
	),
	getSitemapEntries: () => null,
};

export async function loader({ request }: LoaderFunctionArgs) {
	await requireRecentVerification(request);
	return json({});
}

export async function action({ request }: ActionFunctionArgs) {
	await requireRecentVerification(request);
	const userId = await requireUserId(request);
	await prisma.verification.delete({
		where: { target_type: { target: userId, type: twoFAVerificationType } },
	});
	return redirectWithToast("/settings/profile/two-factor", {
		title: "2FA Disabled",
		description: "Two factor authentication has been disabled.",
	});
}

export default function TwoFactorDisableRoute() {
	const disable2FAFetcher = useFetcher<typeof action>();
	const dc = useDoubleCheck();

	return (
		<Container className="mx-auto max-w-sm">
			<disable2FAFetcher.Form method="POST">
				<Text>
					Disabling two factor authentication is not recommended. However, if
					you would like to do so, click here:
				</Text>
				<Button
					loading={disable2FAFetcher.state === "loading"}
					{...dc.getButtonProps({
						className: "mx-auto",
						name: "intent",
						value: "disable",
						type: "submit",
					})}
					color="red"
				>
					{dc.doubleCheck ? "Are you sure?" : "Disable 2FA"}
				</Button>
			</disable2FAFetcher.Form>
		</Container>
	);
}
