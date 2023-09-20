import React, { FC, useState, useEffect, useRef } from "react";

import { useRouter } from "next/router";

// mobx
import { observer } from "mobx-react-lite";
import { useMobxStore } from "lib/mobx/store-provider";
// react-hook-form
import { Controller, useForm } from "react-hook-form";
// services
import aiService from "services/ai.service";
// hooks
import useToast from "hooks/use-toast";
// components
import { GptAssistantModal } from "components/core";
import { ParentIssuesListModal, TIssueFormAttributes } from "components/issues";
import {
  IssueAssigneeSelect,
  IssueDateSelect,
  IssueEstimateSelect,
  IssueLabelSelect,
  IssuePrioritySelect,
  IssueProjectSelect,
  IssueStateSelect,
} from "components/issues/select";
import { CreateStateModal } from "components/states";
import { CreateLabelModal } from "components/labels";
import {
  CustomAttributesCheckboxes,
  CustomAttributesDescriptionFields,
  CustomAttributesFileUploads,
  CustomAttributesSelectFields,
  ObjectsSelect,
} from "components/custom-attributes";
// ui
import {
  CustomMenu,
  Input,
  Loader,
  PrimaryButton,
  SecondaryButton,
  ToggleSwitch,
} from "components/ui";
import { TipTapEditor } from "components/tiptap";
// icons
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
// types
import type { ICurrentUserResponse, IIssue, ISearchIssueResponse } from "types";

const defaultValues: Partial<IIssue> = {
  project: "",
  name: "",
  description_html: "<p></p>",
  entity: null,
  estimate_point: null,
  state: "",
  parent: null,
  priority: "none",
  assignees: [],
  assignees_list: [],
  labels: [],
  labels_list: [],
  start_date: null,
  target_date: null,
};

export interface IssueFormProps {
  handleFormSubmit: (values: Partial<IIssue>) => Promise<void>;
  initialData?: Partial<IIssue>;
  projectId: string;
  setActiveProject: React.Dispatch<React.SetStateAction<string | null>>;
  createMore: boolean;
  setCreateMore: React.Dispatch<React.SetStateAction<boolean>>;
  handleDiscardClose: () => void;
  status: boolean;
  user: ICurrentUserResponse | undefined;
  handleFormDirty: (payload: Partial<IIssue> | null) => void;
  customAttributesList: { [key: string]: string[] };
  handleCustomAttributesChange: (attributeId: string, val: string | string[] | undefined) => void;
  fieldsToShow: TIssueFormAttributes[];
}

export const IssueForm: FC<IssueFormProps> = observer((props) => {
  const {
    handleFormSubmit,
    initialData,
    projectId,
    setActiveProject,
    createMore,
    setCreateMore,
    handleDiscardClose,
    status,
    user,
    fieldsToShow,
    handleFormDirty,
    customAttributesList,
    handleCustomAttributesChange,
  } = props;

  const [stateModal, setStateModal] = useState(false);
  const [labelModal, setLabelModal] = useState(false);
  const [parentIssueListModalOpen, setParentIssueListModalOpen] = useState(false);
  const [selectedParentIssue, setSelectedParentIssue] = useState<ISearchIssueResponse | null>(null);

  const [gptAssistantModal, setGptAssistantModal] = useState(false);
  const [iAmFeelingLucky, setIAmFeelingLucky] = useState(false);

  const editorRef = useRef<any>(null);

  const router = useRouter();
  const { workspaceSlug } = router.query;

  const { setToastAlert } = useToast();

  const { customAttributes, customAttributeValues } = useMobxStore();

  const {
    register,
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    reset,
    watch,
    control,
    getValues,
    setValue,
    setFocus,
  } = useForm<IIssue>({
    defaultValues: initialData ?? defaultValues,
    reValidateMode: "onChange",
  });

  const issueName = watch("name");

  const payload: Partial<IIssue> = {
    name: getValues("name"),
    description: getValues("description"),
    state: getValues("state"),
    priority: getValues("priority"),
    assignees: getValues("assignees"),
    labels: getValues("labels"),
    start_date: getValues("start_date"),
    target_date: getValues("target_date"),
    project: getValues("project"),
    parent: getValues("parent"),
    cycle: getValues("cycle"),
    module: getValues("module"),
  };

  const entityId = watch("entity");

  useEffect(() => {
    if (isDirty) handleFormDirty(payload);
    else handleFormDirty(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload), isDirty]);

  const handleCreateUpdateIssue = async (formData: Partial<IIssue>) => {
    await handleFormSubmit(formData);

    if (!workspaceSlug) return;

    setGptAssistantModal(false);

    reset({
      ...defaultValues,
      project: projectId,
      description_html: "<p></p>",
    });
    editorRef?.current?.clearEditor();
  };

  const handleAiAssistance = async (response: string) => {
    if (!workspaceSlug || !projectId) return;

    setValue("description", {});
    setValue("description_html", `${watch("description_html")}<p>${response}</p>`);
    editorRef.current?.setEditorValue(`${watch("description_html")}`);
  };

  const handleAutoGenerateDescription = async () => {
    if (!workspaceSlug || !projectId) return;

    setIAmFeelingLucky(true);

    aiService
      .createGptTask(
        workspaceSlug as string,
        projectId as string,
        {
          prompt: issueName,
          task: "Generate a proper description for this issue.",
        },
        user
      )
      .then((res) => {
        if (res.response === "")
          setToastAlert({
            type: "error",
            title: "Error!",
            message:
              "Issue title isn't informative enough to generate the description. Please try with a different title.",
          });
        else handleAiAssistance(res.response_html);
      })
      .catch((err) => {
        const error = err?.data?.error;

        if (err.status === 429)
          setToastAlert({
            type: "error",
            title: "Error!",
            message:
              error ||
              "You have reached the maximum number of requests of 50 requests per month per user.",
          });
        else
          setToastAlert({
            type: "error",
            title: "Error!",
            message: error || "Some error occurred. Please try again.",
          });
      })
      .finally(() => setIAmFeelingLucky(false));
  };

  useEffect(() => {
    setFocus("name");

    reset({
      ...defaultValues,
      ...initialData,
    });
  }, [setFocus, initialData, reset]);

  // update projectId in form when projectId changes
  useEffect(() => {
    reset({
      ...getValues(),
      project: projectId,
    });
  }, [getValues, projectId, reset]);

  const startDate = watch("start_date");
  const targetDate = watch("target_date");

  const minDate = startDate ? new Date(startDate) : null;
  minDate?.setDate(minDate.getDate());

  const maxDate = targetDate ? new Date(targetDate) : null;
  maxDate?.setDate(maxDate.getDate());

  // fetch entity/object details, including the list of attributes
  useEffect(() => {
    if (!entityId) return;

    if (!customAttributes.objectAttributes[entityId]) {
      if (!workspaceSlug) return;

      customAttributes.fetchObjectDetails(workspaceSlug.toString(), entityId);
    }
  }, [customAttributes, entityId, workspaceSlug]);

  // assign default values to attributes
  useEffect(() => {
    if (
      !entityId ||
      !customAttributes.objectAttributes[entityId] ||
      Object.keys(customAttributesList).length > 0
    )
      return;

    Object.values(customAttributes.objectAttributes[entityId]).forEach((attribute) => {
      handleCustomAttributesChange(attribute.id, attribute.default_value);
    });
  }, [customAttributes, customAttributesList, entityId, handleCustomAttributesChange]);

  // fetch issue attribute values
  useEffect(() => {
    if (!initialData || !initialData.id) return;

    if (
      !customAttributeValues.issueAttributeValues ||
      !customAttributeValues.issueAttributeValues[initialData.id]
    ) {
      if (!workspaceSlug) return;

      customAttributeValues
        .fetchIssueAttributeValues(workspaceSlug.toString(), projectId, initialData.id)
        .then(() => {
          const issueAttributeValues =
            customAttributeValues.issueAttributeValues?.[initialData.id ?? ""];

          if (!issueAttributeValues || issueAttributeValues.length === 0) return;

          issueAttributeValues.forEach((attributeValue) => {
            if (attributeValue.prop_value)
              handleCustomAttributesChange(
                attributeValue.id,
                attributeValue.prop_value.map((val) => val.value)
              );
          });
        });
    } else {
      const issueAttributeValues =
        customAttributeValues.issueAttributeValues?.[initialData.id ?? ""];

      if (!issueAttributeValues || issueAttributeValues.length === 0) return;

      issueAttributeValues.forEach((attributeValue) => {
        if (attributeValue.prop_value)
          handleCustomAttributesChange(
            attributeValue.id,
            attributeValue.prop_value.map((val) => val.value)
          );
      });
    }
  }, [customAttributeValues, handleCustomAttributesChange, initialData, projectId, workspaceSlug]);

  return (
    <>
      {projectId && (
        <>
          <CreateStateModal
            isOpen={stateModal}
            handleClose={() => setStateModal(false)}
            projectId={projectId}
            user={user}
          />
          <CreateLabelModal
            isOpen={labelModal}
            handleClose={() => setLabelModal(false)}
            projectId={projectId}
            user={user}
            onSuccess={(response) => {
              setValue("labels", [...watch("labels"), response.id]);
              setValue("labels_list", [...watch("labels_list"), response.id]);
            }}
          />
        </>
      )}
      <form onSubmit={handleSubmit(handleCreateUpdateIssue)}>
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-x-2">
              {(fieldsToShow.includes("all") || fieldsToShow.includes("project")) && (
                <Controller
                  control={control}
                  name="project"
                  render={({ field: { value, onChange } }) => (
                    <IssueProjectSelect
                      value={value}
                      onChange={(val: string) => {
                        onChange(val);
                        setActiveProject(val);
                      }}
                    />
                  )}
                />
              )}
              <h3 className="text-xl font-semibold leading-6 text-custom-text-100">
                {status ? "Update" : "Create"} Issue
              </h3>
            </div>
            <div className="flex-shrink-0">
              {(fieldsToShow.includes("all") || fieldsToShow.includes("entity")) && (
                <Controller
                  control={control}
                  name="entity"
                  render={({ field: { value, onChange } }) => (
                    <ObjectsSelect onChange={onChange} projectId={projectId} value={value} />
                  )}
                />
              )}
            </div>
          </div>
          {watch("parent") &&
            (fieldsToShow.includes("all") || fieldsToShow.includes("parent")) &&
            selectedParentIssue && (
              <div className="flex w-min items-center gap-2 whitespace-nowrap rounded bg-custom-background-80 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: selectedParentIssue.state__color,
                    }}
                  />
                  <span className="flex-shrink-0 text-custom-text-200">
                    {selectedParentIssue.project__identifier}-{selectedParentIssue.sequence_id}
                  </span>
                  <span className="truncate font-medium">
                    {selectedParentIssue.name.substring(0, 50)}
                  </span>
                  <XMarkIcon
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setValue("parent", null);
                      setSelectedParentIssue(null);
                    }}
                  />
                </div>
              </div>
            )}
          <div className="space-y-3">
            <div className="mt-2 space-y-3">
              {(fieldsToShow.includes("all") || fieldsToShow.includes("name")) && (
                <div>
                  <Input
                    id="name"
                    name="name"
                    className="resize-none text-xl"
                    placeholder="Title"
                    autoComplete="off"
                    error={errors.name}
                    register={register}
                    validations={{
                      required: "Title is required",
                      maxLength: {
                        value: 255,
                        message: "Title should be less than 255 characters",
                      },
                    }}
                  />
                </div>
              )}
              {(fieldsToShow.includes("all") || fieldsToShow.includes("description")) && (
                <div className="relative">
                  <div className="flex justify-end">
                    {issueName && issueName !== "" && (
                      <button
                        type="button"
                        className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-custom-background-90 ${
                          iAmFeelingLucky ? "cursor-wait" : ""
                        }`}
                        onClick={handleAutoGenerateDescription}
                        disabled={iAmFeelingLucky}
                      >
                        {iAmFeelingLucky ? (
                          "Generating response..."
                        ) : (
                          <>
                            <SparklesIcon className="h-4 w-4" />I{"'"}m feeling lucky
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-custom-background-90"
                      onClick={() => setGptAssistantModal((prevData) => !prevData)}
                    >
                      <SparklesIcon className="h-4 w-4" />
                      AI
                    </button>
                  </div>
                  <Controller
                    name="description_html"
                    control={control}
                    render={({ field: { value, onChange } }) => {
                      if (!value && !watch("description_html")) return <></>;

                      return (
                        <TipTapEditor
                          workspaceSlug={workspaceSlug as string}
                          ref={editorRef}
                          debouncedUpdatesEnabled={false}
                          value={
                            !value ||
                            value === "" ||
                            (typeof value === "object" && Object.keys(value).length === 0)
                              ? watch("description_html")
                              : value
                          }
                          customClassName="min-h-[150px]"
                          onChange={(description: Object, description_html: string) => {
                            onChange(description_html);
                            setValue("description", description);
                          }}
                        />
                      );
                    }}
                  />
                  <GptAssistantModal
                    isOpen={gptAssistantModal}
                    handleClose={() => {
                      setGptAssistantModal(false);
                      // this is done so that the title do not reset after gpt popover closed
                      reset(getValues());
                    }}
                    inset="top-2 left-0"
                    content=""
                    htmlContent={watch("description_html")}
                    onResponse={(response) => {
                      handleAiAssistance(response);
                    }}
                    projectId={projectId}
                  />
                </div>
              )}
              {entityId !== null && (
                <>
                  {customAttributes.fetchObjectDetailsLoader ? (
                    <Loader className="space-y-3.5">
                      <Loader.Item height="35px" />
                      <Loader.Item height="35px" />
                      <Loader.Item height="35px" />
                    </Loader>
                  ) : (
                    <div className="space-y-5">
                      <CustomAttributesDescriptionFields
                        objectId={entityId ?? ""}
                        issueId={watch("id") ?? ""}
                        onChange={handleCustomAttributesChange}
                        projectId={projectId}
                        values={customAttributesList}
                      />
                      <CustomAttributesCheckboxes
                        objectId={entityId ?? ""}
                        issueId={watch("id") ?? ""}
                        onChange={handleCustomAttributesChange}
                        projectId={projectId}
                        values={customAttributesList}
                      />
                      <CustomAttributesFileUploads
                        objectId={entityId ?? ""}
                        issueId={watch("id") ?? ""}
                        onChange={handleCustomAttributesChange}
                        projectId={projectId}
                        values={customAttributesList}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4 border-t border-custom-border-200">
          <div className="flex items-center gap-2 flex-wrap">
            {(fieldsToShow.includes("all") || fieldsToShow.includes("state")) && (
              <Controller
                control={control}
                name="state"
                render={({ field: { value, onChange } }) => (
                  <IssueStateSelect
                    setIsOpen={setStateModal}
                    value={value}
                    onChange={onChange}
                    projectId={projectId}
                  />
                )}
              />
            )}
            {/* default object properties */}
            {entityId === null ? (
              <>
                {(fieldsToShow.includes("all") || fieldsToShow.includes("priority")) && (
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field: { value, onChange } }) => (
                      <IssuePrioritySelect value={value} onChange={onChange} />
                    )}
                  />
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("assignee")) && (
                  <Controller
                    control={control}
                    name="assignees"
                    render={({ field: { value, onChange } }) => (
                      <IssueAssigneeSelect
                        projectId={projectId}
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  />
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("label")) && (
                  <Controller
                    control={control}
                    name="labels"
                    render={({ field: { value, onChange } }) => (
                      <IssueLabelSelect
                        setIsOpen={setLabelModal}
                        value={value}
                        onChange={onChange}
                        projectId={projectId}
                      />
                    )}
                  />
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("startDate")) && (
                  <div>
                    <Controller
                      control={control}
                      name="start_date"
                      render={({ field: { value, onChange } }) => (
                        <IssueDateSelect
                          label="Start date"
                          maxDate={maxDate ?? undefined}
                          onChange={onChange}
                          value={value}
                        />
                      )}
                    />
                  </div>
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("dueDate")) && (
                  <div>
                    <Controller
                      control={control}
                      name="target_date"
                      render={({ field: { value, onChange } }) => (
                        <IssueDateSelect
                          label="Due date"
                          minDate={minDate ?? undefined}
                          onChange={onChange}
                          value={value}
                        />
                      )}
                    />
                  </div>
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("estimate")) && (
                  <div>
                    <Controller
                      control={control}
                      name="estimate_point"
                      render={({ field: { value, onChange } }) => (
                        <IssueEstimateSelect value={value} onChange={onChange} />
                      )}
                    />
                  </div>
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("parent")) && (
                  <Controller
                    control={control}
                    name="parent"
                    render={({ field: { onChange } }) => (
                      <ParentIssuesListModal
                        isOpen={parentIssueListModalOpen}
                        handleClose={() => setParentIssueListModalOpen(false)}
                        onChange={(issue) => {
                          onChange(issue.id);
                          setSelectedParentIssue(issue);
                        }}
                        projectId={projectId}
                      />
                    )}
                  />
                )}
                {(fieldsToShow.includes("all") || fieldsToShow.includes("parent")) && (
                  <CustomMenu ellipsis>
                    {watch("parent") ? (
                      <>
                        <CustomMenu.MenuItem
                          renderAs="button"
                          onClick={() => setParentIssueListModalOpen(true)}
                        >
                          Change parent issue
                        </CustomMenu.MenuItem>
                        <CustomMenu.MenuItem
                          renderAs="button"
                          onClick={() => setValue("parent", null)}
                        >
                          Remove parent issue
                        </CustomMenu.MenuItem>
                      </>
                    ) : (
                      <CustomMenu.MenuItem
                        renderAs="button"
                        onClick={() => setParentIssueListModalOpen(true)}
                      >
                        Select Parent Issue
                      </CustomMenu.MenuItem>
                    )}
                  </CustomMenu>
                )}
              </>
            ) : (
              <CustomAttributesSelectFields
                objectId={entityId ?? ""}
                issueId={watch("id") ?? ""}
                onChange={handleCustomAttributesChange}
                projectId={projectId}
                values={customAttributesList}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex cursor-pointer items-center gap-1"
              onClick={() => setCreateMore((prevData) => !prevData)}
            >
              <span className="text-xs">Create more</span>
              <ToggleSwitch value={createMore} onChange={() => {}} size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton
                onClick={() => {
                  handleDiscardClose();
                }}
              >
                Discard
              </SecondaryButton>
              <PrimaryButton type="submit" loading={isSubmitting}>
                {status
                  ? isSubmitting
                    ? "Updating Issue..."
                    : "Update Issue"
                  : isSubmitting
                  ? "Adding Issue..."
                  : "Add Issue"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </form>
    </>
  );
});
