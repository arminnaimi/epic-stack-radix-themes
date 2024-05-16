import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { SEOHandle } from "@nasa-gcn/remix-seo";
import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { ErrorList, Field } from "#app/components/forms.tsx";
import {
	prepareVerification,
	requireRecentVerification,
} from "#app/routes/_auth+/verify.server.ts";
import { requireUserId } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { sendEmail } from "#app/utils/email.server.ts";
import { useIsPending } from "#app/utils/misc.tsx";
import { EmailSchema } from "#app/utils/user-validation.ts";
import { verifySessionStorage } from "#app/utils/verification.server.ts";
import { EmailChangeEmail } from "./profile.change-email.server.tsx";
import type { BreadcrumbHandle } from "./profile.tsx";
import { EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { Box, Button, Container, Heading, Text } from "@radix-ui/themes";

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: (
		<Button variant="ghost">
			<EnvelopeClosedIcon /> Change Email
		</Button>
	),
	getSitemapEntries: () => null,
};

export const newEmailAddressSessionKey = "new-email-address";

const ChangeEmailSchema = z.object({
	email: EmailSchema,
});

export async function loader({ request }: LoaderFunctionArgs) {
	await requireRecentVerification(request);
	const userId = await requireUserId(request);
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});
	if (!user) {
		const params = new URLSearchParams({ redirectTo: request.url });
		throw redirect(`/login?${params}`);
	}
	return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request);
	const formData = await request.formData();
	const submission = await parseWithZod(formData, {
		schema: ChangeEmailSchema.superRefine(async (data, ctx) => {
			const existingUser = await prisma.user.findUnique({
				where: { email: data.email },
			});
			if (existingUser) {
				ctx.addIssue({
					path: ["email"],
					code: z.ZodIssueCode.custom,
					message: "This email is already in use.",
				});
			}
		}),
		async: true,
	});

	if (submission.status !== "success") {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === "error" ? 400 : 200 },
		);
	}
	const { otp, redirectTo, verifyUrl } = await prepareVerification({
		period: 10 * 60,
		request,
		target: userId,
		type: "change-email",
	});

	const response = await sendEmail({
		to: submission.value.email,
		subject: "Epic Notes Email Change Verification",
		react: <EmailChangeEmail verifyUrl={verifyUrl.toString()} otp={otp} />,
	});

	if (response.status === "success") {
		const verifySession = await verifySessionStorage.getSession();
		verifySession.set(newEmailAddressSessionKey, submission.value.email);
		return redirect(redirectTo.toString(), {
			headers: {
				"set-cookie": await verifySessionStorage.commitSession(verifySession),
			},
		});
	}
	return json(
		{ result: submission.reply({ formErrors: [response.error.message] }) },
		{ status: 500 },
	);
}

export default function ChangeEmailIndex() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

	const [form, fields] = useForm({
		id: "change-email-form",
		constraint: getZodConstraint(ChangeEmailSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ChangeEmailSchema });
		},
	});

	const isPending = useIsPending();
	return (
		<Box>
			<Heading size="7">Change Email</Heading>
			<Text as="p">
				You will receive an email at the new email address to confirm.
			</Text>
			<Text as="p">
				An email notice will also be sent to your old address {data.user.email}.
			</Text>
			<Container>
				<Form method="POST" {...getFormProps(form)}>
					<Field
						labelProps={{ children: "New Email" }}
						inputProps={{
							...getInputProps(fields.email, { type: "email" }),
							autoComplete: "email",
						}}
						errors={fields.email.errors}
					/>
					<ErrorList id={form.errorId} errors={form.errors} />
					<Box>
						<Button loading={isPending}>Send Confirmation</Button>
					</Box>
				</Form>
			</Container>
		</Box>
	);
}
