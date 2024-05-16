import type { SEOHandle } from "@nasa-gcn/remix-seo";
import { Outlet } from "@remix-run/react";
import type { VerificationTypes } from "#app/routes/_auth+/verify.tsx";
import type { BreadcrumbHandle } from "./profile.tsx";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@radix-ui/themes";

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: (
		<Button variant="ghost">
			<LockClosedIcon />
			2FA
		</Button>
	),
	getSitemapEntries: () => null,
};

export const twoFAVerificationType = "2fa" satisfies VerificationTypes;

export default function TwoFactorRoute() {
	return <Outlet />;
}
