import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { invariantResponse } from "@epic-web/invariant";
import type { SEOHandle } from "@nasa-gcn/remix-seo";
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { ErrorList, Field } from "#app/components/forms.tsx";
import { requireUserId, sessionKey } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { getUserImgSrc, useDoubleCheck } from "#app/utils/misc.tsx";
import { authSessionStorage } from "#app/utils/session.server.ts";
import { redirectWithToast } from "#app/utils/toast.server.ts";
import { NameSchema, UsernameSchema } from "#app/utils/user-validation.ts";
import { twoFAVerificationType } from "./profile.two-factor.tsx";
import {
	AvatarIcon,
	CameraIcon,
	DotsHorizontalIcon,
	DownloadIcon,
	EnvelopeClosedIcon,
	Link2Icon,
	LockClosedIcon,
	LockOpen1Icon,
	TrashIcon,
} from "@radix-ui/react-icons";
import { Box, Button, Flex, IconButton, Separator } from "@radix-ui/themes";

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
};

const ProfileFormSchema = z.object({
	name: NameSchema.optional(),
	username: UsernameSchema,
});

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request);
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			email: true,
			image: {
				select: { id: true },
			},
			_count: {
				select: {
					sessions: {
						where: {
							expirationDate: { gt: new Date() },
						},
					},
				},
			},
		},
	});

	const twoFactorVerification = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { type: twoFAVerificationType, target: userId } },
	});

	const password = await prisma.password.findUnique({
		select: { userId: true },
		where: { userId },
	});

	return json({
		user,
		hasPassword: Boolean(password),
		isTwoFactorEnabled: Boolean(twoFactorVerification),
	});
}

type ProfileActionArgs = {
	request: Request;
	userId: string;
	formData: FormData;
};
const profileUpdateActionIntent = "update-profile";
const signOutOfSessionsActionIntent = "sign-out-of-sessions";
const deleteDataActionIntent = "delete-data";

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request);
	const formData = await request.formData();
	const intent = formData.get("intent");
	switch (intent) {
		case profileUpdateActionIntent: {
			return profileUpdateAction({ request, userId, formData });
		}
		case signOutOfSessionsActionIntent: {
			return signOutOfSessionsAction({ request, userId, formData });
		}
		case deleteDataActionIntent: {
			return deleteDataAction({ request, userId, formData });
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 });
		}
	}
}

export default function EditUserProfile() {
	const data = useLoaderData<typeof loader>();

	return (
		<Flex direction="column" gap="6">
			<div className="flex justify-center">
				<div className="relative h-52 w-52">
					<img
						src={getUserImgSrc(data.user.image?.id)}
						alt={data.user.username}
						className="h-full w-full rounded-full object-cover"
					/>
					<IconButton
						asChild
						variant="soft"
						className="absolute -right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full p-0"
					>
						<Link
							preventScrollReset
							to="photo"
							title="Change profile photo"
							aria-label="Change profile photo"
						>
							<CameraIcon />
						</Link>
					</IconButton>
				</div>
			</div>
			<UpdateProfile />

			<Separator size="4" />

			<div className="col-span-full flex flex-col gap-6">
				<Box>
					<Button asChild>
						<Link to="change-email">
							<EnvelopeClosedIcon /> Change email from {data.user.email}
						</Link>
					</Button>
				</Box>
				<Box>
					<Button asChild>
						<Link to="two-factor">
							{data.isTwoFactorEnabled ? (
								<>
									<LockClosedIcon /> 2FA is enabled
								</>
							) : (
								<>
									<LockOpen1Icon /> Enable 2FA
								</>
							)}
						</Link>
					</Button>
				</Box>
				<Box>
					<Button asChild>
						<Link to={data.hasPassword ? "password" : "password/create"}>
							<DotsHorizontalIcon />{" "}
							{data.hasPassword ? "Change Password" : "Create a Password"}
						</Link>
					</Button>
				</Box>
				<Box>
					<Button asChild>
						<Link to="connections">
							<Link2Icon /> Manage connections
						</Link>
					</Button>
				</Box>
				<Box>
					<Button asChild>
						<Link
							reloadDocument
							download="my-epic-notes-data.json"
							to="/resources/download-user-data"
						>
							<DownloadIcon />
							Download your data
						</Link>
					</Button>
				</Box>
				<SignOutOfSessions />
				<DeleteData />
			</div>
		</Flex>
	);
}

async function profileUpdateAction({ userId, formData }: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		async: true,
		schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
			const existingUsername = await prisma.user.findUnique({
				where: { username },
				select: { id: true },
			});
			if (existingUsername && existingUsername.id !== userId) {
				ctx.addIssue({
					path: ["username"],
					code: z.ZodIssueCode.custom,
					message: "A user already exists with this username",
				});
			}
		}),
	});
	if (submission.status !== "success") {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === "error" ? 400 : 200 },
		);
	}

	const data = submission.value;

	await prisma.user.update({
		select: { username: true },
		where: { id: userId },
		data: {
			name: data.name,
			username: data.username,
		},
	});

	return json({
		result: submission.reply(),
	});
}

function UpdateProfile() {
	const data = useLoaderData<typeof loader>();

	const fetcher = useFetcher<typeof profileUpdateAction>();

	const [form, fields] = useForm({
		id: "edit-profile",
		constraint: getZodConstraint(ProfileFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ProfileFormSchema });
		},
		defaultValue: {
			username: data.user.username,
			name: data.user.name,
		},
	});

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<div className="grid grid-cols-6 gap-x-10">
				<Field
					className="col-span-3"
					labelProps={{
						htmlFor: fields.username.id,
						children: "Username",
					}}
					inputProps={getInputProps(fields.username, { type: "text" })}
					errors={fields.username.errors}
				/>
				<Field
					className="col-span-3"
					labelProps={{ htmlFor: fields.name.id, children: "Name" }}
					inputProps={getInputProps(fields.name, { type: "text" })}
					errors={fields.name.errors}
				/>
			</div>

			<ErrorList errors={form.errors} id={form.errorId} />

			<Flex justify="center" mt="4">
				<Button
					type="submit"
					name="intent"
					value={profileUpdateActionIntent}
					loading={fetcher.state !== "idle"}
				>
					Save changes
				</Button>
			</Flex>
		</fetcher.Form>
	);
}

async function signOutOfSessionsAction({ request, userId }: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get("cookie"),
	);
	const sessionId = authSession.get(sessionKey);
	invariantResponse(
		sessionId,
		"You must be authenticated to sign out of other sessions",
	);
	await prisma.session.deleteMany({
		where: {
			userId,
			id: { not: sessionId },
		},
	});
	return json({ status: "success" } as const);
}

function SignOutOfSessions() {
	const data = useLoaderData<typeof loader>();
	const dc = useDoubleCheck();

	const fetcher = useFetcher<typeof signOutOfSessionsAction>();
	const otherSessionsCount = data.user._count.sessions - 1;
	return (
		<div>
			{otherSessionsCount ? (
				<fetcher.Form method="POST">
					<Button
						{...dc.getButtonProps({
							type: "submit",
							name: "intent",
							value: signOutOfSessionsActionIntent,
						})}
						color={dc.doubleCheck ? "red" : undefined}
						loading={fetcher.state !== "idle"}
					>
						<AvatarIcon />

						{dc.doubleCheck
							? "Are you sure?"
							: `Sign out of ${otherSessionsCount} other sessions`}
					</Button>
				</fetcher.Form>
			) : (
				<Button>
					<AvatarIcon />
					This is your only session
				</Button>
			)}
		</div>
	);
}

async function deleteDataAction({ userId }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: userId } });
	return redirectWithToast("/", {
		type: "success",
		title: "Data Deleted",
		description: "All of your data has been deleted",
	});
}

function DeleteData() {
	const dc = useDoubleCheck();

	const fetcher = useFetcher<typeof deleteDataAction>();
	return (
		<div>
			<fetcher.Form method="POST">
				<Button
					{...dc.getButtonProps({
						type: "submit",
						name: "intent",
						value: deleteDataActionIntent,
					})}
					color={dc.doubleCheck ? "red" : undefined}
					loading={fetcher.state !== "idle"}
				>
					<TrashIcon />
					{dc.doubleCheck ? "Are you sure?" : "Delete all your data"}
				</Button>
			</fetcher.Form>
		</div>
	);
}
