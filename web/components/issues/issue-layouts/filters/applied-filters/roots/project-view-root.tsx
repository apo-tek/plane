import { useRouter } from "next/router";
import { observer } from "mobx-react-lite";
// hooks
import { useProjectView } from "hooks/store";
import { useMobxStore } from "lib/mobx/store-provider";
// components
import { AppliedFiltersList } from "components/issues";
// ui
import { Button } from "@plane/ui";
// helpers
import { areFiltersDifferent } from "helpers/filter.helper";
// types
import { IIssueFilterOptions } from "types";
import { EFilterType } from "store_legacy/issues/types";

export const ProjectViewAppliedFiltersRoot: React.FC = observer(() => {
  // router
  const router = useRouter();
  const { workspaceSlug, projectId, viewId } = router.query as {
    workspaceSlug: string;
    projectId: string;
    viewId: string;
  };
  // store hooks
  const {
    projectLabel: { projectLabels },
    projectState: projectStateStore,
    projectMember: { projectMembers },
    viewIssuesFilter: { issueFilters, updateFilters },
  } = useMobxStore();
  const { getViewById, updateView } = useProjectView();

  const viewDetails = viewId ? getViewById(viewId.toString()) : null;

  const userFilters = issueFilters?.filters;
  // filters whose value not null or empty array
  const appliedFilters: IIssueFilterOptions = {};
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId) return;
    if (!value) {
      updateFilters(
        workspaceSlug,
        projectId,
        EFilterType.FILTERS,
        {
          [key]: null,
        },
        viewId
      );
      return;
    }

    let newValues = issueFilters?.filters?.[key] ?? [];
    newValues = newValues.filter((val) => val !== value);

    updateFilters(
      workspaceSlug,
      projectId,
      EFilterType.FILTERS,
      {
        [key]: newValues,
      },
      viewId
    );
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      newFilters[key as keyof IIssueFilterOptions] = null;
    });
    updateFilters(workspaceSlug, projectId, EFilterType.FILTERS, { ...newFilters }, viewId);
  };

  // return if no filters are applied
  if (Object.keys(appliedFilters).length === 0) return null;

  const handleUpdateView = () => {
    if (!workspaceSlug || !projectId || !viewId || !viewDetails) return;

    updateView(workspaceSlug.toString(), projectId.toString(), viewId.toString(), {
      query_data: {
        ...viewDetails.query_data,
        ...(appliedFilters ?? {}),
      },
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <AppliedFiltersList
        appliedFilters={appliedFilters}
        handleClearAllFilters={handleClearAllFilters}
        handleRemoveFilter={handleRemoveFilter}
        labels={projectLabels ?? []}
        members={projectMembers?.map((m) => m.member)}
        states={projectStateStore.states?.[projectId?.toString() ?? ""]}
      />

      {appliedFilters &&
        viewDetails?.query_data &&
        areFiltersDifferent(appliedFilters, viewDetails?.query_data ?? {}) && (
          <div className="flex flex-shrink-0 items-center justify-center">
            <Button variant="primary" size="sm" onClick={handleUpdateView}>
              Update view
            </Button>
          </div>
        )}
    </div>
  );
});
