import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { HoneypotInputs } from "remix-utils/honeypot/react";
import { z } from "zod";
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx";
import { CheckboxField, ErrorList, Field } from "#app/components/forms.tsx";
import { Spacer } from "#app/components/spacer.tsx";
import { login, requireAnonymous } from "#app/utils/auth.server.ts";
import {
	ProviderConnectionForm,
	providerNames,
} from "#app/utils/connections.tsx";
import { checkHoneypot } from "#app/utils/honeypot.server.ts";
import { useIsPending } from "#app/utils/misc.tsx";
import { PasswordSchema, UsernameSchema } from "#app/utils/user-validation.ts";
import { handleNewSession } from "./login.server.ts";
import {
	Box,
	Button,
	Container,
	Flex,
	Heading,
	Separator,
	Text,
} from "@radix-ui/themes";

const LoginFormSchema = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	redirectTo: z.string().optional(),
	remember: z.boolean().optional(),
});

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAnonymous(request);
	return json({});
}

export async function action({ request }: ActionFunctionArgs) {
	await requireAnonymous(request);
	const formData = await request.formData();
	checkHoneypot(formData);
	const submission = await parseWithZod(formData, {
		schema: (intent) =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== null) return { ...data, session: null };

				const session = await login(data);
				if (!session) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Invalid username or password",
					});
					return z.NEVER;
				}

				return { ...data, session };
			}),
		async: true,
	});

	if (submission.status !== "success" || !submission.value.session) {
		return json(
			{ result: submission.reply({ hideFields: ["password"] }) },
			{ status: submission.status === "error" ? 400 : 200 },
		);
	}

	const { session, remember, redirectTo } = submission.value;

	return handleNewSession({
		request,
		session,
		remember: remember ?? false,
		redirectTo,
	});
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>();
	const isPending = useIsPending();
	const [searchParams] = useSearchParams();
	const redirectTo = searchParams.get("redirectTo");

	const [form, fields] = useForm({
		id: "login-form",
		constraint: getZodConstraint(LoginFormSchema),
		defaultValue: { redirectTo },
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: LoginFormSchema });
		},
		shouldRevalidate: "onBlur",
	});

	return (
		<Flex direction="column" minHeight="100%" justify="center" pb="5" pt="9">
			<Container size="1">
				<Flex direction="column" gap="3" className="text-center">
					<Heading size="8">Welcome back!</Heading>
					<Text size="5">Please enter your details.</Text>
				</Flex>
				<Spacer size="xs" />

				<Box>
					<Container>
						<Flex gap="3" direction="column">
							<Form method="POST" {...getFormProps(form)}>
								<HoneypotInputs />
								<Field
									labelProps={{ children: "Username" }}
									inputProps={{
										...getInputProps(fields.username, { type: "text" }),
										autoFocus: true,
										className: "lowercase",
										autoComplete: "username",
									}}
									errors={fields.username.errors}
								/>

								<Field
									labelProps={{ children: "Password" }}
									inputProps={{
										...getInputProps(fields.password, {
											type: "password",
										}),
										autoComplete: "current-password",
									}}
									errors={fields.password.errors}
								/>

								<Flex justify="between">
									<CheckboxField
										labelProps={{
											htmlFor: fields.remember.id,
											children: "Remember me",
										}}
										buttonProps={getInputProps(fields.remember, {
											type: "checkbox",
										})}
										errors={fields.remember.errors}
									/>
									<div>
										<Button variant="ghost" asChild>
											<Link to="/forgot-password">Forgot password?</Link>
										</Button>
									</div>
								</Flex>

								<input
									{...getInputProps(fields.redirectTo, { type: "hidden" })}
								/>
								<ErrorList errors={form.errors} id={form.errorId} />

								<Flex flexGrow="1" justify="center">
									<Button
										type="submit"
										disabled={isPending}
										loading={isPending}
									>
										Log in
									</Button>
								</Flex>
							</Form>

							<Separator size="4" />

							<ul className="flex flex-col gap-5">
								{providerNames.map((providerName) => (
									<li key={providerName}>
										<ProviderConnectionForm
											type="Login"
											providerName={providerName}
											redirectTo={redirectTo}
										/>
									</li>
								))}
							</ul>
						</Flex>
						<Flex gap="3" justify="center" align="center" pt="4">
							<Text size="2">New here?</Text>
							<Button variant="ghost" asChild>
								<Link
									to={
										redirectTo
											? `/signup?${encodeURIComponent(redirectTo)}`
											: "/signup"
									}
								>
									Create an account
								</Link>
							</Button>
						</Flex>
					</Container>
				</Box>
			</Container>
		</Flex>
	);
}

export const meta: MetaFunction = () => {
	return [{ title: "Login to Epic Notes" }];
};

export function ErrorBoundary() {
	return <GeneralErrorBoundary />;
}
