import type { SEOHandle } from "@nasa-gcn/remix-seo";
import {
	json,
	redirect,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { requireUserId } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { generateTOTP } from "#app/utils/totp.server.ts";
import { twoFAVerificationType } from "./profile.two-factor.tsx";
import { twoFAVerifyVerificationType } from "./profile.two-factor.verify.tsx";
import { CheckIcon, LockOpen1Icon } from "@radix-ui/react-icons";
import { Button, Flex, Text, Link as RadixLink } from "@radix-ui/themes";

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
};

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request);
	const verification = await prisma.verification.findUnique({
		where: { target_type: { type: twoFAVerificationType, target: userId } },
		select: { id: true },
	});
	return json({ is2FAEnabled: Boolean(verification) });
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request);
	const { otp: _otp, ...config } = generateTOTP();
	const verificationData = {
		...config,
		type: twoFAVerifyVerificationType,
		target: userId,
	};
	await prisma.verification.upsert({
		where: {
			target_type: { target: userId, type: twoFAVerifyVerificationType },
		},
		create: verificationData,
		update: verificationData,
	});
	return redirect("/settings/profile/two-factor/verify");
}

export default function TwoFactorRoute() {
	const data = useLoaderData<typeof loader>();
	const enable2FAFetcher = useFetcher<typeof action>();

	return (
		<Flex direction="column" gap="4">
			{data.is2FAEnabled ? (
				<>
					<Text size="6">
						<CheckIcon name="check" />
						You have enabled two-factor authentication.
					</Text>
					<Button asChild>
						<Link to="disable">
							<LockOpen1Icon name="lock-open-1" />
							Disable 2FA
						</Link>
					</Button>
				</>
			) : (
				<>
					<Flex align="center" gap="2">
						<LockOpen1Icon name="lock-open-1" />
						<Text as="div">
							You have not enabled two-factor authentication yet.
						</Text>
					</Flex>
					<Text size="2">
						Two factor authentication adds an extra layer of security to your
						account. You will need to enter a code from an authenticator app
						like{" "}
						<RadixLink underline="always" href="https://1password.com/">
							1Password
						</RadixLink>{" "}
						to log in.
					</Text>
					<enable2FAFetcher.Form method="POST">
						<Button
							type="submit"
							name="intent"
							value="enable"
							loading={enable2FAFetcher.state === "loading"}
							className="mx-auto"
						>
							Enable 2FA
						</Button>
					</enable2FAFetcher.Form>
				</>
			)}
		</Flex>
	);
}
