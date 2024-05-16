import { getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { invariantResponse } from "@epic-web/invariant";
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	type MetaFunction,
} from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx";
import { ErrorList } from "#app/components/forms.tsx";
import { requireUserId } from "#app/utils/auth.server.ts";
import { prisma } from "#app/utils/db.server.ts";
import { getNoteImgSrc, useIsPending } from "#app/utils/misc.tsx";
import { requireUserWithPermission } from "#app/utils/permissions.server.ts";
import { redirectWithToast } from "#app/utils/toast.server.ts";
import { userHasPermission, useOptionalUser } from "#app/utils/user.ts";
import type { loader as notesLoader } from "./notes.tsx";
import {
	Box,
	Button,
	Flex,
	Grid,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { ClockIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";

export async function loader({ params }: LoaderFunctionArgs) {
	const note = await prisma.note.findUnique({
		where: { id: params.noteId },
		select: {
			id: true,
			title: true,
			content: true,
			ownerId: true,
			updatedAt: true,
			images: {
				select: {
					id: true,
					altText: true,
				},
			},
		},
	});

	invariantResponse(note, "Not found", { status: 404 });

	const date = new Date(note.updatedAt);
	const timeAgo = formatDistanceToNow(date);

	return json({
		note,
		timeAgo,
	});
}

const DeleteFormSchema = z.object({
	intent: z.literal("delete-note"),
	noteId: z.string(),
});

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request);
	const formData = await request.formData();
	const submission = parseWithZod(formData, {
		schema: DeleteFormSchema,
	});
	if (submission.status !== "success") {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === "error" ? 400 : 200 },
		);
	}

	const { noteId } = submission.value;

	const note = await prisma.note.findFirst({
		select: { id: true, ownerId: true, owner: { select: { username: true } } },
		where: { id: noteId },
	});
	invariantResponse(note, "Not found", { status: 404 });

	const isOwner = note.ownerId === userId;
	await requireUserWithPermission(
		request,
		isOwner ? "delete:note:own" : "delete:note:any",
	);

	await prisma.note.delete({ where: { id: note.id } });

	return redirectWithToast(`/users/${note.owner.username}/notes`, {
		type: "success",
		title: "Success",
		description: "Your note has been deleted.",
	});
}

export default function NoteRoute() {
	const data = useLoaderData<typeof loader>();
	const user = useOptionalUser();
	const isOwner = user?.id === data.note.ownerId;
	const canDelete = userHasPermission(
		user,
		isOwner ? "delete:note:own" : "delete:note:any",
	);
	const displayBar = canDelete || isOwner;

	return (
		<Flex direction="column" position="absolute" inset="0">
			<Flex justify="between" pt="4" px="4">
				<Heading size="8">{data.note.title}</Heading>
				{displayBar ? (
					<Flex align="center" gap="3">
						<Flex align="center" gap="2">
							<ClockIcon className="scale-125" />
							<Text size="2">{data.timeAgo} ago</Text>
						</Flex>
						<Grid
							flexShrink="1"
							columns="2"
							justify="end"
							gap={{ initial: "1", md: "2" }}
						>
							{canDelete ? <DeleteNote id={data.note.id} /> : null}
							<Button asChild>
								<Link to="edit">
									<Pencil1Icon
										name="pencil-1"
										className="scale-125 max-md:scale-150"
									/>
									<span className="max-md:hidden">Edit</span>
								</Link>
							</Button>
						</Grid>
					</Flex>
				) : null}
			</Flex>

			<ScrollArea scrollbars="vertical">
				<Box p="4">
					<Box pb={displayBar ? "4" : "2"}>
						<Flex wrap="wrap" gap="5" py="5">
							{data.note.images.map((image) => (
								<a key={image.id} href={getNoteImgSrc(image.id)}>
									<img
										src={getNoteImgSrc(image.id)}
										alt={image.altText ?? ""}
										className="h-32 w-32 rounded-lg object-cover"
									/>
								</a>
							))}
						</Flex>
					</Box>

					<Text className="whitespace-break-spaces">{data.note.content}</Text>
				</Box>
			</ScrollArea>
		</Flex>
	);
}

export function DeleteNote({ id }: { id: string }) {
	const actionData = useActionData<typeof action>();
	const isPending = useIsPending();
	const [form] = useForm({
		id: "delete-note",
		lastResult: actionData?.result,
	});

	return (
		<Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="noteId" value={id} />
			<Button
				type="submit"
				name="intent"
				value="delete-note"
				color="red"
				loading={isPending}
				disabled={isPending}
			>
				<TrashIcon className="scale-125 max-md:scale-150" />
				<span className="max-md:hidden">Delete</span>
			</Button>
			<ErrorList errors={form.errors} id={form.errorId} />
		</Form>
	);
}

export const meta: MetaFunction<
	typeof loader,
	{ "routes/users+/$username_+/notes": typeof notesLoader }
> = ({ data, params, matches }) => {
	const notesMatch = matches.find(
		(m) => m.id === "routes/users+/$username_+/notes",
	);
	const displayName = notesMatch?.data?.owner.name ?? params.username;
	const noteTitle = data?.note.title ?? "Note";
	const noteContentsSummary =
		data && data.note.content.length > 100
			? `${data?.note.content.slice(0, 97)}...`
			: "No content";
	return [
		{ title: `${noteTitle} | ${displayName}'s Notes | Epic Notes` },
		{
			name: "description",
			content: noteContentsSummary,
		},
	];
};

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	);
}
