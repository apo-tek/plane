import { FC, useCallback, useState } from "react";
import { DragDropContext, DragStart, DraggableLocation, DropResult, Droppable } from "@hello-pangea/dnd";
import { useRouter } from "next/router";
import { observer } from "mobx-react-lite";
// hooks
import { useUser } from "hooks/store";
import useToast from "hooks/use-toast";
// ui
import { Spinner } from "@plane/ui";
// types
import { IIssue } from "types";
import { EIssueActions } from "../types";
import {
  ICycleIssuesFilterStore,
  ICycleIssuesStore,
  IModuleIssuesFilterStore,
  IModuleIssuesStore,
  IProfileIssuesFilterStore,
  IProfileIssuesStore,
  IProjectDraftIssuesStore,
  IProjectIssuesFilterStore,
  IProjectIssuesStore,
  IViewIssuesFilterStore,
  IViewIssuesStore,
} from "store_legacy/issues";
import { IQuickActionProps } from "../list/list-view-types";
import { IIssueKanBanViewStore } from "store_legacy/issue";
//components
import { KanBan } from "./default";
import { KanBanSwimLanes } from "./swimlanes";
import { EProjectStore } from "store_legacy/command-palette.store";
import { DeleteIssueModal, IssuePeekOverview } from "components/issues";
import { EUserProjectRoles } from "constants/project";

export interface IBaseKanBanLayout {
  issueStore:
    | IProjectIssuesStore
    | IModuleIssuesStore
    | ICycleIssuesStore
    | IViewIssuesStore
    | IProjectDraftIssuesStore
    | IProfileIssuesStore;
  issuesFilterStore:
    | IProjectIssuesFilterStore
    | IModuleIssuesFilterStore
    | ICycleIssuesFilterStore
    | IViewIssuesFilterStore
    | IProfileIssuesFilterStore;
  kanbanViewStore: IIssueKanBanViewStore;
  QuickActions: FC<IQuickActionProps>;
  issueActions: {
    [EIssueActions.DELETE]: (issue: IIssue) => Promise<void>;
    [EIssueActions.UPDATE]?: (issue: IIssue) => Promise<void>;
    [EIssueActions.REMOVE]?: (issue: IIssue) => Promise<void>;
  };
  showLoader?: boolean;
  viewId?: string;
  currentStore?: EProjectStore;
  handleDragDrop?: (
    source: any,
    destination: any,
    subGroupBy: string | null,
    groupBy: string | null,
    issues: any,
    issueWithIds: any
  ) => Promise<IIssue | undefined>;
  addIssuesToView?: (issueIds: string[]) => Promise<IIssue>;
  canEditPropertiesBasedOnProject?: (projectId: string) => boolean;
}

type KanbanDragState = {
  draggedIssueId?: string | null;
  source?: DraggableLocation | null;
  destination?: DraggableLocation | null;
};

export const BaseKanBanRoot: React.FC<IBaseKanBanLayout> = observer((props: IBaseKanBanLayout) => {
  const {
    issueStore,
    issuesFilterStore,
    kanbanViewStore,
    QuickActions,
    issueActions,
    showLoader,
    viewId,
    currentStore,
    handleDragDrop,
    addIssuesToView,
    canEditPropertiesBasedOnProject,
  } = props;
  // router
  const router = useRouter();
  const { workspaceSlug, peekIssueId, peekProjectId } = router.query;
  // store hooks
  const {
    membership: { currentProjectRole },
  } = useUser();
  // toast alert
  const { setToastAlert } = useToast();

  const issues = issueStore?.getIssues || {};
  const issueIds = issueStore?.getIssuesIds || [];

  const displayFilters = issuesFilterStore?.issueFilters?.displayFilters;
  const displayProperties = issuesFilterStore?.issueFilters?.displayProperties || null;

  const sub_group_by: string | null = displayFilters?.sub_group_by || null;
  const group_by: string | null = displayFilters?.group_by || null;

  const userDisplayFilters = displayFilters || null;

  const KanBanView = sub_group_by ? KanBanSwimLanes : KanBan;

  const { enableInlineEditing, enableQuickAdd, enableIssueCreation } = issueStore?.viewFlags || {};

  // states
  const [isDragStarted, setIsDragStarted] = useState<boolean>(false);
  const [dragState, setDragState] = useState<KanbanDragState>({});
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);

  const isEditingAllowed = !!currentProjectRole && currentProjectRole >= EUserProjectRoles.MEMBER;

  const canEditProperties = useCallback(
    (projectId: string | undefined) => {
      const isEditingAllowedBasedOnProject =
        canEditPropertiesBasedOnProject && projectId ? canEditPropertiesBasedOnProject(projectId) : isEditingAllowed;

      return enableInlineEditing && isEditingAllowedBasedOnProject;
    },
    [canEditPropertiesBasedOnProject, enableInlineEditing, isEditingAllowed]
  );

  const onDragStart = (dragStart: DragStart) => {
    setDragState({
      draggedIssueId: dragStart.draggableId.split("__")[0],
    });
    setIsDragStarted(true);
  };

  const onDragEnd = async (result: DropResult) => {
    setIsDragStarted(false);

    if (!result) return;

    if (
      result.destination &&
      result.source &&
      result.source.droppableId &&
      result.destination.droppableId &&
      result.destination.droppableId === result.source.droppableId &&
      result.destination.index === result.source.index
    )
      return;

    if (handleDragDrop) {
      if (result.destination?.droppableId && result.destination?.droppableId.split("__")[0] === "issue-trash-box") {
        setDragState({
          ...dragState,
          source: result.source,
          destination: result.destination,
        });
        setDeleteIssueModal(true);
      } else {
        await handleDragDrop(result.source, result.destination, sub_group_by, group_by, issues, issueIds).catch(
          (err) => {
            setToastAlert({
              title: "Error",
              type: "error",
              message: err.detail ?? "Failed to perform this action",
            });
          }
        );
      }
    }
  };

  const handleIssues = useCallback(
    async (issue: IIssue, action: EIssueActions) => {
      if (issueActions[action]) {
        await issueActions[action]!(issue);
      }
    },
    [issueActions]
  );

  const renderQuickActions = useCallback(
    (issue: IIssue, customActionButton?: React.ReactElement) => (
      <QuickActions
        customActionButton={customActionButton}
        issue={issue}
        handleDelete={async () => handleIssues(issue, EIssueActions.DELETE)}
        handleUpdate={
          issueActions[EIssueActions.UPDATE] ? async (data) => handleIssues(data, EIssueActions.UPDATE) : undefined
        }
        handleRemoveFromView={
          issueActions[EIssueActions.REMOVE] ? async () => handleIssues(issue, EIssueActions.REMOVE) : undefined
        }
      />
    ),
    [issueActions, handleIssues]
  );

  const handleDeleteIssue = async () => {
    if (!handleDragDrop) return;
    await handleDragDrop(dragState.source, dragState.destination, sub_group_by, group_by, issues, issueIds).finally(
      () => {
        setDeleteIssueModal(false);
        setDragState({});
      }
    );
  };

  const handleKanBanToggle = (toggle: "groupByHeaderMinMax" | "subgroupByIssuesVisibility", value: string) => {
    kanbanViewStore.handleKanBanToggle(toggle, value);
  };

  return (
    <>
      <DeleteIssueModal
        data={dragState.draggedIssueId ? issues[dragState.draggedIssueId] : ({} as IIssue)}
        isOpen={deleteIssueModal}
        handleClose={() => setDeleteIssueModal(false)}
        onSubmit={handleDeleteIssue}
      />

      {showLoader && issueStore?.loader === "init-loader" && (
        <div className="fixed right-2 top-16 z-30 flex h-10 w-10 items-center justify-center rounded bg-custom-background-80 shadow-custom-shadow-sm">
          <Spinner className="h-5 w-5" />
        </div>
      )}

      <div className={`relative h-max min-h-full w-max min-w-full bg-custom-background-90 px-3`}>
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div
            className={`fixed left-1/2 -translate-x-1/2 ${
              isDragStarted ? "z-40" : ""
            } top-3 mx-3 flex w-72 items-center justify-center`}
          >
            <Droppable droppableId="issue-trash-box" isDropDisabled={!isDragStarted}>
              {(provided, snapshot) => (
                <div
                  className={`${
                    isDragStarted ? `opacity-100` : `opacity-0`
                  } flex w-full items-center justify-center rounded border-2 border-red-500/20 bg-custom-background-100 px-3 py-5 text-xs font-medium italic text-red-500 ${
                    snapshot.isDraggingOver ? "bg-red-500 opacity-70 blur-2xl" : ""
                  } transition duration-300`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  Drop here to delete the issue.
                </div>
              )}
            </Droppable>
          </div>

          <KanBanView
            issues={issues}
            issueIds={issueIds}
            sub_group_by={sub_group_by}
            group_by={group_by}
            handleIssues={handleIssues}
            quickActions={renderQuickActions}
            displayProperties={displayProperties}
            kanBanToggle={kanbanViewStore?.kanBanToggle}
            handleKanBanToggle={handleKanBanToggle}
            enableQuickIssueCreate={enableQuickAdd}
            showEmptyGroup={userDisplayFilters?.show_empty_groups || true}
            quickAddCallback={issueStore?.quickAddIssue}
            viewId={viewId}
            disableIssueCreation={!enableIssueCreation || !isEditingAllowed}
            canEditProperties={canEditProperties}
            currentStore={currentStore}
            addIssuesToView={addIssuesToView}
          />
        </DragDropContext>
      </div>

      {workspaceSlug && peekIssueId && peekProjectId && (
        <IssuePeekOverview
          workspaceSlug={workspaceSlug.toString()}
          projectId={peekProjectId.toString()}
          issueId={peekIssueId.toString()}
          handleIssue={async (issueToUpdate) => await handleIssues(issueToUpdate as IIssue, EIssueActions.UPDATE)}
        />
      )}
    </>
  );
});
