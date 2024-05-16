import {
	FormProvider,
	getFieldsetProps,
	getFormProps,
	getInputProps,
	getTextareaProps,
	useForm,
	type FieldMetadata,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { Note, NoteImage } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { useState } from "react";
import { z } from "zod";
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx";
import { ErrorList, Field, TextareaField } from "#app/components/forms.tsx";
import { Label } from "#app/components/ui/label";
import { cn, getNoteImgSrc, useIsPending } from "#app/utils/misc.tsx";
import type { action } from "./__note-editor.server";
import {
	Box,
	Button,
	Flex,
	IconButton,
	ScrollArea,
	TextArea,
} from "@radix-ui/themes";
import { Cross1Icon, PlusIcon } from "@radix-ui/react-icons";

const titleMinLength = 1;
const titleMaxLength = 100;
const contentMinLength = 1;
const contentMaxLength = 10000;

export const MAX_UPLOAD_SIZE = 1024 * 1024 * 3; // 3MB

const ImageFieldsetSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.optional()
		.refine((file) => {
			return !file || file.size <= MAX_UPLOAD_SIZE;
		}, "File size must be less than 3MB"),
	altText: z.string().optional(),
});

export type ImageFieldset = z.infer<typeof ImageFieldsetSchema>;

export const NoteEditorSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(titleMinLength).max(titleMaxLength),
	content: z.string().min(contentMinLength).max(contentMaxLength),
	images: z.array(ImageFieldsetSchema).max(5).optional(),
});

export function NoteEditor({
	note,
}: {
	note?: SerializeFrom<
		Pick<Note, "id" | "title" | "content"> & {
			images: Array<Pick<NoteImage, "id" | "altText">>;
		}
	>;
}) {
	const actionData = useActionData<typeof action>();
	const isPending = useIsPending();

	const [form, fields] = useForm({
		id: "note-editor",
		constraint: getZodConstraint(NoteEditorSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: NoteEditorSchema });
		},
		defaultValue: {
			...note,
			images: note?.images ?? [{}],
		},
		shouldRevalidate: "onBlur",
	});
	const imageList = fields.images.getFieldList();

	return (
		<FormProvider context={form.context}>
			<Flex direction="column" gap="3" height="100%" justify="between">
				<ScrollArea scrollbars="vertical">
					<Box p="4">
						<Form
							method="POST"
							{...getFormProps(form)}
							encType="multipart/form-data"
						>
							{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
							<button type="submit" className="hidden" />
							{note ? <input type="hidden" name="id" value={note.id} /> : null}
							<Flex direction="column" gap="1">
								<Field
									labelProps={{ children: "Title" }}
									inputProps={{
										autoFocus: true,
										...getInputProps(fields.title, { type: "text" }),
									}}
									errors={fields.title.errors}
								/>
								<TextareaField
									labelProps={{ children: "Content" }}
									textareaProps={{
										...getTextareaProps(fields.content),
									}}
									errors={fields.content.errors}
								/>
								<div>
									<Label>Images</Label>
									<Flex direction="column" gap="4">
										{imageList.map((image, index) => {
											return (
												<Flex direction="column" align="end" key={image.key}>
													<IconButton
														size="1"
														color="red"
														{...form.remove.getButtonProps({
															name: fields.images.name,
															index,
														})}
													>
														<span aria-hidden>
															<Cross1Icon />
														</span>{" "}
														<span className="sr-only">
															Remove image {index + 1}
														</span>
													</IconButton>
													<ImageChooser meta={image} />
												</Flex>
											);
										})}
									</Flex>
								</div>
								<Button
									{...form.insert.getButtonProps({ name: fields.images.name })}
								>
									<PlusIcon />
									Image
									<span className="sr-only">Add image</span>
								</Button>
							</Flex>
							<ErrorList id={form.errorId} errors={form.errors} />
						</Form>
					</Box>
				</ScrollArea>
				<Flex justify="end" gap="3" p="4">
					<Button color="red" {...form.reset.getButtonProps()}>
						Reset
					</Button>
					<Button
						form={form.id}
						type="submit"
						disabled={isPending}
						loading={isPending}
					>
						Submit
					</Button>
				</Flex>
			</Flex>
		</FormProvider>
	);
}

function ImageChooser({ meta }: { meta: FieldMetadata<ImageFieldset> }) {
	const fields = meta.getFieldset();
	const existingImage = Boolean(fields.id.initialValue);
	const [previewImage, setPreviewImage] = useState<string | null>(
		fields.id.initialValue ? getNoteImgSrc(fields.id.initialValue) : null,
	);
	const [altText, setAltText] = useState(fields.altText.initialValue ?? "");

	return (
		<fieldset {...getFieldsetProps(meta)}>
			<Flex gap="3">
				<Box className="w-32">
					<Box position="relative" className="h-32 w-32">
						<label
							htmlFor={fields.file.id}
							className={cn("group absolute h-32 w-32 rounded-lg", {
								"bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100":
									!previewImage,
								"cursor-pointer focus-within:ring-2": !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ""}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									<PlusIcon />
								</div>
							)}
							{existingImage ? (
								<input {...getInputProps(fields.id, { type: "hidden" })} />
							) : null}
							<input
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={(event) => {
									const file = event.target.files?.[0];

									if (file) {
										const reader = new FileReader();
										reader.onloadend = () => {
											setPreviewImage(reader.result as string);
										};
										reader.readAsDataURL(file);
									} else {
										setPreviewImage(null);
									}
								}}
								accept="image/*"
								{...getInputProps(fields.file, { type: "file" })}
							/>
						</label>
					</Box>
					<Box minHeight="32px" px="4" pb="3" pt="1">
						<ErrorList id={fields.file.errorId} errors={fields.file.errors} />
					</Box>
				</Box>
				<Box flexShrink="1">
					<Label htmlFor={fields.altText.id}>Alt Text</Label>
					<TextArea
						onChange={(e) => setAltText(e.currentTarget.value)}
						{...getTextareaProps(fields.altText)}
					/>
					<Box minHeight="32px" px="4" pb="3" pt="1">
						<ErrorList
							id={fields.altText.errorId}
							errors={fields.altText.errors}
						/>
					</Box>
				</Box>
			</Flex>
			<Box minHeight="32px" px="4" pb="3" pt="1">
				<ErrorList id={meta.errorId} errors={meta.errors} />
			</Box>
		</fieldset>
	);
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	);
}
